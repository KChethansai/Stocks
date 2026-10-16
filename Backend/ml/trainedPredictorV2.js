/**
 * EXPERIMENTAL v2 serving path — NOT wired into predictions.
 *
 * assembleV2Row() is the pure, parity-tested assembly of a v2 feature vector
 * from candle arrays (symbol + SPY + sector peers, timestamp-aligned).
 * loadV2Inputs() fetches those histories (DB cache → Yahoo) but is NOT covered
 * by automated tests (it writes to the shared history cache) — do not call it
 * from production code until a v2 model is promoted.
 */
import { ensureHistory } from './history.js'
import { computeFeatures } from './features.js'
import { computeV2Row, V2_NEW_COLUMNS } from './featuresV2.js'
import { SECTOR_OF, SECTORS } from './sectorMap.js'

const byTs = (candles) => {
  const arr = [...(candles || [])]
    .map((c) => ({ t: new Date(c.timestamp).getTime(), c }))
    .sort((a, b) => a.t - b.t)
  return arr
}

/** Last bar at-or-before t (past-only ffill — mirrors Python training). */
const atOrBefore = (sorted, t) => {
  let lo = 0
  let hit = null
  let hi = sorted.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].t <= t) { hit = sorted[mid].c; lo = mid + 1 }
    else hi = mid - 1
  }
  return hit
}

/**
 * Pure assembly — covered by parity tests with static fixtures.
 * @param {Array} candles symbol daily candles (oldest-first not required)
 * @param {Array} spyCandles SPY daily candles
 * @param {Array<Array>} peerCandles sector-peer daily candles (incl. self)
 * @returns {{v1: object, v2: object, vector: number[], asOf: Date}}
 */
export function assembleV2Row(candles, spyCandles, peerCandles) {
  const sym = [...candles].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  if (sym.length < 30) throw new Error(`Need ≥30 symbol sessions (got ${sym.length})`)
  const win = sym.slice(-30)
  const closes = win.map((c) => Number(c.close))
  const spy = byTs(spyCandles)
  const spyCloses = win.map((c) => {
    const t = new Date(c.timestamp).getTime()
    const s = atOrBefore(spy, t)
    if (!s) throw new Error(`no SPY bar at-or-before ${c.timestamp}`)
    return Number(s.close)
  })
  const secCloses = (peerCandles || []).map((peer) => {
    const pm = byTs(peer)
    return win.map((c) => {
      const t = new Date(c.timestamp).getTime()
      const p = atOrBefore(pm, t)
      if (!p) throw new Error('no sector peer bar at-or-before a symbol date')
      return Number(p.close)
    })
  })
  const v1 = computeFeatures(candles)
  if (v1.insufficientData) throw new Error('insufficient history for v1 features')
  const last = v1.lastClose
  const v2 = computeV2Row({
    o: win.map((c) => Number(c.open)), h: win.map((c) => Number(c.high)),
    l: win.map((c) => Number(c.low)), c: closes,
    v: win.map((c) => Number(c.volume) || 0),
    spy: spyCloses, sec: secCloses
  });
  const full = {
    sma5_rel: v1.sma5 / last - 1, sma20_rel: v1.sma20 / last - 1,
    slope_norm: v1.emaTrendSlope / last, intercept_norm: v1.slopeIntercept / last,
    slope_r2: v1.slopeR2, roc10: v1.roc10, volatility: v1.volatility,
    rsi14: Number.isFinite(v1.rsi14) ? v1.rsi14 / 100 : 0.5,
    ...v2
  };
  // Column order MUST equal V2_COLUMNS in ml/python/features_v2.py.
  const V2 = [
    'sma5_rel', 'sma20_rel', 'slope_norm', 'intercept_norm', 'slope_r2',
    'roc10', 'volatility', 'rsi14',
    ...V2_NEW_COLUMNS
  ];
  return { v1, v2, vector: V2.map((k) => full[k]), asOf: v1.asOf, columns: V2 };
}

/** DB-backed loader — EXPERIMENTAL, no automated live test (writes history cache). */
export async function loadV2Inputs(symbol) {
  const ticker = String(symbol || '').toUpperCase().trim()
  const sector = SECTOR_OF[ticker]
  if (!sector) throw new Error(`No sector mapping for ${ticker}`)
  const peers = SECTORS[sector]
  const [candles, spy] = await Promise.all([ensureHistory(ticker), ensureHistory('SPY')])
  if (!candles?.length || !spy?.length) throw new Error('history unavailable')
  const peerHistories = []
  for (const p of peers) {
    const h = await ensureHistory(p)
    if (h?.length) peerHistories.push(h)
  }
  if (!peerHistories.length) throw new Error('no sector peer history')
  return assembleV2Row(candles, spy, peerHistories)
}
