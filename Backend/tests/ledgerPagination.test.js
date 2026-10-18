// Ledger pagination: parameter bounding, filter-before-page, and the honest
// count contract. These pin the failure modes that made the old UI lie.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePage,
  parsePageSize,
  parseSide,
  buildLedgerQuery,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  EXPORT_MAX_ROWS
} from '../services/ledgerPagination.js'

const USER = 'user-1'

describe('parsePage', () => {
  it('defaults to the first page and clamps junk to it', () => {
    for (const raw of [undefined, '', 'abc', 0, -3, NaN, null]) {
      assert.equal(parsePage(raw), 1, String(raw))
    }
  })

  it('accepts a positive integer page', () => {
    assert.equal(parsePage('4'), 4)
    assert.equal(parsePage(4.7), 4)
  })
})

describe('parsePageSize', () => {
  it('falls back to the default for out-of-range or non-numeric input', () => {
    for (const raw of [undefined, '', 'abc', 0, -1, NaN, null]) {
      assert.equal(parsePageSize(raw), DEFAULT_PAGE_SIZE, String(raw))
    }
  })

  it('bounds a hostile page size', () => {
    assert.equal(parsePageSize('100000'), MAX_PAGE_SIZE)
    assert.equal(parsePageSize('999999999999'), MAX_PAGE_SIZE)
    assert.equal(parsePageSize('25'), 25)
  })
})

describe('parseSide', () => {
  it('accepts only BUY and SELL, case-insensitively', () => {
    assert.equal(parseSide('buy'), 'BUY')
    assert.equal(parseSide(' SELL '), 'SELL')
  })

  it('treats anything else as no filter', () => {
    // 'DEPOSIT'/'WITHDRAWAL' exist in the schema but the ledger's segmented
    // control only offers All/Buy/Sell; unknown values must not 500.
    for (const raw of ['deposit', 'drop table', '', null, undefined, 42]) {
      assert.equal(parseSide(raw), null, String(raw))
    }
  })
})

describe('buildLedgerQuery', () => {
  it('always roots ownership at the caller', () => {
    assert.equal(buildLedgerQuery({ userId: USER, side: null, q: '' }).userId, USER)
    assert.equal(buildLedgerQuery({ userId: USER, side: 'BUY', q: 'AAP' }).userId, USER)
  })

  it('applies the side filter before paging', () => {
    assert.equal(buildLedgerQuery({ userId: USER, side: 'SELL', q: '' }).type, 'SELL')
  })

  it('escapes regex metacharacters so a search term cannot throw', () => {
    const q = buildLedgerQuery({ userId: USER, side: null, q: '(unclosed[' })
    assert.ok(Array.isArray(q.$or), 'search still produces a usable filter')
    // Constructing the RegExp is the step that used to throw.
    const symbolRe = q.$or[0].symbol.$regex
    const typeRe = q.$or[1].type.$regex
    assert.equal(symbolRe.source, String.raw`^\(unclosed\[`)
    assert.equal(typeRe.source, String.raw`\(unclosed\[`)
    // Escaped, so the metacharacters match literally instead of acting as a
    // group and a character class.
    assert.ok(symbolRe.test('(unclosed['))
  })

  it('anchors symbol search to the start and matches the side loosely', () => {
    const bySymbol = buildLedgerQuery({ userId: USER, side: null, q: 'aapl' })
    assert.ok(bySymbol.$or[0].symbol.$regex.test('AAPL Inc'))
    assert.equal(bySymbol.$or[0].symbol.$regex.test('GOOGL'), false, 'prefix match, not substring')
    // A separate term for the type clause: 'aapl' must not match a side.
    const bySide = buildLedgerQuery({ userId: USER, side: null, q: 'buy' })
    assert.ok(bySide.$or[1].type.$regex.test('BUY'), 'side search is case-insensitive')
  })

  it('omits the filter entirely when there is no term', () => {
    const q = buildLedgerQuery({ userId: USER, side: null, q: '   ' })
    assert.equal(q.$or, undefined)
  })

  it('caps an overlong search term', () => {
    const q = buildLedgerQuery({ userId: USER, side: null, q: 'A'.repeat(500) })
    // The cap is applied to the escaped term, so allow for the anchor.
    assert.ok(q.$or[0].symbol.$regex.source.length <= 70, q.$or[0].symbol.$regex.source.length)
  })
})

describe('export ceiling', () => {
  it('is declared so a capped export can be reported honestly', () => {
    assert.equal(typeof EXPORT_MAX_ROWS, 'number')
    assert.ok(EXPORT_MAX_ROWS > 0)
  })
})