/**
 * Phase 1.6 isolated integration checks. No DB, no network, no production writes.
 *   npm run test:phase16   (Backend cwd)
 *
 * Covers: release packaging/verification + negative artifact cases, inference
 * contract across all 5 horizons + failure states, prediction provenance
 * contract, automation fail-closed guards, trading-session resolution math
 * (weekends/holidays/future/missing/legacy), and an inference perf smoke.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  RELEASE_ID,
  verifyInstalled,
  packageRelease,
  installRelease,
  rollbackRelease,
  activeReleaseId,
  checkRuntime,
  validateBundleMeta,
  FEATURE_COLUMNS,
  CLASS_ORDER
} from './modelRelease.js'
import { buildInputVector, scoreWithTrained, getModelStatus } from './trainedPredictor.js'
import { computeFeatures } from './features.js'
import { predictFromCandles, predictFromCandlesAsync } from './predictor.js'
import { evaluateMlGuard, isQuoteFresh } from './automationJob.js'
import { decideLogResolution } from './accuracyResolver.js'

let passed = 0
const results = []
const check = (name, fn) => {
  try {
    const info = fn()
    if (info?.then) {
      return info.then(
        (detail) => {
          passed += 1
          results.push({ name, status: 'PASS', detail })
          console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`)
        },
        (err) => {
          results.push({ name, status: 'FAIL', detail: String(err?.message || err) })
          console.log(`  FAIL ${name} — ${err?.message || err}`)
          process.exitCode = 1
        }
      )
    }
    passed += 1
    results.push({ name, status: 'PASS' })
    console.log(`  ok  ${name}`)
    return null
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: String(err?.message || err) })
    console.log(`  FAIL ${name} — ${err?.message || err}`)
    process.exitCode = 1
    return null
  }
}

const MODELS_DIR = new URL('./models/', import.meta.url).pathname
const day = 86400000
const candlesFrom = (closes, start = Date.UTC(2024, 5, 3)) =>
  closes.map((close, i) => ({
    timestamp: new Date(start + i * day),
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000
  }))
const series = (n, fn) => Array.from({ length: n }, (_, i) => fn(i))
const goodFeatures = () =>
  computeFeatures(candlesFrom(series(40, (i) => 100 * 1.004 ** i)))

/** Staged copy of the live models dir for destructive negative cases. */
const stageModels = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mf-models-'))
  for (const h of [1, 2, 3, 4, 5]) {
    for (const ext of ['onnx', 'meta.json']) {
      copyFileSync(path.join(MODELS_DIR, `predictor-${h}d.${ext}`), path.join(dir, `predictor-${h}d.${ext}`))
    }
  }
  return dir
}

console.log('\n[1] model release')

await check('manifest active + installed bundle verifies across 5 horizons', () => {
  assert.equal(activeReleaseId(), RELEASE_ID)
  const v = verifyInstalled()
  assert.equal(v.ok, true, JSON.stringify(v.horizons))
})

await check('runtime compatibility reports ort installed', () => {
  const r = checkRuntime()
  assert.equal(r.nodeOk, true)
  assert.equal(r.ortOk, true, JSON.stringify(r.ort))
})

