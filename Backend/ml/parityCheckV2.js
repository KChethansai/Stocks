/**
 * V2 JS↔Python parity guard. No DB, no network.
 *   node ml/parityCheckV2.js
 * Loads the shared fixture (ml/python/fixtures/v2_parity.json, written by the
 * Python side) and asserts computeV2Row reproduces every expected value.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { computeV2Row, V2_NEW_COLUMNS } from './featuresV2.js'
import { assembleV2Row } from './trainedPredictorV2.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.join(dir, 'python', 'fixtures', 'v2_parity.json'), 'utf8')
)

assert.deepEqual(V2_NEW_COLUMNS, [
  'ret_1', 'ret_5', 'ret_20', 'gap', 'range', 'close_pos', 'rel_volume',
  'vol_5', 'vol_ratio', 'dist_high', 'dist_low', 'reversal_5_10',
  'mkt_rel_10', 'mkt_rel_5', 'sec_rel_10'
])

for (const [name, kase] of Object.entries(fixture)) {
  if (!kase.inputs) continue // structural cases (e.g. gap_ffill) tested below
  const got = computeV2Row({
    o: kase.inputs.o, h: kase.inputs.h, l: kase.inputs.l,
    c: kase.inputs.c, v: kase.inputs.v, spy: kase.inputs.spy, sec: kase.inputs.sec
  })
  for (const col of V2_NEW_COLUMNS) {
    const want = kase.expected[col]
    assert.ok(
      Math.abs(got[col] - want) < 1e-9,
      `${name}.${col}: js=${got[col]} py=${want}`
    )
  }
  console.log(`  ok  ${name} (15/15 columns)`)
}

// Guards: short input throws, flat range centers, zero volume neutralizes.
assert.throws(() => computeV2Row({ o: [1], h: [1], l: [1], c: [1], v: [1], spy: [1], sec: [[1]] }))
console.log('  ok  short-input guard')

// Gap-day ffill: gappy SPY/peer bars must reproduce Python's past-only
// ffill alignment exactly (serving matches training).
{
  const g = fixture.gap_ffill
  assert.ok(g, 'gap_ffill case present in fixture')
  const candles = g.candles.t.map((t, i) => ({
    timestamp: new Date(t), open: g.candles.o[i], high: g.candles.h[i],
    low: g.candles.l[i], close: g.candles.c[i], volume: g.candles.v[i]
  }))
  const spy = g.spy_gappy.t.map((t, i) => ({ timestamp: new Date(t), close: g.spy_gappy.c[i] }))
  const peers = g.peers_gappy.map((p) =>
    p.t.map((t, i) => ({ timestamp: new Date(t), close: p.c[i] })))
  const row = assembleV2Row(candles, spy, peers)
  assert.equal(row.vector.length, 23)
  for (const col of V2_NEW_COLUMNS) {
    const got = row.vector[row.columns.indexOf(col)]
    assert.ok(Math.abs(got - g.expected[col]) < 1e-9, `gap.${col}: js=${got} py=${g.expected[col]}`)
  }
  console.log('  ok  gap_ffill serving alignment (15/15 columns)')
}

console.log('\nV2 JS↔Python parity: all cases passed\n')
