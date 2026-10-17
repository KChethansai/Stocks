// Regression coverage for the landing stock selector (Oct 2026).
// The shipped control was a read-only input plus decorative category chips:
// it looked functional but could not browse. These tests pin the matching
// rules that make it a real selector.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterStocks, isCurrentSelection, formatAsOfLabel } from './stockSearch.js'

const UNIVERSE = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' }
]

describe('filterStocks', () => {
  it('matches by ticker and by company name', () => {
    assert.deepEqual(filterStocks(UNIVERSE, 'msft').map((s) => s.symbol), ['MSFT'])
    assert.deepEqual(filterStocks(UNIVERSE, 'NVIDIA').map((s) => s.symbol), ['NVDA'])
    assert.deepEqual(filterStocks(UNIVERSE, 'apple').map((s) => s.symbol), ['AAPL'])
    assert.deepEqual(filterStocks(UNIVERSE, 'Microsoft').map((s) => s.symbol), ['MSFT'])
  })

  it('handles case and surrounding whitespace', () => {
    for (const q of ['  aapl  ', 'AaPl', '\tmsft\n', ' nvidia ']) {
      assert.ok(filterStocks(UNIVERSE, q).length >= 1, JSON.stringify(q))
    }
  })

  it('returns every row for an empty or whitespace query', () => {
    assert.equal(filterStocks(UNIVERSE, '').length, UNIVERSE.length)
    assert.equal(filterStocks(UNIVERSE, '   ').length, UNIVERSE.length)
    assert.equal(filterStocks(UNIVERSE, undefined).length, UNIVERSE.length)
  })

  it('returns nothing for a genuine miss, and never fabricates rows', () => {
    const result = filterStocks(UNIVERSE, 'zzzzz')
    assert.deepEqual(result, [])
    // Matching must never introduce a symbol that is not in the universe.
    for (const row of filterStocks(UNIVERSE, 'a')) {
      assert.ok(UNIVERSE.some((s) => s.symbol === row.symbol))
    }
  })

  it('tolerates malformed input', () => {
    assert.deepEqual(filterStocks(undefined, 'aapl'), [])
    assert.deepEqual(filterStocks([null, undefined], 'aapl'), [])
    assert.doesNotThrow(() => filterStocks([{ symbol: 'X' }], 'x'))
  })
})

describe('isCurrentSelection', () => {
  it('rejects a response belonging to a superseded selection', () => {
    assert.equal(isCurrentSelection(3, 3), true)
    assert.equal(isCurrentSelection(2, 3), false)
  })
})

describe('formatAsOfLabel', () => {
  it('omits an absent or invalid timestamp rather than printing junk', () => {
    assert.equal(formatAsOfLabel(0), '')
    assert.equal(formatAsOfLabel(null), '')
    assert.equal(formatAsOfLabel('nonsense'), '')
    assert.match(formatAsOfLabel(new Date().toISOString()), /as of /)
  })
})