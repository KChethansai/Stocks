import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { isExecutableQuote } from '../services/quotePolicy.js'

const now = Date.now()
const fresh = { symbol: 'AAPL', source: 'yahoo', price: 100, stale: false, marketState: 'REGULAR', providerTime: new Date(now), lastVerifiedAt: new Date(now) }

test('execution policy fails closed, including legacy rows and exact cadence boundary', () => {
  assert.equal(isExecutableQuote(fresh, 'AAPL', now), true)
  assert.equal(isExecutableQuote({ ...fresh, providerTime: new Date(now - 300000) }, 'AAPL', now), true)
  for (const patch of [{ source: undefined }, { source: 'synthetic' }, { stale: true }, { price: '100' }, { price: Infinity }, { price: 0 }, { marketState: undefined }, { marketState: 'CLOSED' }, { providerTime: null }, { providerTime: 'bad' }, { providerTime: new Date(now + 1) }, { providerTime: new Date(now - 300001) }, { lastVerifiedAt: null }, { lastVerifiedAt: 'bad' }, { symbol: 'MSFT' }]) {
    assert.equal(isExecutableQuote({ ...fresh, ...patch }, 'AAPL', now), false, JSON.stringify(patch))
  }
})

function service(claim = null) {
  let claims = 0
  const code = readFileSync(new URL('../services/tradeService.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replace(/export /g, '')
  const context = vm.createContext({ isExecutableQuote, setTimeout, stockModel: { findOne() { throw new Error('quote lookup must not run on replay') } }, idempotencyKeyModel: { findOne: () => ({ lean: async () => claim }), findOneAndUpdate() { claims++; throw new Error('unexpected claim') } } })
  vm.runInContext(`${code}\nthis.execute = executePaperTrade`, context)
  return { execute: context.execute, claims: () => claims }
}

test('completed replay returns original receipt before checking a now-stale quote', async () => {
  const receipt = { price: 42, total: 84 }
  const s = service({ symbol: 'AAPL', side: 'BUY', quantity: 2, status: 'completed', response: receipt })
  const result = await s.execute({ userId: 'user', symbol: 'AAPL', quantity: 2, side: 'BUY', stock: { ...fresh, stale: true }, idempotencyKey: 'test-key-123' })
  assert.equal(result, receipt)
  await assert.rejects(s.execute({ userId: 'user', symbol: 'AAPL', quantity: 3, side: 'BUY', idempotencyKey: 'test-key-123' }), { statusCode: 409 })
  assert.equal(s.claims(), 0)
})

test('quote validation fails before reserving a new idempotency key for either source', async () => {
  for (const source of ['MANUAL', 'AUTOMATION']) {
    for (const patch of [{ providerTime: new Date(now - 300001) }, { source: undefined }, { lastVerifiedAt: null }, { marketState: undefined }, { marketState: 'CLOSED' }, { price: Infinity }, { symbol: 'MSFT' }]) {
      const s = service()
      await assert.rejects(s.execute({ userId: 'user', symbol: 'AAPL', quantity: 2, side: 'BUY', source, stock: { ...fresh, ...patch }, idempotencyKey: 'test-key-123' }), { statusCode: 409 })
      assert.equal(s.claims(), 0)
    }
  }
})
