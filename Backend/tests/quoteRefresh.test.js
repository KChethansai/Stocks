// Regression tests for the stale-quote rejection root cause (Oct 2026).
// The ticket gate blocks buys on stale/unverified rows, but no ticket-level
// refresh existed — GET /stocks only background-syncs and POST /stocks/seed
// is throttled. POST /stock-api/quote/:symbol/refresh closes that gap.
// These tests pin the pure building blocks: verified-row construction (never
// synthetic, never fresh-marked failures) and the per-user throttle.
// Run: npm run test:unit (node --test, zero new dependencies).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { buildVerifiedQuoteRow, refreshAllowed, rememberRefresh, deduplicateQuoteRefresh, QUOTE_REFRESH_THROTTLE_MS } from '../services/quoteRefresh.js'
import { isExecutableQuote } from '../services/quotePolicy.js'

const base = { symbol: 'TST', name: 'Test Inc.', sector: 'Technology' }
const liveQuote = (over = {}) => ({
  symbol: 'TST',
  marketState: 'REGULAR',
  shortName: 'Test Inc.',
  regularMarketPrice: 150.5,
  regularMarketChange: 1.2,
  regularMarketChangePercent: 0.8,
  regularMarketVolume: 1000000,
  marketCap: 5000000000,
  regularMarketTime: new Date('2026-10-16T12:00:00Z'),
  ...over
})

const now = new Date('2026-10-16T12:01:00Z')
const build = (quote) => buildVerifiedQuoteRow(base, quote, now)

describe('buildVerifiedQuoteRow', () => {
  it('builds a verified row from a usable provider quote', () => {
    const row = build(liveQuote())
    assert.equal(row.symbol, 'TST')
    assert.equal(row.price, 150.5)
    assert.equal(row.source, 'yahoo')
    assert.equal(row.stale, false)
    assert.ok(row.lastVerifiedAt instanceof Date)
    assert.ok(row.asOf instanceof Date)
    assert.ok(row.providerTime instanceof Date)
    assert.equal(row.asOf.toISOString(), '2026-10-16T12:00:00.000Z')
    assert.equal(row.lastVerifiedAt.toISOString(), now.toISOString())
  })

  it('accepts epoch-seconds and epoch-millis provider timestamps', () => {
    const s = buildVerifiedQuoteRow(base, liveQuote({ regularMarketTime: 1760616000 }), new Date('2025-10-16T12:01:00Z'))
    assert.equal(s.providerTime.toISOString(), '2025-10-16T12:00:00.000Z')
    const ms = buildVerifiedQuoteRow(base, liveQuote({ regularMarketTime: 1760616000000 }), new Date('2025-10-16T12:01:00Z'))
    assert.equal(ms.providerTime.toISOString(), '2025-10-16T12:00:00.000Z')
  })

  it('rejects a previous-session close instead of marking it fresh', () => {
    const before = new Date('2026-10-15T20:00:00Z')
    const row = buildVerifiedQuoteRow(base, liveQuote({ regularMarketTime: before }), new Date('2026-10-16T12:00:00Z'))
    assert.equal(row, null)
  })

  it('returns null for zero/missing prices — failures never become fresh rows', () => {
    assert.equal(buildVerifiedQuoteRow(base, liveQuote({ regularMarketPrice: 0 })), null)
    assert.equal(buildVerifiedQuoteRow(base, liveQuote({ regularMarketPrice: undefined })), null)
    assert.equal(buildVerifiedQuoteRow(base, null), null)
    assert.equal(buildVerifiedQuoteRow(base, {}), null)
  })

  it('falls back to stored name when the provider omits it', () => {
    const row = build(liveQuote({ shortName: undefined, longName: undefined }))
    assert.equal(row.name, 'Test Inc.')
  })

  it('rejects missing, invalid, future timestamps without mutating inputs', () => {
    for (const regularMarketTime of [undefined, null, '', 'bad', new Date(NaN), Infinity, 0, new Date('2026-10-16T12:02:00Z')]) {
      const quote = liveQuote({ regularMarketTime })
      const before = { ...quote }
      assert.equal(build(quote), null)
      assert.deepEqual(quote, before)
    }
  })

  it('requires an exact symbol and an actual finite numeric price', () => {
    for (const symbol of ['OTHER', undefined, 'tst']) assert.equal(build(liveQuote({ symbol })), null)
    for (const regularMarketPrice of ['150', true, Infinity, NaN, -1]) assert.equal(build(liveQuote({ regularMarketPrice })), null)
    assert.equal(build(null), null)
  })

  it('accepts a genuine bounded last close outside REGULAR, rejects unknown state', () => {
    // Closed sessions carry the authoritative last close and must stay
    // refreshable, otherwise a weekend refresh is impossible
    // (see quotePolicy.test.js).
    for (const marketState of ['CLOSED', 'PRE', 'POST', 'POSTPOST', 'PREPRE']) {
      assert.ok(build(liveQuote({ marketState })), marketState)
    }
    for (const marketState of ['UNKNOWN', 'WAT', undefined, null, '']) {
      assert.equal(build(liveQuote({ marketState })), null, String(marketState))
    }
    // Even a closed session refuses ancient data.
    assert.equal(build(liveQuote({ marketState: 'CLOSED', regularMarketTime: new Date(Date.now() - 8 * 86400000) })), null)
  })
})

