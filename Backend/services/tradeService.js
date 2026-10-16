import { startSession } from 'mongoose'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { orderModel } from '../models/OrderModel.js'
import { idempotencyKeyModel } from '../models/IdempotencyKeyModel.js'
import { isExecutableQuote } from './quotePolicy.js'

/**
 * Single owner of paper-trade execution.
 *
 * Both the manual trade routes (`TradeAPI`) and the automation engine
 * (`ml/automationJob`) call through here, so balance/holdings rules can never
 * diverge between a human click and a rule firing.
 *
 * 100% virtual balance — nothing in this file touches real money.
 */

export const SYMBOL_PATTERN = /^[A-Z.]{1,10}$/
const MAX_QUANTITY = 100000

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode })

const isValidSymbol = (symbol) => SYMBOL_PATTERN.test(symbol || '')

const isValidQuantity = (quantity) =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY

/**
 * Run `workFn` inside a MongoDB transaction. There is deliberately NO
 * non-transactional fallback: balance, holdings, order, transaction and
 * idempotency receipt must commit atomically, and a silent non-atomic retry
 * on standalone servers would permit double-fills and partial writes.
 * If the deployment cannot provide transactions, fail loudly (503) instead.
 */
const executeInTransaction = async (workFn) => {
  let session = null
  try {
    session = await startSession()
    let result
    await session.withTransaction(async () => {
      result = await workFn(session)
    })
    return result
  } catch (err) {
    if (
      err.message?.includes('replica set') ||
      err.message?.includes('Transaction numbers') ||
      err.code === 20 ||
      err.codeName === 'IllegalOperation'
    ) {
      throw httpError(
        'Order service requires MongoDB transactions (replica set / Atlas). Refusing non-atomic execution.',
        503
      )
    }
    throw err
  } finally {
    if (session) session.endSession()
  }
}

// ── Per-user trade serialization ────────────────────────────────────────────
// Concurrent BUY/SELL for the SAME user are queued so the funds check and the
// balance write cannot interleave. On Atlas/replica-set the Mongo transactions
// below are the real guarantee; this lock additionally avoids same-user
// contention aborts and covers standalone MongoDB (dev) where transactions
// cannot start. # ponytail: single-process lock only — multi-instance deploys
// must rely on the transactional path (Atlas gives it by default).
const tradeQueues = new Map()

const enqueueTrade = (userId, task) => {
  const prev = tradeQueues.get(userId) || Promise.resolve()
  const run = prev.catch(() => {}).then(task)
  tradeQueues.set(userId, run)
  run
    .finally(() => {
      if (tradeQueues.get(userId) === run) tradeQueues.delete(userId)
    })
    .catch(() => {})
  return run
}

/**
 * Execute a paper buy or sell.
 * @param {object} params
 * @param {string} params.userId            owning user (`req.user.id` or ObjectId)
 * @param {string} params.symbol            uppercase ticker
 * @param {number} params.quantity          whole shares, >= 1
 * @param {'BUY'|'SELL'} params.side
 * @param {'MANUAL'|'AUTOMATION'} [params.source='MANUAL']
 * @param {object|null} [params.stock]      pre-loaded stock doc, avoids a re-read
 * @param {string} [params.idempotencyKey]  client-generated UUID for safe retries
 * @returns {Promise<{balance: number, holdings: Array, transaction: object, price: number, total: number, quantity: number}>}
 * @throws {Error & {statusCode: number}} on validation / funds / holdings failures
 */
