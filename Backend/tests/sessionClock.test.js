// Session-state derivation (Oct 2026).
//
// Rows that lack a provider session field failed closed, which made the whole
// universe unusable during a partial provider block. The session is derived
// from the provider's own timestamp in the exchange's timezone.
//
// These pin the cases that must NOT be guessed: an unparseable timestamp, an
// unknown timezone, and any attempt to override a provider-supplied state.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveMarketState,
  resolveMarketState,
  exchangeLocalParts,
  REGULAR_OPEN_MINUTE,
  REGULAR_CLOSE_MINUTE
} from '../services/sessionClock.js'

const ET = 'America/New_York'
const at = (iso) => new Date(iso)

describe('exchangeLocalParts', () => {
  it('converts to the exchange timezone', () => {
    const p = exchangeLocalParts(at('2026-10-16T20:00:01Z'), ET)
    assert.equal(p.weekday, 'Fri')
    assert.equal(p.minute, 16 * 60, 'Friday 20:00 UTC is the 16:00 ET close')
  })

  it('returns null for an unusable input instead of guessing', () => {
    assert.equal(exchangeLocalParts(null, ET), null)
    assert.equal(exchangeLocalParts(new Date('nonsense'), ET), null)
    assert.equal(exchangeLocalParts(at('2026-10-16T20:00:01Z'), 'Not/AZone'), null)
  })
})

describe('deriveMarketState', () => {
  it('classifies the Friday close as CLOSED, not a live intraday quote', () => {
    assert.equal(deriveMarketState(at('2026-10-16T20:00:01Z'), ET), 'CLOSED')
  })

  it('classifies mid-session prints as REGULAR', () => {
    // Friday 10:00 ET and 15:59 ET.
    assert.equal(deriveMarketState(at('2026-10-16T14:00:00Z'), ET), 'REGULAR')
    assert.equal(deriveMarketState(at('2026-10-16T19:59:00Z'), ET), 'REGULAR')
  })

  it('treats the opening bell and the closing bell correctly', () => {
    // 09:30 ET is the open; 16:00 ET is the close.
    assert.equal(deriveMarketState(at('2026-10-16T13:30:00Z'), ET), 'REGULAR')
    assert.equal(deriveMarketState(at('2026-10-16T20:00:00Z'), ET), 'CLOSED')
    assert.equal(REGULAR_OPEN_MINUTE, 570)
    assert.equal(REGULAR_CLOSE_MINUTE, 960)
  })

  it('treats weekends as CLOSED', () => {
    assert.equal(deriveMarketState(at('2026-10-17T15:00:00Z'), ET), 'CLOSED') // Sat 11:00
    assert.equal(deriveMarketState(at('2026-10-18T15:00:00Z'), ET), 'CLOSED') // Sun 11:00
  })

  it('treats pre-market and after-hours prints as CLOSED', () => {
    assert.equal(deriveMarketState(at('2026-10-16T11:00:00Z'), ET), 'CLOSED') // 07:00 ET
    assert.equal(deriveMarketState(at('2026-10-17T02:00:00Z'), ET), 'CLOSED') // 22:00 ET Fri
  })

  it('keeps a half-day early close inside the session', () => {
    // Thanksgiving Friday closes at 13:00 ET. Reporting a genuinely open
    // market as closed would be the unsafe direction.
    assert.equal(deriveMarketState(at('2026-11-27T17:30:00Z'), ET), 'REGULAR')
  })

  it('returns null when the timestamp cannot be read', () => {
    assert.equal(deriveMarketState(null, ET), null)
    assert.equal(deriveMarketState(new Date('bad'), ET), null)
  })
})

describe('resolveMarketState', () => {
  it('never overrides a provider-supplied state', () => {
    assert.equal(resolveMarketState('POSTPOST', at('2026-10-16T14:00:00Z'), ET), 'POSTPOST')
    assert.equal(resolveMarketState('REGULAR', at('2026-10-17T15:00:00Z'), ET), 'REGULAR')
    assert.equal(resolveMarketState('PRE', at('2026-10-16T14:00:00Z'), ET), 'PRE')
  })

  it('derives only when the provider supplied nothing', () => {
    assert.equal(resolveMarketState(undefined, at('2026-10-16T20:00:01Z'), ET), 'CLOSED')
    assert.equal(resolveMarketState(null, at('2026-10-16T14:00:00Z'), ET), 'REGULAR')
    assert.equal(resolveMarketState('  ', at('2026-10-16T14:00:00Z'), ET), 'REGULAR')
  })

  it('returns null when neither source can answer, so callers fail closed', () => {
    assert.equal(resolveMarketState(undefined, null, ET), null)
    assert.equal(resolveMarketState(undefined, new Date('bad'), ET), null)
  })
})
describe('resolveMarketState trust boundary', () => {
  it('honours only recognised provider states', () => {
    for (const known of ['REGULAR', 'CLOSED', 'POSTPOST', 'PRE', 'PREPRE', 'POST', 'CLOSEDEXTENDED']) {
      assert.equal(resolveMarketState(known, at('2026-10-16T20:00:01Z'), ET), known)
    }
  })

  it('does not treat an unrecognised state as a real session', () => {
    // A garbage string must be derived from the timestamp, not trusted, and
    // never read as "regular".
    for (const bogus of ['UNKNOWN', 'WAT', 'banana', 'REGULARISH', '42']) {
      const out = resolveMarketState(bogus, at('2026-10-16T20:00:01Z'), ET)
      assert.equal(out, 'CLOSED', `${bogus} should be derived, not trusted`)
    }
  })

  it('normalises case and whitespace of a real state', () => {
    assert.equal(resolveMarketState('  postpost ', at('2026-10-16T14:00:00Z'), ET), 'POSTPOST')
  })
})
