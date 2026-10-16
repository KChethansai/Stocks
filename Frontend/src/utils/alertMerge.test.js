// Regression coverage for the bell read-state merge (poll vs confirmed
// reads, badge derivation, confirmed-set pruning).
// Run: node --test src/utils/alertMerge.test.js (zero new deps).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeAlertsWithConfirmed } from './alertMerge.js'

const row = (id, read) => ({ _id: id, symbol: 'AAPL', read })

describe('mergeAlertsWithConfirmed', () => {
  it('preserves unread events outside the latest-50 inbox window', () => {
    const result = mergeAlertsWithConfirmed([row('a1', false)], new Set(['a1']), 73)
    assert.equal(result.unreadCount, 72)
  })
  it('keeps a confirmed read across a stale poll payload', () => {
    const { alerts, unreadCount } = mergeAlertsWithConfirmed(
      [row('a1', false), row('a2', false)], new Set(['a1'])
    )
    assert.equal(alerts.find((a) => a._id === 'a1').read, true)
    assert.equal(alerts.find((a) => a._id === 'a2').read, false)
    assert.equal(unreadCount, 1)
  })

  it('an unchanged event does not become unread again; a new event can', () => {
    const first = mergeAlertsWithConfirmed([row('a1', false)], new Set(['a1']))
    assert.equal(first.alerts[0].read, true)
    // Same event still read on the next poll.
    const second = mergeAlertsWithConfirmed([row('a1', true)], first.liveConfirmedIds)
    assert.equal(second.alerts[0].read, true)
    // A genuinely new event arrives unread and counts.
    const third = mergeAlertsWithConfirmed([row('a1', true), row('a2', false)], second.liveConfirmedIds)
    assert.equal(third.unreadCount, 1)
  })

  it('derives the badge from the merged list, not a separate counter', () => {
    const { unreadCount } = mergeAlertsWithConfirmed(
      [row('a1', true), row('a2', true)], new Set()
    )
    assert.equal(unreadCount, 0)
  })

  it('prunes confirmed ids whose rows no longer exist', () => {
    const { liveConfirmedIds } = mergeAlertsWithConfirmed([row('a1', true)], new Set(['a1', 'gone']))
    assert.deepEqual([...liveConfirmedIds], ['a1'])
  })

  it('tolerates empty payloads', () => {
    const { alerts, unreadCount } = mergeAlertsWithConfirmed([], new Set(['a1']))
    assert.deepEqual(alerts, [])
    assert.equal(unreadCount, 0)
  })
})
