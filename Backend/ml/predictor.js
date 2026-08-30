import { computeFeatures, loadFeatures, DEFAULT_LOOKBACK, MIN_CANDLES } from './features.js'

/**
 * Composite technical scoring model — pure JavaScript, no Python, no training step.
 *
 * Four signals are each normalised into [-1, 1] and blended by the weights below.
 * Tune the weights here; nothing else needs to change.
 */
export const WEIGHTS = {
  trend: 0.35,
  crossover: 0.3,
  momentum: 0.25,
  rsi: 0.1
}

/** Normalisation scales — the move size that saturates each signal at ±1. */
export const SCALES = {
  /** Regression slope as a fraction of price, per session. 0.5%/day === full trend score. */
  slopePerDay: 0.005,
  /** SMA5-vs-SMA20 gap as a fraction. 2% separation === full crossover score. */
  smaGap: 0.02,
  /** 10-session rate of change. 6% === full momentum score. */
  roc: 0.06,
  /** Daily return stddev at which the volatility confidence penalty maxes out. */
  volatility: 0.04
}

/** |composite| below this is reported as NEUTRAL. */
export const NEUTRAL_DEADBAND = 0.12

const RSI_OVERBOUGHT = 70
const RSI_OVERSOLD = 30

export const MODEL_ID = 'composite-trend-crossover-momentum-rsi-v2'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const round = (value, digits = 2) => Number(Number(value).toFixed(digits))
const pct = (fraction, digits = 1) => `${fraction >= 0 ? '+' : ''}${(fraction * 100).toFixed(digits)}%`

/**
 * Contrarian RSI signal: 0 inside the neutral band, negative when overbought,
 * positive when oversold. Doubles as the confidence damping magnitude.
 */
const rsiSignal = (rsi14) => {
  if (!Number.isFinite(rsi14)) return 0
  if (rsi14 > RSI_OVERBOUGHT) return -clamp((rsi14 - RSI_OVERBOUGHT) / (100 - RSI_OVERBOUGHT), 0, 1)
  if (rsi14 < RSI_OVERSOLD) return clamp((RSI_OVERSOLD - rsi14) / RSI_OVERSOLD, 0, 1)
  return 0
}

/**
 * Score a pre-computed feature set into a prediction.
 * @param {ReturnType<typeof computeFeatures>} features
 * @param {{horizon?: number}} [options]
 */
