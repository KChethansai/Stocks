// Single-symbol seed unit — extracted from scripts/seedPwTest.js so the
// success AND failure branches are unit-testable with stubbed provider and
// models (no database required).
//
// Data-integrity contract (tested in tests/seedOneSymbol.test.js):
// - Success writes source 'yahoo' + stale:false with provider rows only.
// - Provider failure, thin data, or zero price writes NO prices and NO
//   history; it only marks an existing quote record stale/unverified
//   (source 'seed', stale:true) with upsert:false, so a missing record is
//   never created and verified data is never overwritten with fixtures.
import { toProviderTime } from '../config/universe.js'

export const normalizeDailyRows = (quotes) =>
  (quotes || [])
    .filter((d) => d.date && d.open && d.high && d.low && d.close)
    .map((d) => ({
      timestamp: new Date(d.date),
      open: Number(Number(d.open).toFixed(2)),
      high: Number(Number(d.high).toFixed(2)),
      low: Number(Number(d.low).toFixed(2)),
      close: Number(Number(d.close).toFixed(2)),
      volume: Number(d.volume || 0),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

export async function seedOneSymbol({ base, yahoo, stockModel, historyModel, intradayHistoryModel, now = new Date() }) {
  const { symbol } = base
  const period1 = new Date(now.getTime() - 730 * 86400000)
  const intra1 = new Date(now.getTime() - 6 * 86400000)
  try {
    const [quoteArr, daily, intraday] = await Promise.all([
      yahoo.quote([symbol]),
      yahoo.chart(symbol, { period1, interval: '1d' }),
      yahoo.chart(symbol, { period1: intra1, interval: '60m' }),
    ])
    const quote = (quoteArr || []).find((q) => q.symbol === symbol)
    // No index-0 fallback (parity with the sync path's strict quoteMap.get):
    // a missing quote must surface as thin data → stale-mark, never as a
    // neighboring symbol's price.
    const price = Number(quote?.regularMarketPrice) || 0
    const dailyRows = normalizeDailyRows(daily?.quotes)
    // Partial results are unusable: a quote without depth, or depth without
    // a quote, must not become a "verified" record.
    if (!price || dailyRows.length < 5) throw new Error('thin provider data')
    await stockModel.updateOne(
      { symbol },
      {
        $set: {
          symbol,
          name: quote?.shortName || quote?.longName || base.name,
          price,
          change: Number(quote?.regularMarketChange) || 0,
          changePercent: Number(quote?.regularMarketChangePercent) || 0,
          volume: Number(quote?.regularMarketVolume) || 0,
          marketCap: Number(quote?.marketCap) || 0,
          sector: base.sector,
          source: 'yahoo',
          asOf: now,
          providerTime: toProviderTime(quote?.regularMarketTime),
          lastVerifiedAt: now,
          stale: false,
        },
      },
      { upsert: true }
    )
    await historyModel.updateOne(
      { symbol },
      { $set: { symbol, data: dailyRows, updatedAt: now } },
      { upsert: true }
    )
    await intradayHistoryModel.updateOne(
      { symbol },
      { $set: { symbol, data: normalizeDailyRows(intraday?.quotes), updatedAt: now } },
      { upsert: true }
    )
    return { symbol, outcome: 'live' }
  } catch (err) {
    // No fabrication fallback: keep any existing record, mark it honestly.
    await stockModel.updateOne({ symbol }, { $set: { source: 'seed', stale: true } }, { upsert: false })
    return { symbol, outcome: 'stale-marked', reason: err?.message || 'unknown' }
  }
}
