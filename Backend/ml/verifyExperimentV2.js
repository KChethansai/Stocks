/**
 * Verify the Phase-1.5 experimental ONNX bundle in Node (no DB, no network):
 *   node ml/verifyExperimentV2.js [experiments-dir]
 * 1. Loads onnx/fixture.json + lgbm-v2-2d-experimental.onnx, runs inference via
 *    onnxruntime-node, asserts probs match Python within 1e-4 and label agrees.
 * 2. Runs assembleV2Row() on static candles derived from the parity fixture and
 *    asserts the v2 slice reproduces Python's expected values within 1e-9 and
 *    the column order matches the fixture key order.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleV2Row } from './trainedPredictorV2.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const expRoot = path.join(dir, 'experiments')
const arg = process.argv[2]
const stamps = readdirSync(expRoot).filter((d) => /^\d{8}-\d{6}$/.test(d)).sort().reverse()
const stamp = arg || stamps.find((d) => existsSync(path.join(expRoot, d, 'onnx')))
const onnxDir = path.join(expRoot, stamp, 'onnx')
assert.ok(existsSync(onnxDir), `no onnx dir for ${stamp}`)

const fx = JSON.parse(readFileSync(path.join(onnxDir, 'fixture.json'), 'utf8'))
assert.equal(fx.feature_columns.length, 23, 'v2 width must be 23')

// --- 1. ONNX inference parity (Python expected vs Node) ---
const { Tensor, InferenceSession } = await import('onnxruntime-node')
const session = await InferenceSession.create(path.join(onnxDir, 'lgbm-v2-2d-experimental.onnx'))
const input = new Float32Array(fx.feature_vector)
const results = await session.run({ [session.inputNames[0]]: new Tensor('float32', input, [1, input.length]) })
const probName = session.outputNames.find((n) => /prob/i.test(n)) || session.outputNames.at(-1)
const probs = Array.from(results[probName].data)
assert.equal(probs.length, 3)
let maxDiff = 0
for (let i = 0; i < 3; i += 1) maxDiff = Math.max(maxDiff, Math.abs(probs[i] - fx.expected_probs[i]))
assert.ok(maxDiff < 1e-4, `onnx drift too large: ${maxDiff}`)
const labels = ['DOWN', 'NEUTRAL', 'UP']
assert.equal(labels[probs.indexOf(Math.max(...probs))], fx.expected_label)
console.log(`  ok  onnx parity (maxDiff=${maxDiff.toExponential(1)}, label=${fx.expected_label})`)

// --- 2. assembleV2Row parity against the shared Python fixture ---
const parity = JSON.parse(readFileSync(path.join(dir, 'python', 'fixtures', 'v2_parity.json'), 'utf8'))
const kase = parity.trend_noise
const day = 86400000
const t0 = Date.UTC(2024, 0, 1)
const mkCandles = (o, h, l, c, v) => o.map((_, i) => ({
  timestamp: new Date(t0 + i * day), open: o[i], high: h[i], low: l[i], close: c[i], volume: v[i]
}))
const mkCloses = (c) => c.map((close, i) => ({ timestamp: new Date(t0 + i * day), close }))
const assembled = assembleV2Row(
  mkCandles(kase.inputs.o, kase.inputs.h, kase.inputs.l, kase.inputs.c, kase.inputs.v),
  mkCloses(kase.inputs.spy),
  kase.inputs.sec.map(mkCloses)
)
assert.equal(assembled.vector.length, 23)
assert.deepEqual(assembled.columns.slice(8), Object.keys(kase.expected))
for (let i = 0; i < 15; i += 1) {
  const col = assembled.columns[8 + i]
  assert.ok(Math.abs(assembled.vector[8 + i] - kase.expected[col]) < 1e-9, `${col} mismatch`)
}
console.log('  ok  assembleV2Row parity (15/15 v2 columns, order matches Python)')

console.log('\nverifyExperimentV2: experimental bundle verified in Node\n')