await check('missing artifact fails with missing-artifact', () => {
  const dir = stageModels()
  try {
    rmSync(path.join(dir, 'predictor-1d.onnx'))
    const v = verifyInstalled(RELEASE_ID, dir)
    assert.equal(v.ok, false)
    assert.equal(v.horizons[1].reason, 'missing-artifact')
    assert.equal(v.horizons[2].ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

await check('corrupt onnx fails with checksum-mismatch', () => {
  const dir = stageModels()
  try {
    const p = path.join(dir, 'predictor-1d.onnx')
    const buf = readFileSync(p)
    buf[100] = buf[100] ^ 0xff
    writeFileSync(p, buf)
    const v = verifyInstalled(RELEASE_ID, dir)
    assert.equal(v.horizons[1].reason, 'checksum-mismatch')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

await check('tampered meta content fails before checksum (priority documented)', () => {
  const dir = stageModels()
  try {
    const p = path.join(dir, 'predictor-1d.meta.json')
    const meta = JSON.parse(readFileSync(p, 'utf8'))
    meta.horizon = 2
    writeFileSync(p, JSON.stringify(meta))
    // Checksum is verified first, so a tampered file reports checksum-mismatch.
    // Content-level reasons below are validated independently of checksums.
    const v = verifyInstalled(RELEASE_ID, dir)
    assert.equal(v.horizons[1].reason, 'checksum-mismatch')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

await check('validateBundleMeta rejects synthetic bundles', () => {
  const entry = { model_id: 'lightgbm-onnx-1d' }
  const base = { model_id: 'lightgbm-onnx-1d', horizon: 1, feature_columns: FEATURE_COLUMNS, classes: CLASS_ORDER }
  assert.deepEqual(validateBundleMeta({ ...base, synthetic: true }, entry, 1), {
    ok: false,
    reason: 'synthetic-bundle-rejected'
  })
  assert.equal(validateBundleMeta(base, entry, 1).ok, true)
})

await check('validateBundleMeta rejects mislabeled/schema/experimental metas', () => {
  const base = { model_id: 'lightgbm-onnx-1d', horizon: 1, feature_columns: FEATURE_COLUMNS, classes: CLASS_ORDER }
  const entry = { model_id: 'lightgbm-onnx-1d' }
  assert.equal(validateBundleMeta({ ...base, horizon: 2 }, entry, 1).reason, 'mislabeled-artifact')
  assert.equal(validateBundleMeta({ ...base, model_id: 'other' }, entry, 1).reason, 'mislabeled-artifact')
  assert.equal(
    validateBundleMeta({ ...base, feature_columns: ['x'] }, entry, 1).reason,
    'feature-schema-mismatch'
  )
  assert.equal(validateBundleMeta({ ...base, classes: ['UP'] }, entry, 1).reason, 'class-order-mismatch')
  assert.equal(
    validateBundleMeta({ ...base, model_id: 'v2_lgbm-exp', horizon: 1 }, { model_id: 'v2_lgbm-exp' }, 1).reason,
    'experimental-model-in-approved-slot'
  )
  assert.equal(validateBundleMeta(null, entry, 1).reason, 'invalid-meta')
})

await check('package → install → rollback cycle on temp tarball', () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'mf-rel-')), 'bundle.tar.gz')
  const pkg = packageRelease(out)
  assert.equal(pkg.ok, true, JSON.stringify(pkg).slice(0, 300))
  assert.match(pkg.sha256, /^[0-9a-f]{64}$/)
  const inst = installRelease(out)
  assert.equal(inst.ok, true, JSON.stringify(inst).slice(0, 300))
  assert.equal(verifyInstalled().ok, true)
  const rb = rollbackRelease()
  assert.equal(rb.ok, true, rb.restored_from)
  assert.equal(verifyInstalled().ok, true)
  rmSync(path.dirname(out), { recursive: true, force: true })
})

await check('install rejects corrupt tarball without touching live models', () => {
  const bad = path.join(tmpdir(), `mf-bad-${Date.now()}.tar.gz`)
  writeFileSync(bad, 'not-a-tarball')
  const before = verifyInstalled()
  const r = installRelease(bad)
  assert.equal(r.ok, false)
  assert.match(r.reason, /corrupt-tarball/)
  assert.equal(verifyInstalled().ok, before.ok)
  rmSync(bad, { force: true })
})

await check('install rejects missing tarball', () => {
  assert.equal(installRelease('/nonexistent/missing.tar.gz').ok, false)
})

console.log('\n[2] inference contract')

await check('buildInputVector accepts valid features (8-dim float32)', () => {
  const vec = buildInputVector(goodFeatures())
  assert.ok(vec instanceof Float32Array)
  assert.equal(vec.length, 8)
})

for (const [label, mutate] of [
  ['NaN slope', (f) => ({ ...f, emaTrendSlope: NaN })],
  ['Infinity roc', (f) => ({ ...f, roc10: Infinity })],
  ['zero lastClose', (f) => ({ ...f, lastClose: 0 })],
  ['negative lastClose', (f) => ({ ...f, lastClose: -5 })],
  ['missing volatility', (f) => ({ ...{ ...f }, volatility: undefined })],
  ['rsi out of range', (f) => ({ ...f, rsi14: 250 })]
]) {
  await check(`buildInputVector rejects ${label}`, () => {
    assert.equal(buildInputVector(mutate(goodFeatures())), null)
  })
}

for (const h of [1, 2, 3, 4, 5]) {
  await check(`scoreWithTrained horizon ${h} returns trained provenance`, async () => {
    const r = await scoreWithTrained(goodFeatures(), { horizon: h })
    assert.ok(r, 'expected a trained result')
    assert.ok(['UP', 'DOWN', 'NEUTRAL'].includes(r.direction))
    assert.ok(r.confidence >= 0 && r.confidence <= 1)
    assert.equal(r.trained, true)
    assert.equal(r.provenance, 'trained-onnx')
    assert.equal(r.horizon, h)
    assert.equal(r.releaseId, RELEASE_ID)
    assert.equal(r.featureSchema, 'features-v1.0')
  })
}

await check('horizon clamps deterministically (99→5, -3→1; 0 defaults to 2)', async () => {
  const f = goodFeatures()
  assert.equal((await scoreWithTrained(f, { horizon: 99 })).horizon, 5)
  assert.equal((await scoreWithTrained(f, { horizon: -3 })).horizon, 1)
  assert.equal((await scoreWithTrained(f, { horizon: 0 })).horizon, 2)
})

await check('scoreWithTrained failure states return null, never throw', async () => {
  assert.equal(await scoreWithTrained(null), null)
  assert.equal(await scoreWithTrained({ insufficientData: true }), null)
  assert.equal(await scoreWithTrained({ lastClose: 100 }, { horizon: 2 }), null)
})

await check('getModelStatus reports release + schema for all horizons', async () => {
  for (const h of [1, 2, 3, 4, 5]) {
    const s = await getModelStatus(h)
    assert.equal(s.ok, true, `${h}: ${s.reason || ''}`)
    assert.equal(s.releaseId, RELEASE_ID)
    assert.equal(s.featureSchema, 'features-v1.0')
  }
})

console.log('\n[3] prediction contract')

await check('heuristic result carries direction-classifier provenance', () => {
  const p = predictFromCandles(candlesFrom(series(40, (i) => 100 + i)))
  assert.equal(p.ok, true)
  assert.equal(p.trained, false)
  assert.equal(p.provenance, 'heuristic')
  assert.equal(p.predictionType, 'direction-classifier')
  assert.equal(p.priceProjection.kind, 'heuristic-display')
  assert.equal(p.releaseId, RELEASE_ID)
  assert.ok(p.confidenceNote)
})

await check('trained overlay keeps provenance + never contradicts direction', async () => {
  const shapes = [
    (i) => 100 + i,
    (i) => 200 - i,
    (i) => 100 + Math.sin(i / 3) * 8,
    (i) => 100 * 1.004 ** i,
    (i) => 200 * 0.996 ** i
  ]
  for (const shape of shapes) {
    for (const horizon of [1, 2, 5]) {
      const p = await predictFromCandlesAsync(candlesFrom(series(45, shape)), { horizon })
      assert.equal(p.ok, true)
      assert.equal(p.trained, true)
      assert.equal(p.provenance, 'trained-onnx')
      assert.equal(p.predictionType, 'direction-classifier')
      if (p.direction === 'UP') assert.ok(p.predictedPrice >= p.currentPrice)
      if (p.direction === 'DOWN') assert.ok(p.predictedPrice <= p.currentPrice)
    }
  }
})

await check('insufficient/garbage inputs stay ok:false with provenance-absent safety', () => {
  assert.equal(predictFromCandles(candlesFrom(series(5, (i) => 100 + i))).ok, false)
  assert.equal(predictFromCandles(null).ok, false)
  assert.equal(predictFromCandles('nope').ok, false)
})

console.log('\n[4] automation guards (failure injection)')

const withEnv = async (vars, fn) => {
  const saved = {}
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k]
    if (vars[k] === undefined) delete process.env[k]
    else process.env[k] = vars[k]
  }
  try {
    return await fn()
  } finally {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

await check('heuristic version suffix (-v2) is not experimental, still MODEL_UNVERIFIED', async () => {
  const { EXPERIMENTAL_MODEL_PATTERN } = await import('./modelRelease.js')
  assert.equal(EXPERIMENTAL_MODEL_PATTERN.test('composite-trend-crossover-momentum-rsi-v2'), false)
  assert.equal(EXPERIMENTAL_MODEL_PATTERN.test('v2_lgbm'), true)
  assert.equal(EXPERIMENTAL_MODEL_PATTERN.test('v2_xgb-2d'), true)
  await withEnv({ ML_AUTOMATION_ALLOW_HEURISTIC: undefined, ML_AUTOMATION_ALLOW_EXPERIMENTAL: undefined }, () => {
    const r = evaluateMlGuard(
      { trained: false, provenance: 'heuristic', model: 'composite-trend-crossover-momentum-rsi-v2' },
      { action: 'BUY' }
    )
    assert.deepEqual(r, { ok: false, reason: 'MODEL_UNVERIFIED' })
  })
})

await check('trained BUY passes the ML gate', async () => {
  await withEnv({}, () => {
    const r = evaluateMlGuard(
      { trained: true, provenance: 'trained-onnx', model: 'lightgbm-onnx-2d' },
      { action: 'BUY' }
    )
    assert.deepEqual(r, { ok: true })
  })
})

await check('experimental BUY blocked unless explicitly opted in', async () => {
  await withEnv({ ML_AUTOMATION_ALLOW_EXPERIMENTAL: undefined }, () => {
    assert.deepEqual(
      evaluateMlGuard({ trained: true, provenance: 'trained-onnx', model: 'v2_lgbm-exp' }, { action: 'SELL' }),
      { ok: false, reason: 'EXPERIMENTAL_BLOCKED' }
    )
  })
  await withEnv({ ML_AUTOMATION_ALLOW_EXPERIMENTAL: 'true', ML_AUTOMATION_ALLOW_HEURISTIC: 'true' }, () => {
    assert.deepEqual(
      evaluateMlGuard({ trained: true, provenance: 'trained-onnx', model: 'v2_lgbm-exp' }, { action: 'SELL' }),
      { ok: true }
    )
  })
})

await check('ALERT rules always pass the ML gate (no money moves)', async () => {
  await withEnv({}, () => {
    assert.deepEqual(
      evaluateMlGuard({ trained: false, provenance: 'heuristic', model: 'x' }, { action: 'ALERT' }),
      { ok: true }
    )
  })
})

await check('heuristic opt-in env re-allows heuristic trades', async () => {
  await withEnv({ ML_AUTOMATION_ALLOW_HEURISTIC: 'true' }, () => {
    assert.deepEqual(
      evaluateMlGuard({ trained: false, provenance: 'heuristic', model: 'x' }, { action: 'BUY' }),
      { ok: true }
    )
  })
})

await check('quote freshness gate: fresh ok, stale blocked, missing price blocked', async () => {
  await withEnv({ ML_QUOTE_MAX_AGE_MINUTES: '60' }, () => {
    const now = Date.now()
    assert.deepEqual(isQuoteFresh({ price: 100, updatedAt: new Date(now - 1000) }, now), { ok: true })
    assert.deepEqual(isQuoteFresh({ price: 100, updatedAt: new Date(now - 2 * 3600_000) }, now), {
      ok: false,
      reason: 'QUOTE_STALE'
    })
    assert.deepEqual(isQuoteFresh({ price: 0, updatedAt: new Date(now) }, now), {
      ok: false,
      reason: 'PRICE_UNAVAILABLE'
    })
    assert.deepEqual(isQuoteFresh(null, now), { ok: false, reason: 'PRICE_UNAVAILABLE' })
  })
})

console.log('\n[5] trading-session resolution math')

// Weekday session strip: Fri 2024-06-07 … Fri 2024-06-21 (EOD closes).
const session = (dateIso, close) => ({ timestamp: new Date(dateIso), close })
const strip = [
  session('2024-06-07T20:00:00Z', 100), // Fri
  session('2024-06-10T20:00:00Z', 101), // Mon
  session('2024-06-11T20:00:00Z', 102), // Tue
  // Wed 2024-06-12 deliberately absent (market holiday in this fixture)
  session('2024-06-13T20:00:00Z', 103), // Thu
  session('2024-06-14T20:00:00Z', 104), // Fri
  session('2024-06-17T20:00:00Z', 105), // Mon
  session('2024-06-18T20:00:00Z', 106) // Tue
]
const logAt = (createdAt, extra = {}) => ({
  createdAt: new Date(createdAt),
  horizonDays: 1,
  direction: 'UP',
  priceAtPrediction: 100,
  ...extra
})

await check('2-session prediction resolves to 2nd trading session, not calendar days', () => {
  // Predicted Friday evening, h=2 → Mon (1) + Tue (2). Calendar +2d would be Sunday.
  const d = decideLogResolution(
    logAt('2024-06-07T21:00:00Z', { horizonDays: 2 }),
    strip,
    new Date('2024-06-30T00:00:00Z')
  )
  assert.equal(d.outcome, 'resolved')
  assert.equal(d.actualPrice, 102)
  assert.equal(new Date(d.targetTimestamp).toISOString(), '2024-06-11T20:00:00.000Z')
})

await check('holiday skipped: Tue h=1 resolves Thursday, not the absent Wednesday', () => {
  const d = decideLogResolution(logAt('2024-06-11T21:00:00Z'), strip, new Date('2024-06-30T00:00:00Z'))
  assert.equal(d.outcome, 'resolved')
  assert.equal(d.actualPrice, 103)
})

await check('future target session is not-yet-due, never resolved early', () => {
  const d = decideLogResolution(logAt('2024-06-17T21:00:00Z'), strip, new Date('2024-06-18T19:00:00Z'))
  assert.equal(d.outcome, 'not-yet-due')
})

await check('missing candles → awaiting-data, never a fabricated outcome', () => {
  assert.equal(decideLogResolution(logAt('2024-06-07T21:00:00Z'), [], new Date()).outcome, 'awaiting-data')
  assert.equal(decideLogResolution(logAt('2024-06-07T21:00:00Z'), null, new Date()).outcome, 'awaiting-data')
})

await check('invalid prices → awaiting-data (no synthetic resolution)', () => {
  const d = decideLogResolution(logAt('2024-06-07T21:00:00Z', { priceAtPrediction: 0 }), strip, new Date('2024-06-30T00:00:00Z'))
  assert.equal(d.outcome, 'awaiting-data')
})

await check('legacy record without model identity still resolves by session math', () => {
  const d = decideLogResolution(
    { createdAt: new Date('2024-06-07T21:00:00Z'), horizonDays: 1, direction: 'DOWN', priceAtPrediction: 100 },
    strip,
    new Date('2024-06-30T00:00:00Z')
  )
  assert.equal(d.outcome, 'resolved')
  assert.equal(d.actualDirection, 'UP')
  assert.equal(d.wasCorrect, false)
})

await check('prediction before first candle → no-base (never backfilled)', () => {
  const d = decideLogResolution(logAt('2024-01-01T00:00:00Z'), strip, new Date('2024-06-30T00:00:00Z'))
  assert.equal(d.outcome, 'no-base')
})

console.log('\n[6] inference perf smoke')
await check('20 repeated h=2 inferences complete without growth surprises', async () => {
  const f = goodFeatures()
  const t0 = Date.now()
  for (let i = 0; i < 20; i += 1) {
    const r = await scoreWithTrained(f, { horizon: 2 })
    assert.ok(r)
  }
  const ms = Date.now() - t0
  console.log(`    20 inferences in ${ms}ms (${(ms / 20).toFixed(1)}ms each)`)
  assert.ok(ms < 30_000, `too slow: ${ms}ms`)
})

const failed = results.filter((r) => r.status === 'FAIL').length
console.log(`\nphase16Check: ${passed} passed, ${failed} failed, ${results.length} total`)
if (failed > 0) process.exitCode = 1
