// Regression coverage for the unusable-order defect (Oct 2026):
// "Quote refresh throttled — retry shortly" left users unable to buy or
// sell at all.
//
// Root cause: the background sync ran every 5 minutes while the execution
// gate requires a quote verified within 5 minutes, so quotes expired at
// almost exactly the moment the next sync was due. The ticket's manual
// Refresh button then hit a 30-second client throttle, dead-ending the
// flow.
//
// These tests pin the self-healing execution path: a non-executable cached
// quote triggers exactly one bounded refresh, and the order only proceeds if
// the refreshed row passes the same gate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { isExecutableQuote } from '../services/quotePolicy.js'
import {
  refreshSymbolForExecution,
  executionRefreshAllowed,
  rememberExecutionRefresh,
  EXECUTION_REFRESH_COOLDOWN_MS
} from '../services/quoteRefresh.js'

const now = Date.now()
const fresh = {
  symbol: 'AAPL',
  source: 'yahoo',
  price: 100,
  stale: false,
  marketState: 'REGULAR',
  providerTime: new Date(now),
  lastVerifiedAt: new Date(now)
}

// Load tradeService with every import stripped and injectable doubles, the
// same isolation the existing execution tests use.
function service({ claim = null, stored, providerQuote = null } = {}) {
  const state = {
    stored: { ...stored },
    lookups: 0,
    refreshes: 0,
    providerCalls: [],
    providerQuote
  }
  const code = readFileSync(new URL('../services/tradeService.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/export /g, '')
  const context = vm.createContext({
    YahooFinance: function () {
      return { quote: (sym) => { state.providerCalls.push(sym); return state.providerQuote } }
    },
    isExecutableQuote,
    // The REAL function, counted but not replaced. An earlier version of this
    // test substituted a hand-written stand-in, which meant it asserted the
    // stub's behaviour: two genuine defects (a string passed where a base
    // object was expected, and a fetcher invoked with no argument) shipped
    // while this test stayed green.
    refreshSymbolForExecution: async (...args) => {
      state.refreshes++
      return refreshSymbolForExecution(...args)
    },
    setTimeout,
    stockModel: {
      findOne: () => { state.lookups++; return { lean: async () => state.stored } },
      updateOne: async (_f, u) => { state.stored = { ...u.$set } }
    },
    idempotencyKeyModel: {
      findOne: () => ({ lean: async () => claim }),
      findOneAndUpdate: () => { throw new Error('unexpected claim') }
    },
    state
  })
  vm.runInContext(`${code}\nthis.execute = executePaperTrade`, context)
  return { execute: context.execute, state }
}

test('stale cached quote refreshes once and the order clears the gate', async () => {
  const stale = { ...fresh, providerTime: new Date(now - 400000), lastVerifiedAt: new Date(now - 400000) }
  const s = service({
    stored: stale,
    providerQuote: [{
      symbol: 'AAPL',
      shortName: 'Apple',
      regularMarketPrice: 101,
      regularMarketTime: new Date(Date.now() - 60_000),
      marketState: 'POSTPOST'
    }]
  })
  // Downstream transaction machinery is stubbed out, so the fill cannot
  // complete. What is asserted is the gate: a 409 would mean the refresh
  // failed to produce executable data. Any other failure means it passed.
  let gateError = null
  await s.execute({ userId: 'u', symbol: 'AAPL', quantity: 1, side: 'BUY' }).catch((e) => { gateError = e })
  assert.equal(s.state.refreshes, 1, 'exactly one refresh attempt')
  assert.notEqual(gateError?.statusCode, 409, `gate rejected the order: ${gateError?.message}`)
  // The refreshed row was persisted and is itself executable.
  assert.equal(s.state.stored.price, 101)
  assert.equal(s.state.stored.marketState, 'POSTPOST')
  assert.deepEqual(s.state.providerCalls, ['AAPL'], 'the provider must be reached')
  assert.equal(isExecutableQuote(s.state.stored, 'AAPL'), true)
})

test('unusable provider data still rejects the order', async () => {
  // A fresh symbol per test. The shared execution cooldown is module-global,
  // so reusing one symbol here would return before touching the provider and
  // the test would pass without proving anything.
  const stale = { ...fresh, symbol: 'MSFT', providerTime: new Date(now - 400000), lastVerifiedAt: new Date(now - 400000) }
  const s = service({
    stored: stale,
    providerQuote: [{
      symbol: 'MSFT',
      shortName: 'Microsoft',
      regularMarketPrice: 101,
      regularMarketTime: new Date(Date.now() - 400000),
      marketState: 'MYSTERY'
    }]
  })
  await assert.rejects(
    s.execute({ userId: 'u', symbol: 'MSFT', quantity: 1, side: 'BUY' }),
    { statusCode: 409 }
  )
  assert.equal(s.state.refreshes, 1)
  // The provider must actually have been consulted; otherwise this test would
  // still pass if the refresh were short-circuited by the shared cooldown.
  assert.deepEqual(s.state.providerCalls, ['MSFT'], 'the provider must be reached')
  // The stored row must be left exactly as it was — never marked fresh.
  assert.equal(s.state.stored.price, 100, 'stored row untouched on a failed refresh')
  assert.equal(s.state.stored.stale, false)
})

test('a provider outage still rejects the order without touching stored data', async () => {
  const stale = { ...fresh, symbol: 'NVDA', providerTime: new Date(now - 400000), lastVerifiedAt: new Date(now - 400000) }
  const s = service({ stored: stale, providerQuote: null })
  await assert.rejects(
    s.execute({ userId: 'u', symbol: 'NVDA', quantity: 1, side: 'BUY' }),
    { statusCode: 409 }
  )
  assert.equal(s.state.refreshes, 1)
  assert.deepEqual(s.state.providerCalls, ['NVDA'], 'the provider must be reached')
  assert.equal(s.state.stored.providerTime.getTime(), stale.providerTime.getTime())
})

test('execution refresh cooldown is shared per symbol, not per user', () => {
  const symbol = `COOLDOWN-${now}`
  assert.equal(executionRefreshAllowed(symbol, 5000), true)
  rememberExecutionRefresh(symbol, 5000)
  // A different account hitting the same symbol inside the window is blocked:
  // the provider budget is shared.
  assert.equal(executionRefreshAllowed(symbol, 5000 + EXECUTION_REFRESH_COOLDOWN_MS - 1), false)
  assert.equal(executionRefreshAllowed(symbol, 5000 + EXECUTION_REFRESH_COOLDOWN_MS), true)
  // A different symbol is unaffected.
  assert.equal(executionRefreshAllowed(`${symbol}-OTHER`, 5001), true)
})

test('a passed-in stock doc is never refreshed behind the caller', async () => {
  const s = service({ stored: fresh })
  await s.execute({ userId: 'u', symbol: 'AAPL', quantity: 1, side: 'BUY', stock: { ...fresh, stale: true } }).catch(() => {})
  assert.equal(s.state.refreshes, 0, 'caller-supplied docs are validated, not silently replaced')
})