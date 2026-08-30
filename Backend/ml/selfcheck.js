/**
 * Self-check for the pure ML math. No DB, no network, no test framework.
 *   node ml/selfcheck.js
 */
import assert from 'node:assert/strict'
import { computeFeatures, rsi, rateOfChange, returnVolatility, MIN_CANDLES } from './features.js'
import { predictFromCandles, predictFromCandlesAsync, scoreFeatures, WEIGHTS, NEUTRAL_DEADBAND } from './predictor.js'

const day = 86400000
const candles = (closes, startVolume = 1_000_000) =>
  closes.map((close, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, 1) + i * day),
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: startVolume + i * 1000
  }))

const series = (n, fn) => Array.from({ length: n }, (_, i) => fn(i))

let checks = 0
const check = (name, fn) => {
  fn()
  checks += 1
  console.log(`  ok  ${name}`)
}

console.log('\nfeatures.js')

check('rejects too little history', () => {
  const f = computeFeatures(candles(series(10, (i) => 100 + i)))
  assert.equal(f.insufficientData, true)
  assert.equal(f.candleCount, 10)
})

check('accepts exactly MIN_CANDLES', () => {
  const f = computeFeatures(candles(series(MIN_CANDLES, (i) => 100 + i)))
  assert.equal(f.insufficientData, false)
})

check('sma5 / sma20 match hand-computed values', () => {
  const closes = series(20, (i) => 100 + i) // 100..119
  const f = computeFeatures(candles(closes))
  // last 5 = 115..119 -> mean 117 ; all 20 = 100..119 -> mean 109.5
  assert.equal(f.sma5, 117)
  assert.equal(f.sma20, 109.5)
})

check('OLS slope of a perfect line is exact', () => {
  const f = computeFeatures(candles(series(25, (i) => 50 + 2 * i)))
  assert.ok(Math.abs(f.emaTrendSlope - 2) < 1e-9, `slope ${f.emaTrendSlope}`)
  assert.ok(Math.abs(f.slopeR2 - 1) < 1e-9, `r2 ${f.slopeR2}`)
})

check('roc10 matches definition', () => {
  const closes = series(25, (i) => 100 + i)
  // last = 124, 10 sessions back = 114 -> (124-114)/114
  assert.ok(Math.abs(rateOfChange(closes, 10) - 10 / 114) < 1e-12)
})

check('flat series has zero volatility, sloping series does not', () => {
  assert.equal(returnVolatility(series(25, () => 100)), 0)
  assert.ok(returnVolatility([100, 110, 95, 130, 90]) > 0)
})

check('RSI is 100 for a pure uptrend and 0 for a pure downtrend', () => {
  assert.equal(rsi(series(30, (i) => 100 + i), 14), 100)
  assert.equal(rsi(series(30, (i) => 200 - i), 14), 0)
})

check('RSI of an alternating series sits mid-range', () => {
  const value = rsi(series(40, (i) => 100 + (i % 2)), 14)
  assert.ok(value > 30 && value < 70, `rsi ${value}`)
})

check('RSI needs period+1 closes', () => {
  assert.equal(rsi(series(14, (i) => 100 + i), 14), null)
  assert.notEqual(rsi(series(15, (i) => 100 + i), 14), null)
})

check('candles are sorted before use, unsorted input is safe', () => {
  const ordered = candles(series(25, (i) => 100 + i))
  const shuffled = [...ordered].reverse()
  assert.equal(computeFeatures(ordered).lastClose, computeFeatures(shuffled).lastClose)
})

console.log('\npredictor.js')

check('strong uptrend predicts UP above the deadband', () => {
  const p = predictFromCandles(candles(series(40, (i) => 100 * 1.004 ** i)))
  assert.equal(p.ok, true)
  assert.equal(p.direction, 'UP')
  assert.ok(p.predictedPrice > p.currentPrice, 'target should exceed spot')
  assert.ok(p.explainability.metrics.compositeScore >= NEUTRAL_DEADBAND)
})

check('strong downtrend predicts DOWN', () => {
  const p = predictFromCandles(candles(series(40, (i) => 200 * 0.996 ** i)))
  assert.equal(p.direction, 'DOWN')
  assert.ok(p.predictedPrice < p.currentPrice)
})

check('flat series is NEUTRAL', () => {
  const p = predictFromCandles(candles(series(40, () => 100)))
  assert.equal(p.direction, 'NEUTRAL')
})

check('confidence stays a 0-1 fraction and matches confidencePct', () => {
  const p = predictFromCandles(candles(series(40, (i) => 100 + i)))
  assert.ok(p.confidence > 0 && p.confidence <= 0.95, `confidence ${p.confidence}`)
  assert.ok(Math.abs(p.confidencePct - p.confidence * 100) < 0.1)
})

check('higher volatility lowers confidence for the same trend', () => {
  const calm = predictFromCandles(candles(series(40, (i) => 100 + i)))
  const wild = predictFromCandles(candles(series(40, (i) => 100 + i + (i % 2 ? 9 : -9))))
  assert.ok(wild.confidence < calm.confidence, `${wild.confidence} !< ${calm.confidence}`)
})

