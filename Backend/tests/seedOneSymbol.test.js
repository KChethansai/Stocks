// Failure-branch coverage for the seed: provider failure, partial results,
// and unreachable symbols must never create fabricated records labeled as
// verified Yahoo data. Uses stub provider + capturing stub models (no DB).
// Run: npm run test:unit (node --test, zero new dependencies).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { seedOneSymbol } from '../scripts/seedOneSymbol.js'

const base = { symbol: 'TST', name: 'Test Inc.', sector: 'Technology' }
const row = (date, close) => ({ date, open: close - 1, high: close + 1, low: close - 2, close, volume: 1000 })
const rows = (n, start = 100) => Array.from({ length: n }, (_, i) => row(new Date(Date.now() - i * 86400000), start + i))

function stubModels() {
  const calls = []
  const model = (name) => ({
    updateOne: async (filter, update, opts) => {
      calls.push({ model: name, filter, update, opts })
      return { acknowledged: true }
    },
  })
  return {
    calls,
    stockModel: model('stocks'),
    historyModel: model('histories'),
    intradayHistoryModel: model('intraday'),
  }
}

const liveYahoo = (over = {}) => ({
  quote: async () => [{ symbol: 'TST', regularMarketPrice: 150.5, regularMarketTime: new Date(), ...over.quote }],
  chart: async () => ({ quotes: rows(10) }),
})

describe('seedOneSymbol success path', () => {
  it('writes source yahoo + stale:false with provider rows', async () => {
    const m = stubModels()
    const res = await seedOneSymbol({ base, yahoo: liveYahoo(), ...m })
    assert.equal(res.outcome, 'live')
    const stock = m.calls.find((c) => c.model === 'stocks')
    assert.equal(stock.update.$set.source, 'yahoo')
    assert.equal(stock.update.$set.stale, false)
    assert.equal(stock.update.$set.price, 150.5)
    assert.equal(stock.opts.upsert, true)
    assert.equal(m.calls.find((c) => c.model === 'histories').update.$set.data.length, 10)
  })
})

describe('seedOneSymbol failure branches (no fabrication)', () => {
  it('provider throw marks stale with upsert:false and writes no history', async () => {
    const m = stubModels()
    const yahoo = { quote: async () => { throw new Error('socket hangup') }, chart: async () => ({ quotes: rows(10) }) }
    const res = await seedOneSymbol({ base, yahoo, ...m })
    assert.equal(res.outcome, 'stale-marked')
    assert.equal(m.calls.length, 1)
    const [only] = m.calls
    assert.equal(only.model, 'stocks')
    assert.deepEqual(only.update, { $set: { source: 'seed', stale: true } })
    assert.equal(only.opts.upsert, false)
    assert.ok(!('price' in (only.update.$set || {})), 'failure path must not set a price')
  })

  it('zero price is treated as unusable (not a verified quote)', async () => {
    const m = stubModels()
    const res = await seedOneSymbol({ base, yahoo: liveYahoo({ quote: { regularMarketPrice: 0 } }), ...m })
    assert.equal(res.outcome, 'stale-marked')
    assert.ok(m.calls.every((c) => c.opts.upsert === false))
  })

  it('thin history (<5 rows) is treated as partial and never verified', async () => {
    const m = stubModels()
    const yahoo = { ...liveYahoo(), chart: async () => ({ quotes: rows(2) }) }
    const res = await seedOneSymbol({ base, yahoo, ...m })
    assert.equal(res.outcome, 'stale-marked')
    assert.ok(m.calls.every((c) => c.opts.upsert === false))
  })

  it('empty quote array is treated as unreachable', async () => {
    const m = stubModels()
    const yahoo = { ...liveYahoo(), quote: async () => [] }
    const res = await seedOneSymbol({ base, yahoo, ...m })
    assert.equal(res.outcome, 'stale-marked')
  })
})
