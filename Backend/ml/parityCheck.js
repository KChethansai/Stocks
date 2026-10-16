/**
 * JS↔Python feature parity guard. No DB, no network.
 *   node ml/parityCheck.js
 * Mirrors Backend/ml/python/test_parity.py expectations so train/serve drift
 * fails loudly instead of degrading silently.
 */
import assert from 'node:assert/strict'
import { computeFeatures } from './features.js'
import { buildInputVector } from './trainedPredictor.js'

const day = 86400000
const candles = (closes) =>
  closes.map((close, i) => ({
    timestamp: new Date(Date.UTC(2024, 0, 1) + i * day),
    open: close, high: close * 1.01, low: close * 0.99, close, volume: 1_000_000
  }))
const series = (n, fn) => Array.from({ length: n }, (_, i) => fn(i))

// SMA parity: 100..119 → sma5=117, sma20=109.5
{
  const f = computeFeatures(candles(series(20, (i) => 100 + i)))
  // MIN is 30 now — 20 candles must refuse (parity with Python MIN_CANDLES).
  assert.equal(f.insufficientData, true, '20 candles must be insufficient (MIN=30)')
}
{
  const f = computeFeatures(candles(series(30, (i) => 100 + i)))
  assert.equal(f.insufficientData, false)
  assert.equal(f.sma5, 117 + 10) // last 5 of 100..129 → 127
  assert.equal(f.sma20, 119.5)
  // ROC10: (129-119)/119
  assert.ok(Math.abs(f.roc10 - 10 / 119) < 1e-12, `roc10 ${f.roc10}`)
  // Volatility must be relative-return std (JS recipe), matching Python fix.
  const closes = series(30, (i) => 100 + i)
  const rets = []
  for (let i = 1; i < closes.length; i += 1) rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1))
  assert.ok(Math.abs(f.volatility - sd) < 1e-12, `vol ${f.volatility} != ${sd}`)
  // ONNX input vector order must equal FEATURE_COLUMNS (float32 tolerance).
  const v = buildInputVector(f)
  assert.equal(v.length, 8)
  assert.ok(Math.abs(v[0] - (f.sma5 / f.lastClose - 1)) < 1e-6)
  assert.ok(Math.abs(v[5] - f.roc10) < 1e-6)
  assert.ok(Math.abs(v[6] - f.volatility) < 1e-6)
  assert.ok(Math.abs(v[7] - f.rsi14 / 100) < 1e-6)
}
// OLS parity: perfect line slope 2, R² 1
{
  const f = computeFeatures(candles(series(30, (i) => 50 + 2 * i)))
  assert.ok(Math.abs(f.emaTrendSlope - 2) < 1e-9, `slope ${f.emaTrendSlope}`)
  assert.ok(Math.abs(f.slopeR2 - 1) < 1e-9, `r2 ${f.slopeR2}`)
}
// RSI parity
{
  const up = computeFeatures(candles(series(30, (i) => 100 + i)))
  assert.equal(up.rsi14, 100)
  const dn = computeFeatures(candles(series(30, (i) => 200 - i)))
  assert.equal(dn.rsi14, 0)
}
console.log('\nJS↔Python parity: 4 groups passed\n')