export function executePaperTrade(params) {
  return enqueueTrade(String(params.userId), () => executePaperTradeUnlocked(params))
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/
const IDEMPOTENCY_WAIT_MS = 8000
const IDEMPOTENCY_POLL_MS = 100
const IDEMPOTENCY_STALE_MS = 30 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const detailsMatch = (claim, ticker, tradeSide, shares) =>
  claim.symbol === ticker && claim.side === tradeSide && Number(claim.quantity) === shares

/**
 * Claim-first idempotency. The key is reserved atomically BEFORE any balance
 * or holdings mutation, so a losing duplicate never executes a trade:
 * - new key → we are the winner; caller executes exactly once, then completes.
 * - completed key, same details → return the ORIGINAL receipt, no side effects.
 * - completed key, different details → 409 (keys are bound to order details).
 * - in-progress key → wait (bounded) for the winner's receipt; stale claims
 *   recover via the linked transaction or are reclaimed.
 */
async function claimIdempotencyKey(userId, key, ticker, tradeSide, shares) {
  let res
  try {
    res = await idempotencyKeyModel.findOneAndUpdate(
      { userId, key },
      {
        $setOnInsert: {
          userId,
          key,
          symbol: ticker,
          side: tradeSide,
          quantity: shares,
          status: 'in-progress'
        }
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true }
    )
  } catch (err) {
    if (err?.code === 11000) {
      const loser = await idempotencyKeyModel.findOne({ userId, key }).lean()
      return { outcome: loser?.status === 'completed' ? 'replay' : 'wait', claim: loser }
    }
    throw err
  }
  const created = res?.lastErrorObject?.updatedExisting === false
  if (created) return { outcome: 'winner', claim: res.value }
  const claim = res.value
  if (claim?.status === 'completed') return { outcome: 'replay', claim }
  return { outcome: 'wait', claim }
}

async function awaitWinnerReceipt(userId, key, ticker, tradeSide, shares) {
  const deadline = Date.now() + IDEMPOTENCY_WAIT_MS
  for (;;) {
    const claim = await idempotencyKeyModel.findOne({ userId, key }).lean()
    if (!claim) throw httpError('Order in progress — retry with the same key', 409)
    // Fail fast on detail mismatch even while the winner is in progress —
    // the key is bound to its order details from the claim moment.
    if (!detailsMatch(claim, ticker, tradeSide, shares)) {
      throw httpError('Idempotency key already used with different order details', 409)
    }
    if (claim.status === 'completed') {
      return claim.response
    }
    // Crashed-winner recovery: a stale in-progress claim may already have a
    // committed trade linked by key — adopt it instead of double-filling.
    if (Date.now() - new Date(claim.createdAt).getTime() > IDEMPOTENCY_STALE_MS) {
      const orphan = await transactionModel.findOne({ userId, idempotencyKey: key }).sort({ createdAt: -1 }).lean()
      if (orphan) {
        const portfolio = await portfolioModel.findOne({ userId }).lean()
        const user = await userModel.findById(userId).select('balance').lean()
        const receipt = {
          balance: user?.balance,
          holdings: portfolio?.holdings || [],
          transaction: orphan,
          price: orphan.price,
          total: orphan.total,
          quantity: orphan.quantity
        }
        await idempotencyKeyModel.updateOne(
          { userId, key, status: 'in-progress' },
          { $set: { status: 'completed', response: receipt } }
        )
        return receipt
      }
      throw httpError('Order in progress — retry with the same key', 409)
    }
    if (Date.now() >= deadline) throw httpError('Order in progress — retry with the same key', 409)
    await sleep(IDEMPOTENCY_POLL_MS)
  }
}

async function executePaperTradeUnlocked({ userId, symbol, quantity, side, source = 'MANUAL', stock = null, idempotencyKey = null }) {
  const ticker = typeof symbol === 'string' ? symbol.toUpperCase().trim() : ''
  // Validate the RAW quantity: parseInt would silently coerce 1.5 → 1 and
  // fill a fractional order as 1 share. Only whole shares ≥ 1 are accepted.
  const shares = Number(quantity)
  const tradeSide = side === 'SELL' ? 'SELL' : 'BUY'

  if (!isValidSymbol(ticker) || !isValidQuantity(shares)) {
    throw httpError('Invalid symbol or quantity', 400)
  }

  const hasKey = typeof idempotencyKey === 'string' && IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  if (hasKey) {
    const existing = await idempotencyKeyModel.findOne({ userId, key: idempotencyKey }).lean()
    if (existing) {
      if (!detailsMatch(existing, ticker, tradeSide, shares)) {
        throw httpError('Idempotency key already used with different order details', 409)
      }
      if (existing.status === 'completed') return existing.response
      return awaitWinnerReceipt(userId, idempotencyKey, ticker, tradeSide, shares)
    }
  }

  const stockDoc = stock || (await stockModel.findOne({ symbol: ticker }).lean())
  if (!stockDoc) throw httpError('Stock not found', 404)
  // Quote provenance gate: unverified or stale quotes never fill silently.
  // The caller must refresh to a verified Yahoo quote first. No synthetic
  // price path exists — simulation writes were removed in Phase 0.
  // Gate runs BEFORE the idempotency claim so failed validations never
  // poison a key with a stuck in-progress claim.
  if (!isExecutableQuote(stockDoc, ticker)) {
    throw httpError('Quote is stale or unverified — refresh regular-session market data and retry', 409)
  }
  if (!(stockDoc.price > 0)) throw httpError('Stock price unavailable', 409)

  // Claim-first idempotency: reserve the key BEFORE touching balances, so a
  // concurrent duplicate or retry can never cause a second fill. Button
  // disabling alone is insufficient; this is the durable guarantee.
  let wonClaim = false
  if (hasKey) {
    const { outcome, claim } = await claimIdempotencyKey(userId, idempotencyKey, ticker, tradeSide, shares)
    if (outcome === 'replay') {
      if (!detailsMatch(claim, ticker, tradeSide, shares)) {
        throw httpError('Idempotency key already used with different order details', 409)
      }
      return claim.response
    }
    if (outcome === 'wait') {
      return awaitWinnerReceipt(userId, idempotencyKey, ticker, tradeSide, shares)
    }
    wonClaim = true
  }

  const price = stockDoc.price
  const total = Number((price * shares).toFixed(2))

  // A failed execution after winning the claim must release the untouched
  // in-progress key so the same key stays retryable with the real error —
  // never stuck behind "Order in progress". Only untouched in-progress
  // claims are deleted; completed receipts are never removed here.
  try {
    return await executeInTransaction(async (session) => {
    const sessionOpt = session ? { session } : {}
    const user = await userModel.findById(userId).session(session || null)
    if (!user) throw httpError('User not found', 404)

    const existingPortfolio = await portfolioModel.findOne({ userId }).session(session || null)
    const balanceBefore = user.balance

    let portfolio
    let holdings

    if (tradeSide === 'BUY') {
      if (balanceBefore < total) throw httpError('Insufficient balance', 400)

      user.balance = Number((balanceBefore - total).toFixed(2))

      portfolio =
        existingPortfolio || (await portfolioModel.create([{ userId: user._id, holdings: [] }], sessionOpt))[0]

      const holding = portfolio.holdings.find((item) => item.symbol === ticker)
      if (holding) {
        const newQuantity = holding.quantity + shares
        const weightedAvg = (holding.avgBuyPrice * holding.quantity + price * shares) / newQuantity
        holding.quantity = newQuantity
        holding.avgBuyPrice = Number(weightedAvg.toFixed(2))
        holding.currentPrice = price
      } else {
        portfolio.holdings.push({
          symbol: stockDoc.symbol,
          name: stockDoc.name,
          quantity: shares,
          avgBuyPrice: price,
          currentPrice: price
        })
      }
    } else {
      if (!existingPortfolio) throw httpError('Portfolio not found', 400)
      portfolio = existingPortfolio

      const holdingIndex = portfolio.holdings.findIndex((item) => item.symbol === ticker)
      if (holdingIndex === -1) throw httpError('No holdings found for this stock', 400)

      const holding = portfolio.holdings[holdingIndex]
      if (holding.quantity < shares) throw httpError('Insufficient quantity to sell', 400)

      user.balance = Number((balanceBefore + total).toFixed(2))
      holding.quantity -= shares
      holding.currentPrice = price
      if (holding.quantity === 0) portfolio.holdings.splice(holdingIndex, 1)
    }

    await user.save(sessionOpt)
    await portfolio.save(sessionOpt)
    holdings = portfolio.holdings

    await orderModel.create(
      [
        {
          userId: user._id,
          symbol: stockDoc.symbol,
          type: tradeSide,
          quantity: shares,
          price,
          total,
          status: 'COMPLETED',
          source,
          idempotencyKey: hasKey ? idempotencyKey : undefined
        }
      ],
      sessionOpt
    )

    const createdTxs = await transactionModel.create(
      [
        {
          userId: user._id,
          type: tradeSide,
          symbol: stockDoc.symbol,
          quantity: shares,
          price,
          total,
          balanceBefore,
          balanceAfter: user.balance,
          source,
          idempotencyKey: hasKey ? idempotencyKey : undefined
        }
      ],
      sessionOpt
    )

    const receipt = {
      balance: user.balance,
      holdings,
      transaction: createdTxs[0],
      price,
      total,
      quantity: shares
    }

    // Complete the claim with the original receipt. The trade already
    // committed atomically above; a crash here is recovered via the linked
    // transaction on retry (see awaitWinnerReceipt).
    if (hasKey) {
      await idempotencyKeyModel.updateOne(
        { userId: user._id, key: idempotencyKey, status: 'in-progress' },
        { $set: { status: 'completed', response: receipt } },
        sessionOpt
      )
    }

    return receipt
    })
  } catch (err) {
    if (hasKey && wonClaim) {
      await idempotencyKeyModel.deleteOne({ userId, key: idempotencyKey, status: 'in-progress' }).catch(() => {})
    }
    throw err
  }
}

