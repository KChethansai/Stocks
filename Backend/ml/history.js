import YahooFinance from 'yahoo-finance2'
import { historyModel } from '../models/HistoryModel.js'

/**
 * Single owner of OHLC history reads for the ML layer.
 * Mirrors StockAPI's cache semantics (one document per symbol, whole series in `data`).
 */
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
})

const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const HISTORY_WINDOW_DAYS = 730

/** Minimum candles the feature layer needs before it will emit a feature set. */
export const MIN_HISTORY_CANDLES = 20

/**
 * Return cached OHLC candles for a symbol, refreshing from Yahoo when stale.
 * Never throws — returns `null` when no data can be produced at all.
 *
 * @param {string} symbol uppercase ticker
 * @returns {Promise<Array<{timestamp: Date, open: number, high: number, low: number, close: number, volume: number}>|null>}
 */
export async function ensureHistory(symbol) {
  const cached = await historyModel.findOne({ symbol }).lean()
  const now = Date.now()

  const cachedIsUsable =
    cached?.data?.length >= MIN_HISTORY_CANDLES &&
    now - new Date(cached.updatedAt).getTime() < HISTORY_CACHE_TTL_MS

  if (cachedIsUsable) return cached.data

  const period2 = new Date()
  const period1 = new Date()
  period1.setDate(period1.getDate() - HISTORY_WINDOW_DAYS)

  let rawData = []
  try {
    const result = await yahooFinance.historical(symbol, {
      period1: period1.toISOString().split('T')[0],
      period2: period2.toISOString().split('T')[0],
      interval: '1d'
    })
    rawData = result || []
  } catch (err) {
    console.error(`[ML] History fetch failed for ${symbol}:`, err.message)
    // Stale cache beats no data for a read-only prediction.
    return cached?.data?.length ? cached.data : null
  }

  const data = rawData
    .filter((d) => d.open && d.high && d.low && d.close)
    .map((d) => ({
      timestamp: new Date(d.date),
      open: Number(d.open.toFixed(2)),
      high: Number(d.high.toFixed(2)),
      low: Number(d.low.toFixed(2)),
      close: Number(d.close.toFixed(2)),
      volume: Number(d.volume || 0)
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (data.length > 0) {
    await historyModel.findOneAndUpdate(
      { symbol },
      { symbol, data, updatedAt: new Date() },
      { upsert: true, new: true }
    )
    return data
  }

  return cached?.data?.length ? cached.data : null
}
