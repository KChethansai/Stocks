// Regression coverage for retryImport's bounds (lazyWithRetry shares the
// chain). Run: npm run test:unit (node --test, zero new deps).
// NOTE: this asserts the RETRY COUNT contract only. Whether a retry
// re-hits network is a browser module-map behavior, verified separately in
// the browser (Oct 2026: recorded failures reject from cache; aborts refetch).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { retryImport } from './lazyWithRetry.js'

describe('retryImport', () => {
  it('resolves on first success with a single factory call', async () => {
    let calls = 0
    const mod = await retryImport(async () => { calls += 1; return { default: 42 } }, 2, 5)
    assert.equal(mod.default, 42)
    assert.equal(calls, 1)
  })

  it('rides out transient failures and resolves', async () => {
    let calls = 0
    const mod = await retryImport(async () => {
      calls += 1
      if (calls < 3) throw new Error('blip')
      return { default: 'late' }
    }, 2, 5)
    assert.equal(mod.default, 'late')
    assert.equal(calls, 3)
  })

  it('is bounded: exactly 1 + retries calls, then rejects with the last error', async () => {
    let calls = 0
    await assert.rejects(
      () => retryImport(async () => { calls += 1; throw new Error(`fail${calls}`) }, 2, 5),
      /fail3/
    )
    assert.equal(calls, 3)
  })

  it('zero retries means a single attempt', async () => {
    let calls = 0
    await assert.rejects(() => retryImport(async () => { calls += 1; throw new Error('x') }, 0, 5))
    assert.equal(calls, 1)
  })
})
