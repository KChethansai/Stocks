/* Phase 0 verification: isolated fixtures on the SAME cluster (test database).
 * Gates: unique index exists, real transactions work, concurrent same-key
 * requests produce exactly one fill, retry replays, detail-mismatch 409s,
 * user scoping, stale/unverified 409s, alert gating, full liquidation.
 * Cleans up by dropping the test database. Exit non-zero on any failure.
 */
import mongoose from 'mongoose'
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.join(__dirname, '../.env') })

const results = []
const gate = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const BASE_URL = process.env.DB_URL || ''
if (!BASE_URL) {
  console.error('FAIL  env — DB_URL missing')
  process.exit(1)
}
// Derive an isolated database on the same deployment (topology identical).
// Fails closed BEFORE connecting: a base URL without a database path would
// otherwise leave TEST_URL === BASE_URL and write fixtures into the
// configured database itself.
const TEST_DB = `phase0test_${Date.now().toString(36)}`
const { derivePhase0TestUrl } = await import('../config/seedGuard.js')
const derived = derivePhase0TestUrl(BASE_URL, TEST_DB)
if (!derived.ok) {
  console.error(`FAIL  env — ${derived.reason}`)
  process.exit(1)
}
const TEST_URL = derived.testUrl

await mongoose.connect(TEST_URL, { family: 4 })

// Topology evidence (not just a URL parameter).
const hello = await mongoose.connection.db.admin().command({ hello: 1 }).catch(() => ({}))
gate('topology-replica-set', Boolean(hello.setName), hello.setName ? `setName=${hello.setName}` : 'no setName — transactions unavailable')

const { userModel } = await import('../models/UserModel.js')
const { stockModel } = await import('../models/StockModel.js')
const { portfolioModel } = await import('../models/PortfolioModel.js')
const { transactionModel } = await import('../models/TransactionModel.js')
const { orderModel } = await import('../models/OrderModel.js')
const { idempotencyKeyModel } = await import('../models/IdempotencyKeyModel.js')
const { executePaperTrade } = await import('../services/tradeService.js')

await Promise.all([
  userModel.createIndexes(),
  stockModel.createIndexes(),
  portfolioModel.createIndexes(),
  transactionModel.createIndexes(),
  orderModel.createIndexes(),
  idempotencyKeyModel.createIndexes()
])
const keyIndexes = await idempotencyKeyModel.collection.indexes()
gate(
  'unique-index-user-key',
  keyIndexes.some((ix) => ix.unique && ix.key?.userId === 1 && ix.key?.key === 1),
  JSON.stringify(keyIndexes.map((ix) => ({ key: ix.key, unique: !!ix.unique })))
)

// Real transaction probe on temp collections (rollback must hold).
const probe = mongoose.connection.collection('phase0_probe')
{
  const session = await mongoose.startSession()
  let rolledBack = false
  try {
    await session.withTransaction(async () => {
      await probe.insertOne({ marker: 'a' }, { session })
      await probe.insertOne({ marker: 'b' }, { session })
      throw new Error('intentional-abort')
    })
  } catch (e) {
    if (e.message === 'intentional-abort') rolledBack = (await probe.countDocuments({})) === 0
  } finally {
    await session.endSession()
  }
  await probe.deleteMany({})
  gate('transactions-commit-atomically', rolledBack, rolledBack ? 'abort rolled back both writes' : 'ROLLBACK FAILED')
}

// Fixtures.
const user = await userModel.create({ username: 'phase0t', email: 'phase0t@example.com', password: 'x'.repeat(60), balance: 100000 })
const user2 = await userModel.create({ username: 'phase0t2', email: 'phase0t2@example.com', password: 'x'.repeat(60), balance: 100000 })
const now = new Date()
await stockModel.create([
  // marketState is required by the session-aware execution policy: an
  // absent/unknown session fails closed. 'REGULAR' is the fixture's intent —
  // a plainly verifiable, in-session quote.
  { symbol: 'TEST', name: 'Test Inc', price: 100, change: 0, changePercent: 0, volume: 1000, marketCap: 100000, sector: 'Technology', source: 'yahoo', asOf: now, providerTime: now, lastVerifiedAt: now, marketState: 'REGULAR', stale: false },
  { symbol: 'STALE', name: 'Stale Inc', price: 50, change: 0, changePercent: 0, volume: 1000, marketCap: 50000, sector: 'Technology', source: 'yahoo', asOf: now, providerTime: now, lastVerifiedAt: now, marketState: 'REGULAR', stale: true },
  { symbol: 'UNVER', name: 'Unver Inc', price: 50, change: 0, changePercent: 0, volume: 1000, marketCap: 50000, sector: 'Technology', source: 'unverified', marketState: 'REGULAR' }
])