check('overbought RSI is reported and dampens confidence', () => {
  const p = predictFromCandles(candles(series(40, (i) => 100 * 1.01 ** i)))
  assert.ok(p.explainability.metrics.rsi14 > 70, `rsi ${p.explainability.metrics.rsi14}`)
  assert.equal(p.reversalRisk, true)
  assert.ok(p.factors.some((f) => f.includes('overbought')), 'expected an overbought factor')
})

check('predicted range brackets the predicted price', () => {
  const p = predictFromCandles(candles(series(40, (i) => 100 + i)))
  assert.ok(p.predictedRange.low <= p.predictedPrice)
  assert.ok(p.predictedRange.high >= p.predictedPrice)
  assert.deepEqual(p.priceRange, p.predictedRange, 'priceRange must alias predictedRange')
})

check('longer horizon widens the range', () => {
  const c = candles(series(40, (i) => 100 + i + (i % 3)))
  const near = predictFromCandles(c, { horizon: 1 })
  const far = predictFromCandles(c, { horizon: 5 })
  const width = (p) => p.predictedRange.high - p.predictedRange.low
  assert.ok(width(far) > width(near))
})

check('projection is capped at +/-25% of spot', () => {
  const p = predictFromCandles(candles(series(40, (i) => 100 * 1.05 ** i)), { horizon: 5 })
  assert.ok(p.predictedPrice <= p.currentPrice * 1.25 + 0.01, `predicted ${p.predictedPrice}`)
})

// Regression guard: a low-R2 fit used to drag the target against the reported
// direction, producing "Bullish, target below spot".
check('direction and predictedPrice never contradict each other', () => {
  const shapes = [
    (i) => 100 + i,
    (i) => 200 - i,
    (i) => 100,
    (i) => 100 * 1.004 ** i,
    (i) => 200 * 0.996 ** i,
    (i) => 100 + Math.sin(i / 3) * 8,
    (i) => 100 + Math.sin(i / 5) * 15 + i * 0.2,
    (i) => 100 - Math.sin(i / 4) * 12 + (i % 7),
    (i) => 100 + (i % 2 ? 6 : -6),
    (i) => 300 - i * 0.4 + Math.cos(i / 2) * 10
  ]

  for (const shape of shapes) {
    for (const horizon of [1, 3, 5]) {
      const p = predictFromCandles(candles(series(45, shape)), { horizon })
      assert.equal(p.ok, true)

      if (p.direction === 'UP') {
        assert.ok(
          p.predictedPrice >= p.currentPrice,
          `UP but target ${p.predictedPrice} < spot ${p.currentPrice}`
        )
        assert.ok(p.expectedChangePct >= 0, `UP but expectedChangePct ${p.expectedChangePct}`)
      } else if (p.direction === 'DOWN') {
        assert.ok(
          p.predictedPrice <= p.currentPrice,
          `DOWN but target ${p.predictedPrice} > spot ${p.currentPrice}`
        )
        assert.ok(p.expectedChangePct <= 0, `DOWN but expectedChangePct ${p.expectedChangePct}`)
      }
    }
  }
})

check('forecast series ends at the predicted price', () => {
  for (const horizon of [1, 3, 5]) {
    const p = predictFromCandles(candles(series(45, (i) => 100 + i * 0.6)), { horizon })
    assert.equal(p.chart.forecast.length, horizon)
    const last = p.chart.forecast[p.chart.forecast.length - 1]
    assert.ok(
      Math.abs(last.predicted - p.predictedPrice) < 0.02,
      `forecast tail ${last.predicted} != target ${p.predictedPrice}`
    )
  }
})

check('insufficient history returns ok:false, never throws', () => {
  const p = predictFromCandles(candles(series(5, (i) => 100 + i)))
  assert.equal(p.ok, false)
  assert.equal(p.insufficientData, true)
})

check('garbage input returns ok:false, never throws', () => {
  for (const input of [null, undefined, [], 'nope', [{ close: 'x' }]]) {
    assert.equal(predictFromCandles(input).ok, false)
  }
})

check('weights sum to 1', () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`)
})

check('scoreFeatures handles a null feature set', () => {
  assert.equal(scoreFeatures(null).ok, false)
})

// Async tail: trained overlay must never crash — with onnxruntime-node / bundle
// absent it returns the heuristic prediction untouched (same model id).
export async function runAsyncTail() {
  const p = await predictFromCandlesAsync(candles(series(40, (i) => 100 * 1.004 ** i)))
  assert.equal(typeof p.direction, 'string', 'direction present')
  assert.ok(p.confidence >= 0 && p.confidence <= 1, 'confidence in [0,1]')
  assert.equal(typeof p.model, 'string', 'model id present')
}

runAsyncTail()
  .then(() => console.log(`\n${checks} checks passed\n`))
  .catch((err) => {
    console.error('\nASYNC CHECK FAILED:', err.message)
    process.exitCode = 1
  })
