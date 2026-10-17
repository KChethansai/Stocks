// Session labelling for the order ticket.
//
// These import the SHIPPED module. An earlier version of this file re-declared
// `sessionLabel`/`provenanceOf` inline, so it asserted a copy and stayed green
// while TradeModal drifted away from it — the same class of defect as the
// backend stub that hid two broken arguments.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sessionLabel, provenanceOf, quoteDisclosure, CLOSED_SESSION_STATES } from './quoteSession.js'

describe('sessionLabel', () => {
  it('says nothing extra during a regular session', () => {
    assert.equal(sessionLabel('REGULAR'), null)
  })

  it('never presents a closed-market close as live', () => {
    for (const state of CLOSED_SESSION_STATES) {
      assert.match(sessionLabel(state), /closed/i, state)
      assert.match(sessionLabel(state), /last close/i, state)
    }
  })

  it('flags an unknown session rather than assuming open', () => {
    assert.match(sessionLabel(undefined), /unknown/i)
    assert.match(sessionLabel('WEIRD'), /unknown/i)
  })
})

describe('provenanceOf', () => {
  const verified = { price: 100, source: 'yahoo', lastVerifiedAt: new Date(), stale: false }

  it('still refuses to label unverified or stale data as usable', () => {
    assert.equal(provenanceOf({ ...verified, source: 'unverified' }).state, 'unverified')
    assert.equal(provenanceOf({ price: 100, source: 'yahoo' }).state, 'unverified')
    assert.equal(provenanceOf({ ...verified, stale: true }).state, 'stale')
    assert.equal(provenanceOf({ price: 0 }).state, 'unavailable')
    assert.equal(provenanceOf(null).state, 'unavailable')
  })

  it('carries the timestamp so a last close is auditable', () => {
    const out = provenanceOf({ ...verified, marketState: 'POSTPOST', asOf: new Date('2026-10-16T20:00:01Z') })
    assert.equal(out.state, 'verified')
    assert.match(out.label, /last close/i)
    // Rendered in the viewer's locale, so assert it renders rather than
    // pinning a timezone-dependent day.
    assert.match(out.label, /as of/)
  })

  it('an open session reads as Yahoo Finance without a closed-market claim', () => {
    const out = provenanceOf({ ...verified, marketState: 'REGULAR', asOf: new Date('2026-10-16T15:30:00Z') })
    assert.match(out.label, /Yahoo Finance/)
    assert.doesNotMatch(out.label, /closed/i)
  })

  it('an unknown session is never labelled as a verified live price', () => {
    const out = provenanceOf({ ...verified, marketState: 'MYSTERY' })
    assert.match(out.label, /unknown/i)
  })
})

describe('quoteDisclosure', () => {
  const verified = { price: 100, source: 'yahoo', lastVerifiedAt: new Date(), stale: false }

  it('is silent for a verified quote, including a closed-session last close', () => {
    assert.equal(quoteDisclosure(verified), '')
    assert.equal(quoteDisclosure({ ...verified, marketState: 'POSTPOST' }), '')
  })

  it('tells the user the price may be replaced when it is not verified', () => {
    for (const row of [{ ...verified, stale: true }, { price: 100, source: 'yahoo' }, { price: 0 }]) {
      assert.match(quoteDisclosure(row), /submitting/i, JSON.stringify(row))
    }
  })
})
