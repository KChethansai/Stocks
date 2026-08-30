import { ensureHistory, MIN_HISTORY_CANDLES } from './history.js'

/**
 * Pure-JS technical feature engineering for the Candle Craft predictor.
 * No external ML/TA dependency — every indicator is computed here.
 */

/** Default number of trailing sessions pulled per symbol. */
export const DEFAULT_LOOKBACK = 30

/** Below this many valid candles we refuse to emit features. */
export const MIN_CANDLES = MIN_HISTORY_CANDLES

const SHORT_SMA = 5
const LONG_SMA = 20
const SLOPE_WINDOW = 20
const ROC_PERIOD = 10
const RSI_PERIOD = 14

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

/** Sample standard deviation (n-1). */
const stdDev = (values) => {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Simple moving average of the final `period` values. */
const sma = (values, period) => {
  if (values.length < period) return null
  return mean(values.slice(-period))
}

/**
 * Least-squares linear fit of y against its own index (x = 0..n-1).
 * Pure JS — returns slope in price-units per session.
 */
const linearRegression = (values) => {
  const n = values.length
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 }

  const xMean = (n - 1) / 2
  const yMean = mean(values)

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (values[i] - yMean)
    denominator += (i - xMean) ** 2
  }

  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = yMean - slope * xMean

  // Coefficient of determination — how well the straight line explains the series.
  let ssTot = 0
  let ssRes = 0
  for (let i = 0; i < n; i += 1) {
    const predicted = intercept + slope * i
    ssTot += (values[i] - yMean) ** 2
    ssRes += (values[i] - predicted) ** 2
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, r2 }
}

/**
 * Wilder's RSI over `period` sessions.
 * Seeds with a simple average of the first `period` deltas, then applies
 * Wilder smoothing: avg = (avg * (period - 1) + current) / period.
 *
 * @returns {number|null} 0–100, or null when there are too few closes
 */
export const rsi = (closes, period = RSI_PERIOD) => {
  if (closes.length < period + 1) return null

  const deltas = []
  for (let i = 1; i < closes.length; i += 1) {
    deltas.push(closes[i] - closes[i - 1])
  }

  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i += 1) {
    if (deltas[i] > 0) avgGain += deltas[i]
    else avgLoss += -deltas[i]
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period; i < deltas.length; i += 1) {
    const gain = deltas[i] > 0 ? deltas[i] : 0
    const loss = deltas[i] < 0 ? -deltas[i] : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/** Rate of change over `period` sessions, as a fraction (0.032 === +3.2%). */
export const rateOfChange = (closes, period = ROC_PERIOD) => {
  if (closes.length < period + 1) return 0
  const past = closes[closes.length - 1 - period]
  if (!past) return 0
  return (closes[closes.length - 1] - past) / past
}

/** Standard deviation of session-over-session returns. */
export const returnVolatility = (closes) => {
  if (closes.length < 3) return 0
  const returns = []
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1] > 0) returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  return stdDev(returns)
}

/**
 * Compute the full feature set from raw candles.
 * Pure — no I/O. Returns `{ insufficientData: true }` rather than throwing.
 *
 * @param {Array<{close: number, volume?: number, timestamp?: Date|string, date?: Date|string}>} candles
 * @param {{lookback?: number}} [options]
 */
export function computeFeatures(candles, options = {}) {
  const lookback = Math.max(MIN_CANDLES, Number(options.lookback) || DEFAULT_LOOKBACK)

  if (!Array.isArray(candles) || candles.length < MIN_CANDLES) {
    return {
      insufficientData: true,
      message: `Need at least ${MIN_CANDLES} sessions of history`,
      candleCount: Array.isArray(candles) ? candles.length : 0
    }
  }

  const sorted = [...candles].sort((a, b) => {
    const aTime = new Date(a.timestamp || a.date || 0).getTime()
    const bTime = new Date(b.timestamp || b.date || 0).getTime()
    return aTime - bTime
  })

  const valid = sorted.filter((c) => Number.isFinite(Number(c.close)) && Number(c.close) > 0)
  if (valid.length < MIN_CANDLES) {
    return {
      insufficientData: true,
      message: `Need at least ${MIN_CANDLES} valid closes`,
      candleCount: valid.length
    }
  }

  const window = valid.slice(-lookback)
  const closes = window.map((c) => Number(c.close))
  const volumes = window.map((c) => Number(c.volume) || 0)

  const slopeSeries = closes.slice(-SLOPE_WINDOW)
  const { slope, intercept, r2 } = linearRegression(slopeSeries)

  const lastClose = closes[closes.length - 1]

  return {
    insufficientData: false,
    candleCount: closes.length,
    totalCandles: valid.length,
    lastClose,
    lastVolume: volumes[volumes.length - 1],
    avgVolume: Math.round(mean(volumes)),

    sma5: sma(closes, SHORT_SMA),
    sma20: sma(closes, LONG_SMA),

    /** OLS slope of the last 20 closes, in price-units per session. */
    emaTrendSlope: slope,
    /** Intercept + fit quality of that same regression — used to project price. */
    slopeIntercept: intercept,
    slopeR2: r2,
    slopeWindowLength: slopeSeries.length,

    roc10: rateOfChange(closes, ROC_PERIOD),
    volatility: returnVolatility(closes),
    rsi14: rsi(closes, RSI_PERIOD),

    closes,
    asOf: new Date(window[window.length - 1].timestamp || window[window.length - 1].date || Date.now())
  }
}

/**
 * Load history for a symbol and compute its feature set.
 * Never throws — returns `{ insufficientData: true }` when history is unavailable.
 *
 * @param {string} symbol
 * @param {{lookback?: number}} [options]
 */
export async function loadFeatures(symbol, options = {}) {
  const candles = await ensureHistory(symbol)
  if (!candles) {
    return { insufficientData: true, message: 'Historical data unavailable', candleCount: 0 }
  }
  return computeFeatures(candles, options)
}

export const __internals = { mean, stdDev, sma, linearRegression }
