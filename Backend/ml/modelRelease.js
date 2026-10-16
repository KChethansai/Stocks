/**
 * Versioned, immutable release bundles for the approved Phase-1 canonical models.
 *
 * Phase 1.6: trained ONNX binaries are gitignored, so a fresh deployment would
 * silently run the heuristic. This module is the reproducible, secure delivery
 * mechanism for the approved 1–5 session models:
 *
 *   node ml/modelRelease.js status                  # installed vs manifest
 *   node ml/modelRelease.js verify                  # integrity + compatibility
 *   node ml/modelRelease.js package [outTarball]    # build distributable bundle
 *   node ml/modelRelease.js install <tarball>       # atomic install + backup
 *   node ml/modelRelease.js rollback                # restore previous backup
 *
 * Manifest (committed, no binaries):
 *   Backend/ml/releases/canonical-20261009-01/manifest.json
 *
 * Design notes:
 * - Deterministic model selection: horizons map to explicit filenames
 *   predictor-{h}d.{onnx,meta.json}; never directory listing order.
 * - Atomic activation: extract to models/.install-tmp/, verify, swap each
 *   horizon file via rename, keep models/.backup-<ts>/ for rollback.
 * - Approved bundles contain ONLY the 5 canonical horizons. Experimental
 *   (ml/experiments/**) artifacts are rejected on install.
 * - No secrets, no database records, no mutable aliases inside bundles.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  renameSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const MODELS_DIR = path.join(HERE, 'models')
export const RELEASES_DIR = path.join(HERE, 'releases')
export const RELEASE_ID = 'canonical-20261009-01'
export const FEATURE_SCHEMA = 'features-v1.0'
export const FEATURE_COLUMNS = [
  'sma5_rel',
  'sma20_rel',
  'slope_norm',
  'intercept_norm',
  'slope_r2',
  'roc10',
  'volatility',
  'rsi14',
]
export const CLASS_ORDER = ['DOWN', 'NEUTRAL', 'UP']
export const MIN_NODE_MAJOR = 20
/** Minimum onnxruntime-node major version able to load these bundles. */
export const MIN_ORT_MAJOR = 1

export const manifestPath = (releaseId = RELEASE_ID) =>
  path.join(RELEASES_DIR, releaseId, 'manifest.json')

/**
 * Identifies Phase-1.5 experimental model ids (v2_lgbm, v2_xgb, *experiment*).
 * Deliberately does NOT match a trailing -v2 version suffix, so the approved
 * heuristic id 'composite-trend-crossover-momentum-rsi-v2' is never mistaken
 * for an experimental model.
 */
export const EXPERIMENTAL_MODEL_PATTERN = /^v2[_-]|_v2[_-]|experiment/i

export function loadManifest(releaseId = RELEASE_ID) {
  const p = manifestPath(releaseId)
  if (!existsSync(p)) return { ok: false, reason: 'missing-manifest', path: p }
  try {
    const manifest = JSON.parse(readFileSync(p, 'utf8'))
    return { ok: true, manifest, path: p }
  } catch (err) {
    return { ok: false, reason: `invalid-manifest: ${err.message}`, path: p }
  }
}

/** Active release id for provenance tagging — manifest file, else 'unreleased'. */
export function activeReleaseId() {
  const loaded = loadManifest()
  if (loaded.ok && loaded.manifest?.release_id) return loaded.manifest.release_id
  return 'unreleased'
}

