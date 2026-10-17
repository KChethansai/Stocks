// Provider fetch resilience (Oct 2026).
//
// A transient provider blip surfaced to the user as "Live market data is
// unavailable right now" with no retry and no indication of cause. These pin
// the bounded retry, the classification that separates "rate limited, wait"
// from "provider down", and the rule that a non-transient failure is never
// retried (a bad symbol fails identically every time).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyProviderError, fetchQuoteWithRetry } from '../services/quoteRefresh.js'

const symbol = 'ZZRETRY'
// Each test needs its own symbol: deduplication is keyed by symbol.
let seq = 0
const sym = () => `${symbol}${(seq += 1)}`

describe('classifyProviderError', () => {
  it('recognises rate limiting and marks it retryable', () => {
    for (const err of [
      Object.assign(new Error('Too Many Requests'), { status: 429 }),
      new Error('Yahoo Finance returned 429'),
      new Error('rate limit exceeded')
    ]) {
      const kind = classifyProviderError(err)
      assert.equal(kind.kind, 'rate-limited', err.message)
      assert.equal(kind.retryable, true)
    }
  })

  it('recognises timeouts and transport failures as transient', () => {
    for (const err of [
      new Error('QuoteProviderTimeout'),
      new Error('socket hang up'),
      new Error('fetch failed'),
      new Error('read ECONNRESET')
    ]) {
      assert.equal(classifyProviderError(err).retryable, true, err.message)
    }
  })

  it('recognises provider 5xx as transient', () => {
    const err = Object.assign(new Error('upstream'), { status: 503 })
    assert.equal(classifyProviderError(err).kind, 'provider-error')
    assert.equal(classifyProviderError(err).retryable, true)
  })

  it('does not retry a non-transient client error', () => {
    const err = Object.assign(new Error('invalid symbol'), { status: 404 })
    assert.equal(classifyProviderError(err).kind, 'client-error')
    assert.equal(classifyProviderError(err).retryable, false)
  })
})

describe('fetchQuoteWithRetry', () => {
  it('returns immediately when the first attempt succeeds', async () => {
    let calls = 0
    const out = await fetchQuoteWithRetry(sym(), async () => {
      calls += 1
      return [{ symbol: 'AAPL' }]
    })
    assert.equal(calls, 1, 'a healthy provider must not pay for a retry')
    assert.equal(out[0].symbol, 'AAPL')
  })

  it('recovers from one transient failure without surfacing an error', async () => {
    let calls = 0
    const out = await fetchQuoteWithRetry(
      sym(),
      async () => {
        calls += 1
        if (calls === 1) throw new Error('fetch failed')
        return [{ symbol: 'AAPL' }]
      },
      { backoffMs: 1 }
    )
    assert.equal(calls, 2)
    assert.equal(out[0].symbol, 'AAPL')
  })

  it('throws with the classification once every attempt fails', async () => {
    const attempts = { n: 0 }
    await assert.rejects(
      fetchQuoteWithRetry(
        sym(),
        async () => {
          attempts.n += 1
          throw Object.assign(new Error('Too Many Requests'), { status: 429 })
        },
        { backoffMs: 1 }
      ),
      (err) => {
        assert.equal(err.quoteFailure, 'rate-limited', 'the cause must reach the caller')
        return true
      }
    )
    assert.equal(attempts.n, 2, 'exactly one retry, then give up')
  })

  it('never retries a non-transient failure', async () => {
    const attempts = { n: 0 }
    await assert.rejects(
      fetchQuoteWithRetry(
        sym(),
        async () => {
          attempts.n += 1
          throw Object.assign(new Error('invalid symbol'), { status: 404 })
        },
        { backoffMs: 1 }
      ),
      (err) => {
        assert.equal(err.quoteFailure, 'client-error')
        return true
      }
    )
    assert.equal(attempts.n, 1, 'a 404 must not be retried')
  })

  it('gives up on a hung provider instead of blocking', async () => {
    const started = Date.now()
    await assert.rejects(fetchQuoteWithRetry(sym(), () => new Promise(() => {}), {
      attempts: 2,
      timeoutMs: 150,
      backoffMs: 1
    }))
    assert.ok(Date.now() - started < 3000, 'must not hang past the timeout budget')
  })
})