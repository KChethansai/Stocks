// Coverage for the market category taxonomy: every raw universe sector maps
// to exactly one canonical entry, nothing is dropped, unknowns are honest.
// Run: node --test src/utils/sectorTaxonomy.test.js (zero new deps).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSector, canonicalSectorList, UNKNOWN_SECTOR } from './sectorTaxonomy.js'

// Raw sector strings present in Backend/config/universe.js (Oct 2026).
const UNIVERSE_SECTORS = [
  'Technology',
  'Consumer Cyclical',
  'Semiconductors',
  'Automotive',
  'Communication Services',
  'Financial Services',
  'Healthcare',
  'Consumer Defensive',
  'Energy'
]

describe('normalizeSector', () => {
  it('maps every universe sector to a canonical entry (never Unknown)', () => {
    for (const raw of UNIVERSE_SECTORS) {
      const out = normalizeSector(raw)
      assert.notEqual(out, UNKNOWN_SECTOR, raw)
      assert.ok(canonicalSectorList().includes(out), out)
    }
  })

  it('folds equivalents without duplicating labels', () => {
    assert.equal(normalizeSector('Semiconductors'), 'Technology')
    assert.equal(normalizeSector('Automotive'), 'Consumer Cyclical')
    assert.equal(normalizeSector('  TECHNOLOGY  '), 'Technology')
  })

  it('returns Unknown for missing/unrecognized metadata (never drops)', () => {
    assert.equal(normalizeSector(''), UNKNOWN_SECTOR)
    assert.equal(normalizeSector(null), UNKNOWN_SECTOR)
    assert.equal(normalizeSector(undefined), UNKNOWN_SECTOR)
    assert.equal(normalizeSector('Klingon'), UNKNOWN_SECTOR)
  })

  it('canonical list has no duplicates', () => {
    const list = canonicalSectorList()
    assert.equal(new Set(list).size, list.length)
  })
})
