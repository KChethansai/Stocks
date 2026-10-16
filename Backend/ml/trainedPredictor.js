/**
 * Serves the Python-trained single-estimator ONNX bundle (ml/python) as a drop-in predictor.
 * Phase 1 exports one ONNX per horizon (XGBoost or LightGBM backbone — see
 * meta.exported_kind); soft-vote/stack blends are evaluation-only and recorded
 * in meta.ensemble for the next multi-ONNX experiment.
 *
 * The ONNX model consumes the EXACT feature vector ml/python/features.py emits,
 * which is itself a mirror of computeFeatures in ml/features.js — feature
 * engineering always happens here in JS, so train/serve stay in lockstep.
 *
 * If the model bundle or onnxruntime-node is unavailable (or inference throws),
 * callers fall back to the pure-JS heuristic — never crash, never block startup.
 * Synthetic smoke bundles (meta.synthetic=true) are NEVER served as real.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  MODELS_DIR,
  FEATURE_COLUMNS,
  CLASS_ORDER,
  FEATURE_SCHEMA,
  EXPERIMENTAL_MODEL_PATTERN,
  activeReleaseId,
} from './modelRelease.js'

/** Per-horizon caches: { session, meta } or { missing:true } / { error }. */
const bundleCache = new Map()
/** In-flight loads so concurrent first-calls share one import + session open. */
const loadInflight = new Map()
let ortModulePromise = null

const clampHorizon = (h) => Math.min(5, Math.max(1, Math.round(Number(h) || 2)))

async function getOrt() {
  if (!ortModulePromise) ortModulePromise = import('onnxruntime-node')
  return ortModulePromise
}

/** Load meta + ONNX session for a horizon. Returns null when unavailable. */
async function loadBundle(horizonDays = 2) {
  const h = clampHorizon(horizonDays)
  const hit = bundleCache.get(h)
  if (hit) return hit.session ? hit : null
  const inflight = loadInflight.get(h)
  if (inflight) {
    const bundle = await inflight
    return bundle?.session ? bundle : null
  }
  const pending = openBundle(h)
  loadInflight.set(h, pending)
  try {
    const bundle = await pending
    return bundle?.session ? bundle : null
  } finally {
    loadInflight.delete(h)
  }
}

/** Open + strictly validate the bundle. Null on any mismatch — never serve it. */
async function openBundle(h) {
  try {
    const metaPath = path.join(MODELS_DIR, `predictor-${h}d.meta.json`)
    const onnxPath = path.join(MODELS_DIR, `predictor-${h}d.onnx`)
    if (!existsSync(metaPath) || !existsSync(onnxPath)) {
      bundleCache.set(h, { missing: true })
      return null
    }
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    // Never serve a synthetic smoke bundle as a real ensemble.
    if (meta.synthetic) {
      bundleCache.set(h, { missing: true, reason: 'synthetic-bundle' })
      return null
    }
    // Phase 1.6 strict compatibility: schema, classes, horizon, identity.
    if (!Array.isArray(meta.feature_columns) || !Array.isArray(meta.classes)) {
      bundleCache.set(h, { missing: true, reason: 'invalid-meta' })
      return null
    }
    if (JSON.stringify(meta.feature_columns) !== JSON.stringify(FEATURE_COLUMNS)) {
      bundleCache.set(h, { missing: true, reason: 'feature-schema-mismatch' })
      return null
    }
    if (JSON.stringify(meta.classes) !== JSON.stringify(CLASS_ORDER)) {
      bundleCache.set(h, { missing: true, reason: 'class-order-mismatch' })
      return null
    }
    if (Number(meta.horizon) !== h) {
      bundleCache.set(h, { missing: true, reason: 'horizon-mismatch' })
      return null
    }
    // Experimental models (Phase 1.5 v2) must never occupy an approved slot.
    if (EXPERIMENTAL_MODEL_PATTERN.test(meta.model_id || '')) {
      bundleCache.set(h, { missing: true, reason: 'experimental-model-rejected' })
      return null
    }
    const { InferenceSession } = await getOrt()
    const session = await InferenceSession.create(onnxPath)
    // Contract: single float32 [1, 8] input; anything else is a corrupt export.
    const bundle = { session, meta, horizon: h }
    bundleCache.set(h, bundle)
    return bundle
  } catch (err) {
    bundleCache.set(h, { missing: true, reason: String(err?.message || err) })
    return null
  }
}

/**
 * Build the training-time feature vector from computeFeatures() output.
 * Order must equal FEATURE_COLUMNS in ml/python/features.py.
 * Returns null when the schema is violated (caller falls back to heuristic).
 * Rejects NaN/Infinity/out-of-range values — never feed garbage to ONNX.
 */