export function scoreFeatures(features, options = {}) {
  if (!features || features.insufficientData) {
    return {
      ok: false,
      insufficientData: true,
      message: features?.message || 'Insufficient history for a prediction',
      candleCount: features?.candleCount ?? 0
    }
  }

  const horizon = clamp(Math.round(Number(options.horizon) || 1), 1, 5)
  const {
    lastClose,
    sma5,
    sma20,
    emaTrendSlope,
    slopeIntercept,
    slopeR2,
    slopeWindowLength,
    roc10,
    volatility,
    rsi14,
    closes
  } = features

  // ── a. Trend: normalised regression slope ──────────────────────────
  const slopePerDay = lastClose > 0 ? emaTrendSlope / lastClose : 0
  const trendScore = clamp(slopePerDay / SCALES.slopePerDay, -1, 1)

  // ── b. Crossover: SMA5 vs SMA20, scaled by the gap ─────────────────
  const smaGap = sma5 !== null && sma20 ? (sma5 - sma20) / sma20 : 0
  const crossoverScore = clamp(smaGap / SCALES.smaGap, -1, 1)

  // ── c. Momentum: 10-session rate of change ─────────────────────────
  const momentumScore = clamp(roc10 / SCALES.roc, -1, 1)

  // ── d. RSI adjustment: mean-reversion pull + confidence damping ─────
  const rsiScore = rsiSignal(rsi14)

  const composite = clamp(
    trendScore * WEIGHTS.trend +
      crossoverScore * WEIGHTS.crossover +
      momentumScore * WEIGHTS.momentum +
      rsiScore * WEIGHTS.rsi,
    -1,
    1
  )

  let direction = 'NEUTRAL'
  if (composite >= NEUTRAL_DEADBAND) direction = 'UP'
  else if (composite <= -NEUTRAL_DEADBAND) direction = 'DOWN'

  // ── Confidence ─────────────────────────────────────────────────────
  // Agreement = how many of the three primary signals share the composite's sign.
  const primary = [trendScore, crossoverScore, momentumScore]
  const compositeSign = Math.sign(composite)
  const agreeing = compositeSign === 0 ? 0 : primary.filter((s) => Math.sign(s) === compositeSign).length
  const agreement = agreeing / primary.length

  const volPenalty = clamp(volatility / SCALES.volatility, 0, 1) * 0.25
  const rsiPenalty = Math.abs(rsiScore) * 0.1

  // The previous 0.30 prior was too conservative for this technical-signal
  // model and left ordinary, aligned setups in the 30% range. Recalibrate the
  // prior upward, while retaining all signal-strength and risk adjustments.
  const confidence01 = clamp(
    0.45 + Math.abs(composite) * 0.3 + slopeR2 * 0.2 + agreement * 0.2 - volPenalty - rsiPenalty,
    0.05,
    0.95
  )

  // ── Projected price ────────────────────────────────────────────────
  // Two independent views of the next move, blended by regression fit quality:
  //   * the fitted line, trustworthy only when R² is high
  //   * the composite signal, expressed as a multiple of daily volatility
  // A low-R² fit (noise) must not drag the target against the reported direction,
  // so the blend is finally clamped to agree in sign with `direction`.
  const volFloor = Math.max(volatility, 0.003)
  const driftFromSlope = lastClose > 0 ? (emaTrendSlope * horizon) / lastClose : 0
  const driftFromComposite = composite * volFloor * horizon
  let drift = slopeR2 * driftFromSlope + (1 - slopeR2) * driftFromComposite

  if (direction === 'UP') drift = Math.max(drift, 0)
  else if (direction === 'DOWN') drift = Math.min(drift, 0)

  // Cap the projected move at ±25% so a steep fit cannot produce an absurd target.
  drift = clamp(drift, -0.25, 0.25)
  const predictedPrice = lastClose * (1 + drift)

  const bandPad = Math.max(volatility * Math.sqrt(horizon) * lastClose * 1.65, lastClose * 0.005)
  const predictedRange = {
    low: round(Math.max(0.01, predictedPrice - bandPad)),
    high: round(predictedPrice + bandPad)
  }

  const expectedChangePct = drift

  // ── Human-readable factors ─────────────────────────────────────────
  const factors = []

  if (sma5 !== null && sma20 !== null) {
    const relation = sma5 > sma20 ? 'above' : 'below'
    factors.push(
      `SMA5 (${round(sma5)}) is ${relation} SMA20 (${round(sma20)}) — ${pct(smaGap)} gap, ${
        sma5 > sma20 ? 'bullish' : 'bearish'
      } crossover`
    )
  }

  factors.push(
    `20-session trend slope ${emaTrendSlope >= 0 ? '+' : ''}${round(emaTrendSlope, 3)}/day (${pct(
      slopePerDay,
      2
    )} of price), fit quality R²=${round(slopeR2, 2)}`
  )

  factors.push(`10-day momentum ${pct(roc10)}`)

  if (Number.isFinite(rsi14)) {
    if (rsi14 > RSI_OVERBOUGHT) {
      factors.push(`RSI at ${round(rsi14, 0)} — overbought, confidence reduced and reversal possible`)
    } else if (rsi14 < RSI_OVERSOLD) {
      factors.push(`RSI at ${round(rsi14, 0)} — oversold, confidence reduced and reversal possible`)
    } else {
      factors.push(`RSI at ${round(rsi14, 0)} — neutral range, no reversal penalty`)
    }
  }

  factors.push(
    `Daily volatility ${pct(volatility, 2)}${
      volPenalty > 0.12 ? ' — elevated, confidence dampened' : ''
    }`
  )

  const reversalRisk = Math.abs(rsiScore) > 0.15
  const summary =
    direction === 'NEUTRAL'
      ? `Signals conflict (composite ${round(composite, 2)}) — no directional edge over the next ${horizon} session${
          horizon > 1 ? 's' : ''
        }.`
      : `${direction === 'UP' ? 'Bullish' : 'Bearish'} over the next ${horizon} session${
          horizon > 1 ? 's' : ''
        }: composite ${round(composite, 2)} with ${agreeing}/3 primary signals aligned.`

  const chartHistory = closes.map((close, index) => ({
    index,
    close: round(close),
    predicted: round(slopeIntercept + emaTrendSlope * (index - (closes.length - slopeWindowLength))),
    isForecast: false
  }))

  const forecast = []
  for (let step = 1; step <= horizon; step += 1) {
    forecast.push({
      index: closes.length - 1 + step,
      close: null,
      // Walk the same blended drift out step by step so the chart matches the target.
      predicted: round(lastClose * (1 + (drift * step) / horizon)),
      isForecast: true
    })
  }

  return {
    ok: true,
    direction,
    /** Canonical 0–1 fraction — this is what automation thresholds compare against. */
    confidence: round(confidence01, 4),
    /** Same value as a 0–100 percentage for display. */
    confidencePct: round(confidence01 * 100, 1),
    currentPrice: round(lastClose),
    predictedPrice: round(predictedPrice),
    expectedChangePct: round(expectedChangePct * 100, 2),    predictedRange,
    /** Back-compatible alias consumed by the existing frontend widgets. */
    priceRange: predictedRange,
    horizon,
    horizonDays: horizon,
    reversalRisk,
    factors,
    model: MODEL_ID,
    explainability: {
      summary,
      factors,
      metrics: {
        trendScore: round(trendScore, 3),
        crossoverScore: round(crossoverScore, 3),
        momentumScore: round(momentumScore, 3),
        rsiScore: round(rsiScore, 3),
        compositeScore: round(composite, 3),
        agreement: round(agreement, 2),
        slope: round(emaTrendSlope, 4),
        r2: round(slopeR2, 3),
        shortSma: sma5 === null ? null : round(sma5),
        longSma: sma20 === null ? null : round(sma20),
        roc: round(roc10, 4),
        rsi14: Number.isFinite(rsi14) ? round(rsi14, 1) : null,
        dailyVolatility: round(volatility, 4),
        volatilityPenalty: round(volPenalty, 3)
      },
      weights: WEIGHTS
    },
    chart: { history: chartHistory, forecast },
    candleCount: features.candleCount,
    asOf: features.asOf || new Date()
  }
}