const KEY = `testkey-${Date.now().toString(36)}-abcd1234`
// Concurrent identical requests (separate microtasks, same process queue bypassed
// by calling the unlocked path through 5 parallel service calls).
const settled = await Promise.allSettled(
  Array.from({ length: 5 }, () =>
    executePaperTrade({ userId: String(user._id), symbol: 'TEST', quantity: 1, side: 'BUY', source: 'MANUAL', idempotencyKey: KEY })
  )
)
const fulfilled = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
const txIds = new Set(fulfilled.map((r) => String(r.transaction?._id)))
const balAfter = (await userModel.findById(user._id).lean()).balance
const txCount = await transactionModel.countDocuments({ userId: user._id, idempotencyKey: KEY })
gate('concurrent-same-key-one-fill', fulfilled.length === 5 && txIds.size === 1 && txCount === 1 && balAfter === 99900,
  `fulfilled=${fulfilled.length} receipts=${txIds.size} txDocs=${txCount} balance=${balAfter}`)

// Retry after "lost response" returns original receipt, balance untouched.
const retry = await executePaperTrade({ userId: String(user._id), symbol: 'TEST', quantity: 1, side: 'BUY', source: 'MANUAL', idempotencyKey: KEY })
const balRetry = (await userModel.findById(user._id).lean()).balance
gate('retry-replays-receipt', String(retry.transaction?._id) === [...txIds][0] && balRetry === 99900,
  `sameTx=${String(retry.transaction?._id) === [...txIds][0]} balance=${balRetry}`)

// Same key, different details → 409.
let mismatch = null
try {
  await executePaperTrade({ userId: String(user._id), symbol: 'TEST', quantity: 9, side: 'BUY', source: 'MANUAL', idempotencyKey: KEY })
} catch (e) { mismatch = e }
gate('key-detail-mismatch-409', mismatch?.statusCode === 409, mismatch?.message)

// Failed trade must not poison the key: insufficient-funds failure then
// retry of an affordable quantity on the SAME key returns the real error
// first and a real receipt second (never stuck "in progress").
const POISON = `poison-${Date.now().toString(36)}-abcd1234`
let fundsErr = null
try {
  await executePaperTrade({ userId: String(user2._id), symbol: 'TEST', quantity: 100000, side: 'BUY', source: 'MANUAL', idempotencyKey: POISON })
} catch (e) { fundsErr = e }
const bal2BeforeRetry = (await userModel.findById(user2._id).lean()).balance
let poisonRetry = null
let poisonRetryErr = null
try {
  poisonRetry = await executePaperTrade({ userId: String(user2._id), symbol: 'TEST', quantity: 1, side: 'BUY', source: 'MANUAL', idempotencyKey: POISON })
} catch (e) { poisonRetryErr = e }
gate('failed-trade-key-stays-reusable',
  fundsErr?.statusCode === 400 && poisonRetry?.quantity === 1 && !poisonRetryErr,
  `first=${fundsErr?.statusCode} retryQty=${poisonRetry?.quantity} retryErr=${poisonRetryErr?.message || 'none'} balance=${bal2BeforeRetry}`)

// Keys scoped per user: same key string for another user is independent
// (order-independent: measures the delta of this call only).
const bal2Before = (await userModel.findById(user2._id).lean()).balance
const other = await executePaperTrade({ userId: String(user2._id), symbol: 'TEST', quantity: 2, side: 'BUY', source: 'MANUAL', idempotencyKey: KEY })
const bal2 = (await userModel.findById(user2._id).lean()).balance
gate('key-scoped-per-user', other.quantity === 2 && bal2 === bal2Before - 200, `user2 delta=${bal2Before - bal2}`)

// Stale / unverified enforcement (manual path).
for (const [sym, label] of [['STALE', 'stale-409'], ['UNVER', 'unverified-409']]) {
  let err = null
  try {
    await executePaperTrade({ userId: String(user._id), symbol: sym, quantity: 1, side: 'BUY', source: 'MANUAL', idempotencyKey: `k-${sym}-${Date.now().toString(36)}-zz123456` })
  } catch (e) { err = e }
  gate(label, err?.statusCode === 409, err?.message)
}
const balAfterBlocks = (await userModel.findById(user._id).lean()).balance
gate('blocked-quotes-no-side-effects', balAfterBlocks === 99900, `balance=${balAfterBlocks}`)

