/* Playwright-test seed: verified quotes + history cache on an isolated DB.
 * Usage: PWTEST_DB_URL=<isolated mongo url> node scripts/seedPwTest.js
 * Only writes to the URL given; refuses to run against a DB whose name looks
 * like production (no 'test' in the db name). Safe by construction: the
 * caller supplies the isolated URL.
 *
 * Data-integrity rule (Oct 2026): this script NEVER fabricates prices. All
 * quotes and history come from live Yahoo Finance at seed time and are stored
 * with source 'yahoo'. If Yahoo is unreachable for a symbol, the script keeps
 * any existing record and marks it stale + unverified (source 'seed') so the
 * UI labels it honestly and trading safeguards keep rejecting it. An earlier
 * version wrote linear-ramp fixtures labeled as yahoo; that poisoned the
 * history cache for 24h per seed and caused the quote/history divergence.
 */
import mongoose from 'mongoose'
import YahooFinance from 'yahoo-finance2'
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: path.join(__dirname, '../.env') })

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

// Full guard BEFORE connecting: the equality check against the app's own
// DB_URL must run before any connection exists (a refused target must never
// even be dialed). Needs only env, not models.
const { getSeedGuardDecision } = await import('../config/seedGuard.js')
const decision = getSeedGuardDecision(url, process.env.DB_URL || '')
if (!decision.ok) {
  console.error(decision.reason)
  process.exit(1)
}

await mongoose.connect(url, { family: 4 })
const { stockModel } = await import('../models/StockModel.js')
const { historyModel, intradayHistoryModel } = await import('../models/HistoryModel.js')
const { baseStocks } = await import('../config/universe.js')
const { seedOneSymbol } = await import('./seedOneSymbol.js')

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
const now = new Date()

let live = 0
let marked = 0
for (const base of baseStocks) {
  const res = await seedOneSymbol({ base, yahoo, stockModel, historyModel, intradayHistoryModel, now })
  if (res.outcome === 'live') {
    live += 1
  } else {
    console.error(`seed: ${res.symbol} unreachable (${res.reason}) — marked stale, no data written`)
    marked += 1
  }
}
console.log(`seeded ${live} live + ${marked} stale-marked symbols into ${decision.dbName}`)
await mongoose.disconnect()
if (marked > 0) process.exitCode = 2
