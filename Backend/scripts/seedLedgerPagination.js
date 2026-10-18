/* Pagination test-data seeder for the ISOLATED Playwright database only.
 *
 * Purpose: prove the ledger paginates across real pages and past the old
 * 100-record cap. Those need more rows than it is sensible to create by placing
 * hundreds of live orders, and each live order also mutates the test account's
 * balance and holdings — which would corrupt the portfolio figures the same
 * test run also checks.
 *
 * What it writes: `transaction` documents ONLY, for ONE user, on the isolated
 * test cluster. It never fabricates market data — `price`/`total` reuse the
 * genuine stored quotes for the symbol from the stocks collection where one
 * exists. It refuses to run unless the target database name contains 'test'.
 *
 * It is a test fixture, not application logic, and is not imported by the app.
 */
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'
import { transactionModel } from '../models/TransactionModel.js'
import { stockModel } from '../models/StockModel.js'

dotenvConfig({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') })

const url = process.env.PWTEST_DB_URL || ''
if (!url) {
  console.error('PWTEST_DB_URL missing')
  process.exit(1)
}
const dbName = (url.match(/\/([^/?]+)(\?|$)/) || [])[1] || ''
if (!/test/i.test(dbName)) {
  console.error(`Refusing to seed non-test database "${dbName}"`)
  process.exit(1)
}

const email = process.argv[2]
const target = Number(process.argv[3] || 140)
if (!email) {
  console.error('usage: node scripts/seedLedgerPagination.js <email> [targetRecords]')
  process.exit(1)
}

await mongoose.connect(url, { family: 4 })
const user = await mongoose.connection.db.collection('users').findOne({ email })
if (!user) {
  console.error(`no user for ${email}`)
  process.exit(1)
}

// Reuse genuine stored quotes so the rows carry real prices.
const stocks = await stockModel.find({}, 'symbol price name').lean()
const priceFor = (symbol) => {
  const hit = stocks.find((s) => s.symbol === symbol)
  const price = Number(hit?.price)
  return Number.isFinite(price) && price > 0 ? price : 100
}

const symbols = ['AAPL', 'MSFT', 'NVDA', 'KO', 'TSLA', 'ABT', 'ADBE', 'CRM', 'JPM', 'WMT']
const existing = await transactionModel.countDocuments({ userId: user._id })
const toCreate = Math.max(0, target - existing)
if (toCreate === 0) {
  console.log(`user already has ${existing} transactions; nothing to add`)
  process.exit(0)
}

// Spread timestamps backwards across ~9 months so date grouping is exercised
// with real gaps, and so the ordering has many distinct createdAt values.
const now = Date.now()
const spanMs = 240 * 24 * 60 * 60 * 1000
const docs = []
for (let i = 0; i < toCreate; i++) {
  const type = i % 3 === 2 ? 'SELL' : 'BUY'
  const symbol = symbols[i % symbols.length]
  const quantity = (i % 5) + 1
  const price = Number(priceFor(symbol).toFixed(2))
  docs.push({
    userId: user._id,
    type,
    symbol,
    quantity,
    price,
    total: Number((price * quantity).toFixed(2)),
    balanceBefore: 100000,
    balanceAfter: 100000,
    // The schema is strict:'throw', so only real fields here. `status` is not a
    // transaction field; the UI renders 'COMPLETED' for these.
    source: 'MANUAL',
    idempotencyKey: `pageseed-${user._id}-${i}`,
    createdAt: new Date(now - Math.floor((i / toCreate) * spanMs))
  })
}
await transactionModel.insertMany(docs)
const total = await transactionModel.countDocuments({ userId: user._id })
console.log(`added ${docs.length} transactions; user now has ${total}`)
await mongoose.disconnect()