describe('refreshAllowed throttle', () => {
  it('deduplicates pending same-symbol requests and releases failures', async () => {
    let calls = 0
    let release
    const fetch = () => { calls++; return new Promise((resolve) => { release = resolve }) }
    const first = deduplicateQuoteRefresh('TST', fetch)
    const second = deduplicateQuoteRefresh('TST', fetch)
    await Promise.resolve()
    release('quote')
    assert.deepEqual(await Promise.all([first, second]), ['quote', 'quote'])
    assert.equal(calls, 1)
    await assert.rejects(deduplicateQuoteRefresh('TST', () => { throw new Error('offline') }))
    assert.equal(await deduplicateQuoteRefresh('TST', () => 'recovered'), 'recovered')
  })
  it('allows the first refresh, throttles an immediate repeat, allows after the window', () => {
    const key = `u-throttle-${Date.now()}`
    assert.equal(refreshAllowed(key, 1000000).ok, true)
    rememberRefresh(key, 1000000)
    const blocked = refreshAllowed(key, 1000000 + 1000)
    assert.equal(blocked.ok, false)
    assert.ok(blocked.retryAfterMs > 0)
    assert.equal(refreshAllowed(key, 1000000 + QUOTE_REFRESH_THROTTLE_MS + 1).ok, true)
  })

  it('scopes the throttle per user+symbol key', () => {
    const t = 2000000
    rememberRefresh(`u-a:SYM-${t}`, t)
    assert.equal(refreshAllowed(`u-b:SYM-${t}`, t).ok, true)
    assert.equal(refreshAllowed(`u-a:OTHER-${t}`, t).ok, true)
  })
})

describe('quote recovery route persistence', () => {
  it('preserves good rows for missing, mismatched, closed and invalid quotes', async () => {
    const source = readFileSync(new URL('../APIs/StockAPI.js', import.meta.url), 'utf8')
    const route = source.slice(source.indexOf("stockApp.post('/quote/:symbol/refresh'"), source.indexOf('// Sync Control'))
    // Failures must preserve the stored row. A genuine bounded CLOSED-session
    // quote is no longer a failure, so it is covered as a success above.
    for (const quote of [undefined, [liveQuote({ symbol: 'OTHER' })], liveQuote({ marketState: 'UNKNOWN' }), liveQuote({ regularMarketTime: undefined }), liveQuote({ regularMarketPrice: 0 })]) {
      let handler
      let writes = 0
      const existing = Object.freeze({ ...base, price: 99, source: 'yahoo', stale: false })
      const context = {
        stockApp: { post: (_path, _auth, callback) => { handler = callback } },
        verifyToken: () => () => {}, baseStocks: [base],
        stockModel: {
          findOne: () => ({ lean: async () => existing }),
          updateOne: async () => { writes++ }
        },
        refreshAllowed: () => ({ ok: true }), rememberRefresh: () => {},
        deduplicateQuoteRefresh, yahooFinance: { quote: async () => quote },
        buildVerifiedQuoteRow: (b, q) => buildVerifiedQuoteRow(b, q, now),
        // The route now runs the provider call under the shared budget and
        // re-checks the stored row before reporting a failure, so it needs
        // the real policy and a passthrough budget in scope.
        withProviderBudget: async (attempt) => {
          try {
            return { ok: true, value: await attempt() }
          } catch (error) {
            return { ok: false, reason: 'provider-error', error }
          }
        },
        isExecutableQuote,
        invalidateCache: () => {}, console
      }
      vm.runInNewContext(route, context)
      let status
      const res = { status: (code) => { status = code; return res }, json: (body) => body }
      await handler({ params: { symbol: 'TST' }, user: { id: 'test' } }, res, (err) => { throw err })
      const valid = Boolean(quote?.regularMarketTime) && quote?.regularMarketPrice > 0
        && (quote?.marketState === 'REGULAR' || quote?.marketState === 'CLOSED' || quote?.marketState === 'POST')
        && (!Array.isArray(quote))
      assert.equal(status, valid ? 200 : 502)
      assert.equal(writes, valid ? 1 : 0)
      assert.equal(existing.price, 99)
    }
  })
})
