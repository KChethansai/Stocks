// Regression coverage for the history-cache policy (key isolation, TTLs,
// freshness edge cases). Run: npm run test:unit (node --test, zero new deps).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  historyCacheKey,
  historyTtlMs,
  isHistoryFresh,
  INTRADAY_TTL_MS,
  DAILY_TTL_MS,
} from './historyCachePolicy.js'

describe('historyCacheKey', () => {
  it('isolates symbol and range (case-insensitive range)', () => {
    assert.equal(historyCacheKey('NVDA', 'ALL'), 'NVDA|ALL')
    assert.equal(historyCacheKey('NVDA', 'all'), 'NVDA|ALL')
    assert.notEqual(historyCacheKey('NVDA', 'ALL'), historyCacheKey('AAPL', 'ALL'))
    assert.notEqual(historyCacheKey('NVDA', 'ALL'), historyCacheKey('NVDA', '1D'))
  })
})

describe('historyTtlMs', () => {
  it('uses 15m intraday and 1h daily', () => {
    assert.equal(historyTtlMs('1D'), INTRADAY_TTL_MS)
    assert.equal(historyTtlMs('1d'), INTRADAY_TTL_MS)
    assert.equal(historyTtlMs('ALL'), DAILY_TTL_MS)
    assert.equal(historyTtlMs('3M'), DAILY_TTL_MS)
  })
})

describe('isHistoryFresh', () => {
  const NOW = 1_700_000_000_000
  const entry = (fetchedAt) => ({ data: [1, 2, 3], fetchedAt })

  it('accepts fresh entries and rejects expired ones per range', () => {
    assert.equal(isHistoryFresh(entry(NOW - 5 * 60 * 1000), 'ALL', NOW), true)
    assert.equal(isHistoryFresh(entry(NOW - 61 * 60 * 1000), 'ALL', NOW), false)
    assert.equal(isHistoryFresh(entry(NOW - 5 * 60 * 1000), '1D', NOW), true)
    assert.equal(isHistoryFresh(entry(NOW - 16 * 60 * 1000), '1D', NOW), false)
  })

  it('rejects missing, malformed, and future-dated entries (never false-fresh)', () => {
    assert.equal(isHistoryFresh(null, 'ALL', NOW), false)
    assert.equal(isHistoryFresh(undefined, '1D', NOW), false)
    assert.equal(isHistoryFresh({ data: [] }, 'ALL', NOW), false)
    assert.equal(isHistoryFresh({ data: [], fetchedAt: 0 }, 'ALL', NOW), false)
    assert.equal(isHistoryFresh({ data: [], fetchedAt: 'abc' }, 'ALL', NOW), false)
    assert.equal(isHistoryFresh({ data: [] }, 'ALL', NOW), false)
    // Clock skew must not grant freshness.
    assert.equal(isHistoryFresh(entry(NOW + 60 * 1000), 'ALL', NOW), false)
    // Non-array payloads are not chartable.
    assert.equal(isHistoryFresh({ data: null, fetchedAt: NOW - 1000 }, 'ALL', NOW), false)
  })
})