export const buildInputVector = (features) => {
  const last = Number(features?.lastClose)
  if (!Number.isFinite(last) || last <= 0) return null
  const req = ['emaTrendSlope', 'slopeIntercept', 'slopeR2', 'roc10', 'volatility']
  for (const k of req) {
    const v = Number(features[k])
    if (!Number.isFinite(v)) return null
  }
  const rsiRaw = Number(features.rsi14)
  const rsiNorm = Number.isFinite(rsiRaw) ? rsiRaw / 100 : 0.5
  if (!(rsiNorm >= 0 && rsiNorm <= 1)) return null
  const vec = new Float32Array([
    features.sma5 != null ? features.sma5 / last - 1 : 0,
    features.sma20 != null ? features.sma20 / last - 1 : 0,
    features.emaTrendSlope / last,
    features.slopeIntercept / last,
    features.slopeR2,
    features.roc10,
    features.volatility,
    rsiNorm
  ])
  for (const v of vec) if (!Number.isFinite(v)) return null
  // Sanity bounds: relative price terms beyond ±5 are corrupt-quote artifacts.
  if (Math.abs(vec[0]) > 5 || Math.abs(vec[1]) > 5) return null
  return vec
}

/** Explicit bundle status for health checks — never throws. */
export async function getModelStatus(horizonDays = 1) {
  const h = clampHorizon(horizonDays)
  const bundle = await loadBundle(h)
  if (!bundle) {
    const cached = bundleCache.get(h)
    return { ok: false, horizon: h, reason: cached?.reason || 'missing-bundle', modelsDir: MODELS_DIR }
  }
  return {
    ok: true,
    horizon: h,
    model: bundle.meta.model_id,
    releaseId: activeReleaseId(),
    featureSchema: FEATURE_SCHEMA,
    classes: bundle.meta.classes,
    trained_at: bundle.meta.trained_at,
    synthetic: !!bundle.meta.synthetic,
    inputs: bundle.session.inputNames,
    outputs: bundle.session.outputNames
  }
}

/**
 * @param {ReturnType<typeof import('./features.js').computeFeatures>} features
 * @param {{horizon?: number}} [options]
 * @returns {Promise<{direction: string, confidence: number, model: string, horizon: number} | null>}
 */
export async function scoreWithTrained(features, options = {}) {
  if (!features || features.insufficientData) return null
  const h = clampHorizon(options.horizon ?? 1)
  const bundle = await loadBundle(h)
  if (!bundle) return null

  const { session, meta } = bundle
  try {
    const input = buildInputVector(features)
    if (!input) return null
    const { Tensor } = await getOrt()
    const tensor = new Tensor('float32', input, [1, input.length])
    const feeds = { [session.inputNames[0]]: tensor }
    const results = await session.run(feeds)
    // onnxmltools emits (label, probabilities-as-ZipMap-sequence).
    let probs = null
    const outNames = session.outputNames
    const probName = outNames.find((n) => /prob/i.test(n)) || outNames[outNames.length - 1]
    const raw = results[probName]
    // raw is a Tensor for dense outputs or an Array of Maps for ZipMap.
    if (raw && typeof raw.data !== 'undefined') {
      const dims = raw.dims || []
      const data = Array.from(raw.data)
      probs = dims.length === 2 ? data.slice(0, meta.classes.length) : data
    } else if (Array.isArray(raw) && raw[0] instanceof Map) {
      const m = raw[0]
      // ZipMap keys may be ints (learned indices) or class strings.
      const keys = [...m.keys()]
      if (keys.length && typeof keys[0] === 'string') probs = meta.classes.map((c) => Number(m.get(c) ?? 0))
      else probs = keys.sort((a, b) => a - b).map((k) => Number(m.get(k) ?? 0))
    } else if (Array.isArray(raw)) {
      probs = raw.map(Number)
    }
    if (!probs || probs.length !== meta.classes.length) return null
    // Contract: probabilities must be finite, in [0,1], and sum to ~1.
    // Anything else is a corrupt export or runtime failure — never serve it.
    let total = 0
    for (const p of probs) {
      if (!Number.isFinite(p) || p < -1e-6 || p > 1 + 1e-6) return null
      total += p
    }
    if (!(total > 0.9 && total < 1.1)) return null
    let argmax = 0
    for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[argmax]) argmax = i
    const confidence = Number(probs[argmax]) || 0
    const direction = meta.classes[argmax] || 'NEUTRAL'
    if (!['UP', 'DOWN', 'NEUTRAL'].includes(direction)) return null
    return {
      direction,
      confidence,
      model: meta.model_id || 'xgboost-onnx',
      horizon: h,
      trained: true,
      provenance: 'trained-onnx',
      releaseId: activeReleaseId(),
      featureSchema: FEATURE_SCHEMA
    }
  } catch {
    return null
  }
}
