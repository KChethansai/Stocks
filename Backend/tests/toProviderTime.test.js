// Regression coverage for provider-timestamp normalization.
// Run: npm run test:unit (node --test, zero new dependencies).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toProviderTime } from '../config/universe.js'

describe('toProviderTime', () => {
  it('passes through valid Date objects (the real Yahoo shape)', () => {
    const d = new Date('2026-10-15T20:00:01.000Z')
    assert.equal(toProviderTime(d).toISOString(), '2026-10-15T20:00:01.000Z')
  })

  it('accepts epoch seconds (numbers and numeric strings)', () => {
    assert.equal(toProviderTime(1760558401).toISOString(), '2025-10-15T20:00:01.000Z')
    assert.equal(toProviderTime('1760558401').toISOString(), '2025-10-15T20:00:01.000Z')
  })

  it('accepts epoch milliseconds via the 1e12 threshold', () => {
    assert.equal(toProviderTime(1760558401000).toISOString(), '2025-10-15T20:00:01.000Z')
  })

  it('rejects invalid, missing, and unsupported values with null (never a valid-looking date)', () => {
    for (const bad of [null, undefined, '', 'abc', NaN, 0, -5, {}, [], true]) {
      assert.equal(toProviderTime(bad), null, `expected null for ${String(bad)}`)
    }
    assert.equal(toProviderTime(new Date('invalid')), null)
  })

  it('never returns the year-58759 class of garbage for Date inputs', () => {
    // Regression: Number(dateObject) * 1000 once produced year 58759.
    const d = new Date('2026-10-15T20:00:01.000Z')
    const out = toProviderTime(d)
    assert.ok(out.getFullYear() < 3000, `implausible year ${out.getFullYear()}`)
  })
})
