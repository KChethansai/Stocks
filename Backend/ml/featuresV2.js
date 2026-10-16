/**
 * V2 complementary features — exact JS mirror of ml/python/features_v2.py.
 *
 * Pure functions only: computeV2Row takes trailing-30 arrays (oldest-first)
 * and returns the 15 V2_NEW_COLUMNS in order. Serving-time assembly (history
 * loading, SPY/sector alignment) lives in trainedPredictorV2.js; the math here
 * is parity-tested against the shared fixture ml/python/fixtures/v2_parity.json.
 */
export const V2_NEW_COLUMNS = [
  'ret_1', 'ret_5', 'ret_20', 'gap', 'range', 'close_pos', 'rel_volume',
  'vol_5', 'vol_ratio', 'dist_high', 'dist_low', 'reversal_5_10',
  'mkt_rel_10', 'mkt_rel_5', 'sec_rel_10'
]

export const MIN_V2_CANDLES = 30

const rel = (a, b) => (b ? a / b - 1 : NaN)
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length
const std = (xs) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1))
}

/**
 * @param {{o:number[],h:number[],l:number[],c:number[],v:number[],spy:number[],sec:number[][]}} rows
 * trailing sessions, oldest-first (≥30 each; longer inputs are sliced to the last 30).
 */
export function computeV2Row({ o, h, l, c, v, spy, sec }) {
  for (const [k, arr] of Object.entries({ o, h, l, c, v, spy })) {
    if (!Array.isArray(arr) || arr.length < MIN_V2_CANDLES) throw new Error(`Need ≥30 ${k}`)
  }
  if (!Array.isArray(sec) || sec.some((p) => !Array.isArray(p) || p.length < MIN_V2_CANDLES)) {
    throw new Error('Need ≥30 sector sessions per peer')
  }
  const t = (a) => a.slice(-30)
  const [O, H, L, C, V, S] = [t(o), t(h), t(l), t(c), t(v), t(spy)]
  const P = sec.map(t)
  const last = C[29]
  if (!Number.isFinite(last) || last <= 0) throw new Error('Last close must be finite and > 0')

  const ret1 = rel(C[29], C[28])
  const ret5 = rel(C[29], C[24])
  const ret20 = rel(C[29], C[9])
  const gap = rel(O[29], C[28])
  const range = (H[29] - L[29]) / last
  const closePos = H[29] > L[29] ? (last - L[29]) / (H[29] - L[29]) : 0.5
  const vMean = mean(V.slice(9, 29))
  const relVolume = vMean > 0 ? Math.min(8, Math.max(0, V[29] / vMean)) : 1.0

  const rets = []
  for (let i = 1; i < 30; i += 1) if (C[i - 1] > 0) rets.push((C[i] - C[i - 1]) / C[i - 1])
  const vol5 = std(rets.slice(-5))
  const vol20 = std(rets.slice(-20))
  const volRatio = vol20 > 0 ? vol5 / vol20 : 1.0

  const distHigh = rel(last, Math.max(...H.slice(9, 29)))
  const distLow = rel(last, Math.min(...L.slice(9, 29)))
  const reversal510 = rel(C[24], C[19])

  const cRet10 = rel(C[29], C[19])
  const cRet5 = rel(C[29], C[24])
  const mktRel10 = cRet10 - rel(S[29], S[19])
  const mktRel5 = cRet5 - rel(S[29], S[24])

  const peerRet10 = P.map((p) => rel(p[29], p[19])).filter(Number.isFinite).sort((a, b) => a - b)
  const secMed = peerRet10.length
    ? peerRet10.length % 2
      ? peerRet10[(peerRet10.length - 1) / 2]
      : (peerRet10[peerRet10.length / 2 - 1] + peerRet10[peerRet10.length / 2]) / 2
    : NaN
  const secRel10 = cRet10 - secMed

  return {
    ret_1: ret1, ret_5: ret5, ret_20: ret20, gap, range, close_pos: closePos,
    rel_volume: relVolume, vol_5: vol5, vol_ratio: volRatio,
    dist_high: distHigh, dist_low: distLow, reversal_5_10: reversal510,
    mkt_rel_10: mktRel10, mkt_rel_5: mktRel5, sec_rel_10: secRel10
  }
}
