// Provider-outage degradation (Oct 2026 production incident).
//
// Production quotes were 18 hours stale with no session state because the
// background sync, on every provider failure, stamped `stale: true` across
// every row. On a weekend that made Friday's genuine close fail the execution
// gate, so orders were rejected against valid data and the UI showed a red
// stale banner. These pin the corrected rule:
//
//   `stale` means "not valid for its own session", NOT "the provider was
//   unreachable when we last checked".
//
// A provider outage must preserve the stored quotes untouched and record the
// outage separately, so the UI can say so honestly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { isExecutableQuote } from '../services/quotePolicy.js'

const route = readFileSync(new URL('../APIs/StockAPI.js', import.meta.url), 'utf8')
const syncSource = route
  .slice(0, route.indexOf('// -----------------------------\n// Initial Sync'))
  .replace(/^import .*$/gm, '')
  .replace(/export /g, '')

// Loads the sync function with the provider forced to fail, and returns what
// it would have written plus the stored rows it left behind.
function degradedSync(storedRows) {
  let handler
  let writes = []
  const context = {
    // The VM realm has its own Date, so `instanceof Date` against the test
    // realm would fail. Use this realm's Date for assertions.
    Date,
    // Module-level scaffolding the sync file evaluates before any function runs.
    exp: { Router: () => ({ get: () => {}, post: () => {} }) },
    mongoose: { Schema: class {}, model: () => ({}) },
    YahooFinance: function () { return this },
    yahooFinance: { quote: async () => { throw Object.assign(new Error('Too Many Requests'), { status: 429 }) } },
    withProviderBudget: async () => ({ ok: false, reason: 'rate-limited', error: new Error('429') }),
    isExecutableQuote,
    toProviderTime: (v) => (v instanceof Date ? v : new Date(v)),
    baseStocks: [],
    verifyToken: () => () => {},
    stockApp: { get: () => {}, post: () => {} },
    invalidateCache: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    stockModel: {
      find: () => ({ lean: async () => storedRows }),
      bulkWrite: async (ops) => { writes = ops }
    },
    setInterval: () => {},
    setTimeout: () => {}
  }
  vm.runInNewContext(`${syncSource}\nthis.sync = syncStocksData`, context)
  return {
    run: async () => {
      await context.sync(true)
      return writes
    }
  }
}

const row = (over = {}) => ({
  symbol: 'KO',
  price: 93.9,
  source: 'yahoo',
  stale: false,
  marketState: 'POSTPOST',
  providerTime: new Date(Date.now() - 60 * 60 * 1000),
  lastVerifiedAt: new Date(Date.now() - 60 * 60 * 1000),
  ...over
})

test('a provider outage does NOT invalidate a genuine last close', async () => {
  // Friday's close on a Saturday: valid for its session, so still usable.
  const stored = row()
  const writes = await degradedSync([stored]).run()
  assert.equal(writes.length, 1)
  assert.equal(
    writes[0].updateOne.update.$set.stale,
    false,
    'a bounded closed-session close stays usable during an outage'
  )
})

test('a provider outage still fails closed on a row with no session state', async () => {
  // The legacy rows that caused the incident: no marketState at all.
  const stored = row({ marketState: undefined })
  const writes = await degradedSync([stored]).run()
  assert.equal(writes[0].updateOne.update.$set.stale, true, 'unknown session must fail closed')
})

test('a provider outage never touches a price', async () => {
  const stored = row({ price: 93.9 })
  const writes = await degradedSync([stored]).run()
  const set = writes[0].updateOne.update.$set
  assert.equal(set.price, undefined, 'the sync must not write prices at all during an outage')
  assert.ok(set.providerUnavailableAt instanceof Date, 'the outage is recorded separately')
})

test('an ancient closed quote still fails closed during an outage', async () => {
  const stored = row({
    providerTime: new Date(Date.now() - 30 * 86400_000),
    lastVerifiedAt: new Date(Date.now() - 30 * 86400_000)
  })
  const writes = await degradedSync([stored]).run()
  assert.equal(writes[0].updateOne.update.$set.stale, true)
})

test('the outage flag is separate from staleness, so the UI can tell them apart', async () => {
  const stored = row()
  const writes = await degradedSync([stored]).run()
  const set = writes[0].updateOne.update.$set
  assert.equal(set.stale, false, 'valid data stays usable')
  assert.ok(set.providerUnavailableAt, 'but the outage is still reported to the UI')
})