/**
 * Score raw candles directly. Kept for callers that already hold OHLC data.
 * @param {Array<object>} candles
 * @param {{horizonDays?: number, horizon?: number, lookback?: number}} [options]
 */
export function predictFromCandles(candles, options = {}) {
  const features = computeFeatures(candles, { lookback: options.lookback || DEFAULT_LOOKBACK })
  return scoreFeatures(features, { horizon: options.horizon ?? options.horizonDays ?? 1 })
}

/**
 * Load history for `symbol` and return its prediction.
 * Never throws — unavailable/insufficient history resolves to `{ ok: false, insufficientData: true }`.
 *
 * @param {string} symbol
 * @param {{horizon?: number, lookback?: number}} [options]
 */
export async function predict(symbol, options = {}) {
  const ticker = String(symbol || '').toUpperCase().trim()
  try {
    const features = await loadFeatures(ticker, { lookback: options.lookback || DEFAULT_LOOKBACK })
    return { symbol: ticker, ...scoreFeatures(features, { horizon: options.horizon ?? 1 }) }
  } catch (err) {
    console.error(`[ML] predict(${ticker}) failed:`, err.message)
    return {
      symbol: ticker,
      ok: false,
      insufficientData: true,
      message: 'Prediction temporarily unavailable',
      candleCount: 0
    }
  }
}

/**
 * Predict a list of symbols. Sequential on purpose — Yahoo rate-limits parallel bursts.
 * Always resolves with one entry per requested symbol.
 *
 * @param {string[]} symbols
 * @param {{horizon?: number, lookback?: number}} [options]
 */
export async function predictBatch(symbols = [], options = {}) {
  const results = []
  for (const symbol of symbols) {
    results.push(await predict(symbol, options))
  }
  return results
}

export { MIN_CANDLES }