const sha256File = (filePath) => {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

const HORIZONS = [1, 2, 3, 4, 5]
const bundleFiles = (h) => [`predictor-${h}d.onnx`, `predictor-${h}d.meta.json`]

/**
 * Pure meta/content validation for one horizon bundle (no I/O).
 * Exported so negative branches are unit-testable without touching checksums.
 * Returns { ok: true, model_id } or { ok: false, reason }.
 */
export function validateBundleMeta(meta, entry, h) {
  if (!meta || typeof meta !== 'object') return { ok: false, reason: 'invalid-meta' }
  if (meta.synthetic) return { ok: false, reason: 'synthetic-bundle-rejected' }
  if (!Array.isArray(meta.feature_columns) || !Array.isArray(meta.classes)) {
    return { ok: false, reason: 'invalid-meta' }
  }
  if (meta.model_id !== entry?.model_id || Number(meta.horizon) !== h) {
    return { ok: false, reason: 'mislabeled-artifact' }
  }
  if (JSON.stringify(meta.feature_columns) !== JSON.stringify(FEATURE_COLUMNS)) {
    return { ok: false, reason: 'feature-schema-mismatch' }
  }
  if (JSON.stringify(meta.classes) !== JSON.stringify(CLASS_ORDER)) {
    return { ok: false, reason: 'class-order-mismatch' }
  }
  if (EXPERIMENTAL_MODEL_PATTERN.test(meta.model_id || '')) {
    return { ok: false, reason: 'experimental-model-in-approved-slot' }
  }
  return { ok: true, model_id: meta.model_id }
}

/**
 * Verify installed models against the release manifest.
 * Never throws — returns per-horizon results + overall ok.
 */
export function verifyInstalled(releaseId = RELEASE_ID, modelsDir = MODELS_DIR) {
  const loaded = loadManifest(releaseId)
  if (!loaded.ok) return { ok: false, reason: loaded.reason, horizons: {} }
  const { manifest } = loaded
  const horizons = {}
  let ok = true

  if (manifest.status !== 'approved') {
    return { ok: false, reason: `manifest status is '${manifest.status}', expected 'approved'`, horizons }
  }

  for (const h of HORIZONS) {
    const entry = manifest.artifacts?.[`h${h}`]
    if (!entry) {
      horizons[h] = { ok: false, reason: 'missing-manifest-entry' }
      ok = false
      continue
    }
    const [onnxName, metaName] = bundleFiles(h)
    const onnxPath = path.join(modelsDir, onnxName)
    const metaPath = path.join(modelsDir, metaName)
    if (!existsSync(onnxPath) || !existsSync(metaPath)) {
      horizons[h] = { ok: false, reason: 'missing-artifact' }
      ok = false
      continue
    }
    const onnxSha = sha256File(onnxPath)
    const metaSha = sha256File(metaPath)
    if (onnxSha !== entry.onnx_sha256 || metaSha !== entry.meta_sha256) {
      horizons[h] = { ok: false, reason: 'checksum-mismatch', onnxSha, metaSha }
      ok = false
      continue
    }
    // Compatibility: meta must describe exactly this schema / class order.
    let meta
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    } catch {
      horizons[h] = { ok: false, reason: 'invalid-meta-json' }
      ok = false
      continue
    }
    const content = validateBundleMeta(meta, entry, h)
    if (!content.ok) {
      horizons[h] = content
      ok = false
      continue
    }
    horizons[h] = { ok: true, model_id: meta.model_id }
  }
  return { ok, horizons, release_id: manifest.release_id }
}

/** Runtime compatibility check — never throws. */
export function checkRuntime() {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  let ort = { installed: false }
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(HERE, '..', 'node_modules', 'onnxruntime-node', 'package.json'), 'utf8')
    )
    ort = { installed: true, version: pkg.version }
  } catch {
    ort = { installed: false }
  }
  const ortMajor = ort.installed ? Number(String(ort.version).split('.')[0]) : 0
  return {
    node: process.versions.node,
    nodeOk: nodeMajor >= MIN_NODE_MAJOR,
    ort,
    ortOk: ort.installed && ortMajor >= MIN_ORT_MAJOR,
  }
}

function tarballDefault() {
  return path.join(RELEASES_DIR, `marketforge-${RELEASE_ID}.tar.gz`)
}

/**
 * Build a distributable bundle from the currently installed, verified models.
 * Writes <outTarball> + <outTarball>.sha256. Returns { ok, ... }.
 */
