/**
 * Serves the Python-trained XGBoost model (ml/python) as a drop-in predictor.
 *
 * The ONNX model consumes the EXACT feature vector ml/python/features.py emits,
 * which is itself a mirror of ComputeFeatures in ml/features.js — feature
 * engineering always happens here in JS, so train/serve stay in lockstep.
 *
 * If the model bundle or onnxruntime-node is unavailable (or inference throws),
 * callers fall back to the pure-JS heuristic — never crash, never block startup.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'models')

let sessionCache = null
let metaCache = null
let ortError = null

/** Load meta + ONNX session once. Returns null when unavailable. */
async function loadBundle() {
  if (sessionCache) return { session: sessionCache, meta: metaCache }
  if (ortError) return null

  try {
    const metaPath = path.join(MODELS_DIR, 'predictor-2d.meta.json')
    if (!existsSync(metaPath)) return null
    metaCache = JSON.parse(readFileSync(metaPath, 'utf8'))

    const { InferenceSession } = await import('onnxruntime-node')
    sessionCache = await InferenceSession.create(
      path.join(MODELS_DIR, 'predictor-2d.onnx')
    )
    return { session: sessionCache, meta: metaCache }
  } catch (err) {
    ortError = err // cached forever — but only one retry per missing dep silently
    return null
  }
}

/**
 * Build the training-time feature vector from computeFeatures() output.
 * Order must equal FEATURE_COLUMNS in ml/python/features.py.
 */
const buildInputVector = (features) => {
  const last = features.lastClose
  return new Float32Array([
    features.sma5 != null ? features.sma5 / last - 1 : 0,
    features.sma20 != null ? features.sma20 / last - 1 : 0,
    features.emaTrendSlope / last,
    features.slopeIntercept / last,
    features.slopeR2,
    features.roc10,
    features.volatility,
    Number.isFinite(features.rsi14) ? features.rsi14 / 100 : 0.5
  ])
}

/**
 * @param {ReturnType<typeof import('./features.js').computeFeatures>} features
 * @returns {Promise<{direction: string, confidence: number, model: string} | null>}
 */
export async function scoreWithTrained(features) {
  if (features.insufficientData) return null
  const bundle = await loadBundle()
  if (!bundle) return null

  const { session, meta } = bundle
  try {
    const input = buildInputVector(features)
    const feeds = { [session.inputNames[0]]: input }
    const { probabilities } = await session.run(feeds)
    const probs = Array.from(probabilities[0])
    const argmax = probs.indexOf(Math.max(...probs))
    const confidence = probs[argmax] ?? 0
    const direction = (meta.classes && meta.classes[argmax]) || 'NEUTRAL'
    return { direction, confidence, model: meta.model_id || 'xgboost-onnx' }
  } catch (err) {
    ortError = err
    return null
  }
}