// Direct coverage of `refreshSymbolForExecution` (Oct 2026).
//
// Two defects shipped together in this function and both were invisible to
// the suite, because the only test that touched it substituted a local stub
// for the real export — so it asserted the stub, not the code under test:
//
//   1. `buildVerifiedQuoteRow` was handed a string where it expects a base
//      object, so `!base?.symbol` was always true and it returned null
//      unconditionally — the self-heal never produced a row.
//   2. `deduplicateQuoteRefresh` invoked the fetcher bare
//      (`Promise.resolve().then(fetchQuote)`), passing `undefined`, so the
//      provider was asked for nothing.
//
// Every test below calls the real export.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  refreshSymbolForExecution,
  rememberExecutionRefresh,
  EXECUTION_REFRESH_COOLDOWN_MS,
  EXECUTION_REFRESH_TIMEOUT_MS
} from '../services/quoteRefresh.js'
import { isExecutableQuote } from '../services/quotePolicy.js'

// The cooldown map is module-global, so every test uses its own symbol.
let seq = 0
const uniqueSymbol = () => `SELFHEAL${(seq += 1)}`

const base = (symbol, extra = {}) => ({
  symbol,
  name: `${symbol} Inc.`,
  sector: 'Technology',
  price: 1,
  stale: true,
  source: 'yahoo',
  ...extra
})

const providerQuote = (symbol, extra = {}) => ({
  symbol,
  shortName: `${symbol} Corp`,
  regularMarketPrice: 187.5,
  regularMarketChange: 1.25,
  regularMarketChangePercent: 0.67,
  regularMarketVolume: 1000,
  marketCap: 1000,
  marketState: 'POSTPOST',
  regularMarketTime: new Date(Date.now() - 60 * 60 * 1000),
  ...extra
})

describe('refreshSymbolForExecution', () => {
  it('asks the provider for the symbol it was given', async () => {
    const symbol = uniqueSymbol()
    const seen = []
    const row = await refreshSymbolForExecution(base(symbol), async (s) => {
      seen.push(s)
      return [providerQuote(symbol)]
    })
    assert.deepEqual(seen, [symbol], 'fetcher must receive the symbol, not undefined')
    assert.ok(row, 'a genuine provider quote must produce a row')
  })

  it('builds a row that itself passes the execution gate', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol)])
    assert.ok(row, 'row must exist')
    assert.equal(row.symbol, symbol)
    assert.equal(row.price, 187.5)
    assert.equal(row.source, 'yahoo')
    assert.equal(row.stale, false)
    // The whole point: what comes back is directly fillable.
    assert.equal(isExecutableQuote(row, symbol), true, 'refreshed row must be executable')
  })

  it('carries identity fields across from the superseded row', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol)])
    assert.equal(row.sector, 'Technology', 'sector must survive the refresh')
    assert.match(row.name, /Corp/)
  })

  it('accepts a single-object provider response as well as an array', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(base(symbol), async () => providerQuote(symbol))
    assert.ok(row)
    assert.equal(row.symbol, symbol)
  })

  it('returns null when the provider fails, leaving the stored row alone', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(base(symbol), async () => {
      throw new Error('offline')
    })
    assert.equal(row, null)
  })

  it('returns null when the provider omits the requested symbol', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(base(symbol), async () => [providerQuote('OTHER')])
    assert.equal(row, null, 'a mismatched symbol must never fill')
  })

  it('returns null for an unusable price rather than synthesizing one', async () => {
    for (const price of [0, -1, undefined, '100', Number.NaN]) {
      const symbol = uniqueSymbol()
      const row = await refreshSymbolForExecution(
        base(symbol),
        async () => [providerQuote(symbol, { regularMarketPrice: price })]
      )
      assert.equal(row, null, String(price))
    }
  })

  it('returns null when the session state is unknown', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(
      base(symbol),
      async () => [providerQuote(symbol, { marketState: 'MYSTERY' })]
    )
    assert.equal(row, null)
  })

  it('returns null for a future-dated provider timestamp', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(
      base(symbol),
      async () => [providerQuote(symbol, { regularMarketTime: new Date(Date.now() + 60_000) })]
    )
    assert.equal(row, null)
  })

  it('refuses ancient closed-session data', async () => {
    const symbol = uniqueSymbol()
    const row = await refreshSymbolForExecution(
      base(symbol),
      async () => [providerQuote(symbol, { regularMarketTime: new Date(Date.now() - 8 * 86400000) })]
    )
    assert.equal(row, null)
  })

  it('requires a base with a symbol', async () => {
    assert.equal(await refreshSymbolForExecution(null, async () => []), null)
    assert.equal(await refreshSymbolForExecution({ name: 'no symbol' }, async () => []), null)
  })
})

describe('failure must not spend the shared cooldown', () => {
  // A transient provider error used to burn the cooldown, so every account on
  // that symbol waited 10s and then saw a rate-limit reported as a data
  // failure. The cooldown is now spent only by a verified result.
  it('allows an immediate retry after the provider fails', async () => {
    const symbol = uniqueSymbol()
    assert.equal(await refreshSymbolForExecution(base(symbol), async () => { throw new Error('offline') }), null)
    let calls = 0
    const row = await refreshSymbolForExecution(base(symbol), async () => {
      calls += 1
      return [providerQuote(symbol)]
    })
    assert.ok(row, 'a retry right after a failure must be allowed to reach the provider')
    assert.equal(calls, 1)
  })

  it('allows an immediate retry after unusable provider data', async () => {
    const symbol = uniqueSymbol()
    assert.equal(
      await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol, { marketState: 'MYSTERY' })]),
      null
    )
    const row = await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol)])
    assert.ok(row)
  })

  it('bounds a hung provider instead of blocking the trade queue', async () => {
    const symbol = uniqueSymbol()
    const started = Date.now()
    const row = await refreshSymbolForExecution(base(symbol), () => new Promise(() => {}))
    assert.equal(row, null, 'a hung request must not produce a row')
    assert.ok(Date.now() - started < EXECUTION_REFRESH_TIMEOUT_MS + 2000, 'must give up near the timeout')
  })
})

describe('execution-path cooldown', () => {
  it('blocks a second refresh of the same symbol inside the window', async () => {
    const symbol = uniqueSymbol()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return [providerQuote(symbol)]
    }
    assert.ok(await refreshSymbolForExecution(base(symbol), fetcher), 'first call refreshes')
    assert.equal(await refreshSymbolForExecution(base(symbol), fetcher), null, 'second is blocked')
    assert.equal(calls, 1, 'the provider must not be hit again inside the window')
  })

  it('allows the same symbol again once the window has passed', async () => {
    const symbol = uniqueSymbol()
    const now = Date.now()
    await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol)], now)
    // Simulate the window having elapsed by remembering at an older instant.
    rememberExecutionRefresh(symbol, now - EXECUTION_REFRESH_COOLDOWN_MS - 1)
    const row = await refreshSymbolForExecution(base(symbol), async () => [providerQuote(symbol)], now)
    assert.ok(row, 'an elapsed cooldown must permit a genuine retry')
  })

  it('does not let one symbol block another', async () => {
    const a = uniqueSymbol()
    const b = uniqueSymbol()
    await refreshSymbolForExecution(base(a), async () => [providerQuote(a)])
    const row = await refreshSymbolForExecution(base(b), async () => [providerQuote(b)])
    assert.ok(row)
  })
})