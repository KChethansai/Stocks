// Execution-policy coverage (Oct 2026).
//
// The regression this pins: a REGULAR-only rule made EVERY paper order fail
// outside regular trading hours (evenings, weekends), because the provider
// reports POSTPOST with Friday's close. A simulator must still fill at a
// genuine last close — while never presenting it as a live price, and still
// rejecting unverified or fabricated data in every session.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isExecutableQuote,
  isClosedSessionState,
  QUOTE_FRESH_MAX_AGE_MS,
  MAX_CLOSED_QUOTE_AGE_MS
} from '../services/quotePolicy.js'

const now = Date.now()
const base = {
  symbol: 'AAPL',
  source: 'yahoo',
  price: 100,
  stale: false,
  marketState: 'REGULAR',
  providerTime: new Date(now),
  lastVerifiedAt: new Date(now)
}

test('regular session requires a current quote', () => {
  assert.equal(isExecutableQuote(base, 'AAPL', now), true)
  const atBoundary = new Date(now - QUOTE_FRESH_MAX_AGE_MS)
  assert.equal(isExecutableQuote({ ...base, providerTime: atBoundary, lastVerifiedAt: atBoundary }, 'AAPL', now), true)
  assert.equal(isExecutableQuote({ ...base, providerTime: new Date(now - QUOTE_FRESH_MAX_AGE_MS - 1), lastVerifiedAt: atBoundary }, 'AAPL', now), false)
})

test('closed session fills at a genuine last close (weekends and evenings)', () => {
  for (const state of ['PRE', 'PREPRE', 'POST', 'POSTPOST', 'CLOSED']) {
    const row = {
      ...base,
      marketState: state,
      providerTime: new Date(now - 10 * 60 * 60 * 1000),
      lastVerifiedAt: new Date(now - 10 * 60 * 60 * 1000)
    }
    assert.equal(isExecutableQuote(row, 'AAPL', now), true, state)
  }
  // Friday close on a Saturday still fills.
  assert.equal(
    isExecutableQuote({ ...base, marketState: 'POSTPOST', providerTime: new Date(now - 2 * 24 * 60 * 60 * 1000) }, 'AAPL', now),
    true
  )
})

test('closed session still refuses ancient data', () => {
  const row = { ...base, marketState: 'POSTPOST', providerTime: new Date(now - MAX_CLOSED_QUOTE_AGE_MS - 1000) }
  assert.equal(isExecutableQuote(row, 'AAPL', now), false)
})

test('provenance rules hold in every session', () => {
  const closed = { ...base, marketState: 'POSTPOST', providerTime: new Date(now - 3600000) }
  for (const patch of [
    { source: undefined },
    { source: 'unverified' },
    { stale: true },
    { symbol: 'MSFT' },
    { price: 0 },
    { price: -1 },
    { price: '100' },
    { providerTime: null },
    { providerTime: 'bad' },
    { providerTime: new Date(now + 60000) },
    { lastVerifiedAt: 'bad' }
  ]) {
    assert.equal(isExecutableQuote({ ...closed, ...patch }, 'AAPL', now), false, JSON.stringify(patch))
  }
})

test('unknown session state fails closed', () => {
  for (const state of [undefined, null, '', 'SOMETHING_ELSE']) {
    assert.equal(isExecutableQuote({ ...base, marketState: state, providerTime: new Date(now - 3600000) }, 'AAPL', now), false, String(state))
  }
})

test('session classification is single-sourced', () => {
  assert.equal(isClosedSessionState('POSTPOST'), true)
  assert.equal(isClosedSessionState('REGULAR'), false)
  assert.equal(isClosedSessionState('WEIRD'), false)
  assert.equal(isClosedSessionState(undefined), false)
})