export function packageRelease(outTarball = tarballDefault()) {
  const verification = verifyInstalled()
  if (!verification.ok) return { ok: false, reason: 'installed-models-fail-verification', verification }
  const loaded = loadManifest()
  const stage = path.join(RELEASES_DIR, `.stage-${RELEASE_ID}`)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  for (const h of HORIZONS) {
    for (const f of bundleFiles(h)) copyFileSync(path.join(MODELS_DIR, f), path.join(stage, f))
  }
  copyFileSync(manifestPath(), path.join(stage, 'manifest.json'))
  mkdirSync(path.dirname(outTarball), { recursive: true })
  execFileSync('tar', ['-czf', outTarball, '-C', stage, '.'])
  const sha = sha256File(outTarball)
  writeFileSync(`${outTarball}.sha256`, `${sha}  ${path.basename(outTarball)}\n`)
  rmSync(stage, { recursive: true, force: true })
  return { ok: true, tarball: outTarball, sha256: sha }
}

/**
 * Install a bundle atomically: extract to tmp dir, verify, swap into place.
 * Keeps a timestamped backup under models/.backup-<ts>/ for rollback.
 */
export function installRelease(tarball) {
  if (!tarball || !existsSync(tarball)) return { ok: false, reason: 'missing-tarball' }
  const tmp = path.join(MODELS_DIR, '.install-tmp')
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  try {
    execFileSync('tar', ['-xzf', path.resolve(tarball), '-C', tmp])
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true })
    return { ok: false, reason: `corrupt-tarball: ${err.message}` }
  }
  // Staged bundle must contain exactly the 5 approved horizons + manifest.
  const staged = verifyInstalled(RELEASE_ID, tmp)
  // Manifest must travel with the bundle (guards against mislabeled drops).
  if (!existsSync(path.join(tmp, 'manifest.json'))) {
    rmSync(tmp, { recursive: true, force: true })
    return { ok: false, reason: 'incomplete-bundle: manifest.json missing' }
  }
  if (!staged.ok) {
    rmSync(tmp, { recursive: true, force: true })
    return { ok: false, reason: 'staged-bundle-fails-verification', verification: staged }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.join(MODELS_DIR, `.backup-${stamp}`)
  mkdirSync(backup, { recursive: true })
  for (const h of HORIZONS) {
    for (const f of bundleFiles(h)) {
      const live = path.join(MODELS_DIR, f)
      if (existsSync(live)) renameSync(live, path.join(backup, f))
      renameSync(path.join(tmp, f), live)
    }
  }
  rmSync(tmp, { recursive: true, force: true })
  pruneBackups(3)
  return { ok: true, backup }
}

function pruneBackups(keep = 3) {
  const backups = readdirSync(MODELS_DIR)
    .filter((d) => d.startsWith('.backup-'))
    .sort()
  while (backups.length > keep) {
    const oldest = backups.shift()
    rmSync(path.join(MODELS_DIR, oldest), { recursive: true, force: true })
  }
}

/** Restore the most recent backup. Returns { ok, ... }. */
export function rollbackRelease() {
  const backups = readdirSync(MODELS_DIR)
    .filter((d) => d.startsWith('.backup-'))
    .sort()
  if (backups.length === 0) return { ok: false, reason: 'no-backup-available' }
  const latest = backups[backups.length - 1]
  const dir = path.join(MODELS_DIR, latest)
  for (const h of HORIZONS) {
    for (const f of bundleFiles(h)) {
      const src = path.join(dir, f)
      if (existsSync(src)) renameSync(src, path.join(MODELS_DIR, f))
    }
  }
  rmSync(dir, { recursive: true, force: true })
  const verification = verifyInstalled()
  return { ok: verification.ok, restored_from: latest, verification }
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2)
  const out = (obj) => {
    console.log(JSON.stringify(obj, null, 2))
    if (!obj.ok) process.exitCode = 1
  }
  if (cmd === 'status') {
    out({ ok: true, release_id: activeReleaseId(), verification: verifyInstalled(), runtime: checkRuntime() })
  } else if (cmd === 'verify') {
    const v = verifyInstalled()
    out({ ...v, runtime: checkRuntime() })
  } else if (cmd === 'package') {
    out(packageRelease(arg || tarballDefault()))
  } else if (cmd === 'install') {
    out(installRelease(arg))
  } else if (cmd === 'rollback') {
    out(rollbackRelease())
  } else {
    console.log('usage: node ml/modelRelease.js <status|verify|package [out]|install <tarball>|rollback>')
    process.exitCode = 2
  }
}
