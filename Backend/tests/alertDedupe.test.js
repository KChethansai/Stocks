import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { predictionEventKey, writeAlertOnce } from '../services/alertDedupe.js'
import { checkPriceTriggers } from '../services/priceMonitor.js'
import { stockModel } from '../models/StockModel.js'
import { priceAlertModel } from '../models/PriceAlertModel.js'
import { alertModel } from '../models/AlertModel.js'

describe('source-event notifications', () => {
  const rule = { _id: 'r1', userId: 'u1', symbol: 'AAPL' }
  const prediction = { asOf: '2026-10-16T12:00:00Z', model: 'm1', direction: 'UP', horizon: 1 }

  it('keeps user, rule, observation and model identities separate', () => {
    const key = predictionEventKey(rule, prediction)
    assert.equal(key, predictionEventKey(rule, { ...prediction }))
    for (const other of [{ ...rule, _id: 'r2' }, { ...rule, userId: 'u2' }]) {
      assert.notEqual(key, predictionEventKey(other, prediction))
    }
    for (const other of [{ ...prediction, asOf: '2026-10-17' }, { ...prediction, model: 'm2' }]) {
      assert.notEqual(key, predictionEventKey(rule, other))
    }
    assert.throws(() => predictionEventKey(rule, { ...prediction, asOf: null }))
    assert.throws(() => predictionEventKey(rule, { ...prediction, asOf: 'invalid' }))
  })

  it('inserts once across concurrent attempts and reading, but accepts new observations', async () => {
    const rows = new Map()
    const model = {
      async updateOne(query, update) {
        if (rows.has(query.eventKey)) return { upsertedCount: 0 }
        rows.set(query.eventKey, { ...update.$setOnInsert, read: false })
        return { upsertedCount: 1 }
      }
    }
    const eventKey = predictionEventKey(rule, prediction)
    const alert = { userId: 'u1', eventKey, message: 'original' }
    assert.deepEqual(await Promise.all([writeAlertOnce(model, alert), writeAlertOnce(model, alert)]), [true, false])
    rows.get(eventKey).read = true
    assert.equal(await writeAlertOnce(model, { ...alert, message: 'changed' }), false)
    assert.equal(rows.get(eventKey).read, true)
    assert.equal(rows.get(eventKey).message, 'original')
    assert.equal(await writeAlertOnce(model, { ...alert, eventKey: predictionEventKey(rule, { ...prediction, asOf: '2026-10-17' }) }), true)
    assert.equal(rows.size, 2)
  })

  it('handles unique-index races without hiding other failures', async () => {
    assert.equal(await writeAlertOnce({ updateOne: async () => { throw { code: 11000 } } }, { userId: 'u', eventKey: 'e' }), false)
    await assert.rejects(writeAlertOnce({ updateOne: async () => { throw new Error('offline') } }, { userId: 'u', eventKey: 'e' }), /offline/)
  })
})

it('price alerts keep their claim exclusive and release it after a failed inbox write', async (t) => {
  const definition = { _id: 'p1', userId: 'u1', symbol: 'AAPL', direction: 'ABOVE', targetPrice: 100 }
  let claimed = false
  let fail = true
  const rows = new Map()
  t.mock.method(priceAlertModel, 'find', () => ({ lean: async () => [definition] }))
  t.mock.method(stockModel, 'find', () => ({ select: () => ({ lean: async () => [{ symbol: 'AAPL', price: 110, source: 'yahoo', lastVerifiedAt: new Date(), stale: false }] }) }))
  t.mock.method(priceAlertModel, 'findOneAndUpdate', async () => {
    if (claimed) return null
    claimed = true
    return { ...definition, triggeredAt: new Date('2026-10-16') }
  })
  t.mock.method(priceAlertModel, 'updateOne', async () => { claimed = false })
  t.mock.method(alertModel, 'updateOne', async (query, update) => {
    if (fail) throw new Error('inbox unavailable')
    if (rows.has(query.eventKey)) return { upsertedCount: 0 }
    rows.set(query.eventKey, update.$setOnInsert)
    return { upsertedCount: 1 }
  })
  assert.equal((await checkPriceTriggers()).fired, 0)
  assert.equal(claimed, false)
  fail = false
  const results = await Promise.all([checkPriceTriggers(), checkPriceTriggers()])
  assert.equal(results.reduce((sum, result) => sum + result.fired, 0), 1)
  assert.equal(rows.size, 1)
  assert.equal(rows.get('price:p1').userId, 'u1')
})
