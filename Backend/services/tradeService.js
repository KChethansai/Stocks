import { startSession } from 'mongoose'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { orderModel } from '../models/OrderModel.js'

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

export const isValidSymbol = (symbol) => SYMBOL_PATTERN.test(symbol || '')

export const isValidQuantity = (quantity) =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY

/**
 * Run `workFn` inside a MongoDB transaction, falling back to a non-transactional
 * retry on standalone servers that cannot start sessions.
 */
export const executeWithTransactionFallback = async (workFn) => {
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
      // ponytail: standalone MongoDB has no transactions — this retry is not atomic.
      // Run a replica set (or Atlas) if concurrent trades per user are expected.
      return await workFn(null)
    }
    throw err
  } finally {
    if (session) session.endSession()
  }
}

/**
 * Execute a paper buy or sell.
 *
 * @param {object} params
 * @param {string} params.userId            owning user (`req.user.id` or ObjectId)
 * @param {string} params.symbol            uppercase ticker
 * @param {number} params.quantity          whole shares, >= 1
 * @param {'BUY'|'SELL'} params.side
 * @param {'MANUAL'|'AUTOMATION'} [params.source='MANUAL']
 * @param {object|null} [params.stock]      pre-loaded stock doc, avoids a re-read
 * @returns {Promise<{balance: number, holdings: Array, transaction: object, price: number, total: number, quantity: number}>}
 * @throws {Error & {statusCode: number}} on validation / funds / holdings failures
 */
export async function executePaperTrade({ userId, symbol, quantity, side, source = 'MANUAL', stock = null }) {
  const ticker = typeof symbol === 'string' ? symbol.toUpperCase().trim() : ''
  const shares = Number.parseInt(quantity, 10)
  const tradeSide = side === 'SELL' ? 'SELL' : 'BUY'

  if (!isValidSymbol(ticker) || !isValidQuantity(shares)) {
    throw httpError('Invalid symbol or quantity', 400)
  }

  const stockDoc = stock || (await stockModel.findOne({ symbol: ticker }).lean())
  if (!stockDoc) throw httpError('Stock not found', 404)
  if (!(stockDoc.price > 0)) throw httpError('Stock price unavailable', 409)

  const price = stockDoc.price
  const total = Number((price * shares).toFixed(2))

  return executeWithTransactionFallback(async (session) => {
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
          source
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
          source
        }
      ],
      sessionOpt
    )

    return {
      balance: user.balance,
      holdings,
      transaction: createdTxs[0],
      price,
      total,
      quantity: shares
    }
  })
}

/** Convenience wrappers. */
export const executePaperBuy = (params) => executePaperTrade({ ...params, side: 'BUY' })
export const executePaperSell = (params) => executePaperTrade({ ...params, side: 'SELL' })