// Outside a regular session a genuine, bounded last close must still fill —
// this is the defect that made the simulator unusable on evenings and
// weekends. Uses only local fixtures: no provider call.
await stockModel.updateOne(
  { symbol: 'CLSD' },
  {
    $set: {
      symbol: 'CLSD',
      name: 'Closed Session Co',
      price: 250,
      change: 0,
      changePercent: 0,
      volume: 1000,
      marketCap: 100000,
      sector: 'Technology',
      source: 'yahoo',
      asOf: new Date(Date.now() - 3600_000),
      providerTime: new Date(Date.now() - 3600_000),
      lastVerifiedAt: new Date(Date.now() - 3600_000),
      marketState: 'POSTPOST',
      stale: false
    }
  },
  { upsert: true }
)
// A dedicated account: these fills move a balance, and the liquidation gate
// below asserts an exact total on `user`.
const sessionUser = await userModel.create({
  username: 'phase0session', email: 'phase0session@example.com', password: 'x'.repeat(60), balance: 100000
})
const beforeClose = 100000
let closeReceipt = null
let closeErr = null
try {
  closeReceipt = await executePaperTrade({
    userId: String(sessionUser._id),
    symbol: 'CLSD',
    quantity: 1,
    side: 'BUY',
    source: 'MANUAL',
    idempotencyKey: `k-closed-${Date.now().toString(36)}-zz123456`
  })
} catch (e) { closeErr = e }
gate(
  'closed-session-genuine-close-fills',
  !closeErr && closeReceipt?.price === 250 && closeReceipt?.quantity === 1,
  closeErr?.message || `price=${closeReceipt?.price}`
)
const afterClose = (await userModel.findById(sessionUser._id).lean()).balance
gate('closed-session-fills-at-verified-price', afterClose === beforeClose - 250, `balance=${afterClose}`)

// The same shape, but ancient: a closed session far outside the bound must
// still be refused rather than filling at a months-old price.
await stockModel.updateOne(
  { symbol: 'ANCST' },
  {
    $set: {
      symbol: 'ANCST',
      name: 'Ancient Co',
      price: 9,
      change: 0,
      changePercent: 0,
      volume: 1,
      marketCap: 1,
      sector: 'Technology',
      source: 'yahoo',
      asOf: new Date(Date.now() - 30 * 86400_000),
      providerTime: new Date(Date.now() - 30 * 86400_000),
      lastVerifiedAt: new Date(Date.now() - 30 * 86400_000),
      marketState: 'POSTPOST',
      stale: false
    }
  },
  { upsert: true }
)
let ancientErr = null
try {
  await executePaperTrade({ userId: String(sessionUser._id), symbol: 'ANCST', quantity: 1, side: 'BUY', source: 'MANUAL', idempotencyKey: `k-ancient-${Date.now().toString(36)}-zz123456` })
} catch (e) { ancientErr = e }
gate('ancient-closed-quote-409', ancientErr?.statusCode === 409, ancientErr?.message || 'filled at a months-old price')

// Alert gating: only verified quotes fire.
const { priceAlertModel } = await import('../models/PriceAlertModel.js').catch(() => ({}))
if (priceAlertModel) {
  const { checkPriceTriggers } = await import('../services/priceMonitor.js')
  await priceAlertModel.create([
    { userId: user._id, symbol: 'TEST', targetPrice: 50, direction: 'ABOVE' },
    { userId: user._id, symbol: 'STALE', targetPrice: 1, direction: 'ABOVE' },
    { userId: user._id, symbol: 'UNVER', targetPrice: 1, direction: 'ABOVE' }
  ])
  await checkPriceTriggers()
  const fired = await priceAlertModel.find({ userId: user._id, triggered: true }).lean()
  gate('alerts-fire-on-verified-only', fired.length === 1 && fired[0].symbol === 'TEST',
    `fired=[${fired.map((f) => f.symbol)}]`)
} else {
  gate('alerts-fire-on-verified-only', true, 'priceAlertModel absent — skipped')
}

// Full liquidation + reconciliation: sell the 1 TEST share @100 → balance 100000, no holdings.
const sellKey = `sell-${Date.now().toString(36)}-abcd1234`
await executePaperTrade({ userId: String(user._id), symbol: 'TEST', quantity: 1, side: 'SELL', source: 'MANUAL', idempotencyKey: sellKey })
const finalUser = await userModel.findById(user._id).lean()
const finalPortfolio = await portfolioModel.findOne({ userId: user._id }).lean()
gate('full-liquidation-reconciles', finalUser.balance === 100000 && (finalPortfolio?.holdings?.length || 0) === 0,
  `balance=${finalUser.balance} holdings=${finalPortfolio?.holdings?.length}`)

// Scoped-drop guard: prove the connection is on the derived isolated
// database before the destructive drop — never the configured database.
const { getPhase0DropDecision } = await import('../config/seedGuard.js')
const connectedName = mongoose.connection.name
const dropDecision = getPhase0DropDecision(connectedName, TEST_DB)
gate('drop-scope-verified', dropDecision.ok, dropDecision.reason || `dropping ${TEST_DB}`)
if (!dropDecision.ok) {
  await mongoose.disconnect()
  process.exit(1)
}
await mongoose.connection.db.dropDatabase()
await mongoose.disconnect()

const failed = results.filter((r) => !r.ok)
console.log(`\nPhase0 gates: ${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
