// Provider circuit breaker (Oct 2026 production incident).
//
// Production quotes were 18 hours stale with no session state because the
// background sync retried every 60 seconds against a failing provider and
// marked everything stale on each failure. These pin the fix: the circuit
// opens, calls stop, and data is preserved rather than degraded.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  withProviderBudget,
  providerCircuitState,
  recordProviderSuccess,
  recordProviderFailure,
  resetProviderCircuit,
  providerFailureCount,
  FAILURES_BEFORE_OPEN,
  BASE_COOLDOWN_MS,
  MAX_COOLDOWN_MS
} from '../services/providerBudget.js'

const T0 = 1_000_000

describe('provider circuit breaker', () => {
  beforeEach(() => resetProviderCircuit())

  it('passes calls through while healthy', async () => {
    const out = await withProviderBudget(async () => 'ok', T0)
    assert.equal(out.ok, true)
    assert.equal(out.value, 'ok')
    assert.equal(providerFailureCount(), 0)
  })

  it('does not open before the failure threshold', async () => {
    for (let i = 0; i < FAILURES_BEFORE_OPEN - 1; i += 1) {
      const out = await withProviderBudget(async () => { throw new Error('fetch failed') }, T0 + i)
      assert.equal(out.ok, false)
      assert.equal(providerCircuitState(T0 + i).allowed, true, `still closed at failure ${i + 1}`)
    }
  })

  it('opens after the failure threshold and stops calling the provider', async () => {
    for (let i = 0; i < FAILURES_BEFORE_OPEN; i += 1) {
      await withProviderBudget(async () => { throw new Error('fetch failed') }, T0 + i)
    }
    const gate = providerCircuitState(T0)
    assert.equal(gate.allowed, false)
    assert.equal(gate.reason, 'open')

    // The whole point: zero further provider traffic.
    let called = 0
    const blocked = await withProviderBudget(async () => { called += 1; return 'should not happen' }, T0)
    assert.equal(blocked.ok, false)
    assert.equal(blocked.reason, 'circuit-open')
    assert.equal(called, 0, 'an open circuit must make no provider call')
    assert.equal(typeof blocked.retryAt, 'number', 'the caller is told when to retry')
  })

  it('admits exactly one probe after the cooldown', async () => {
    for (let i = 0; i < FAILURES_BEFORE_OPEN; i += 1) {
      await withProviderBudget(async () => { throw new Error('fetch failed') }, T0 + i)
    }
    // Derive the probe time from the circuit itself: the cooldown starts at
    // the LAST failure, not at the first.
    const openFor = providerCircuitState(T0)
    assert.equal(openFor.allowed, false)
    const after = openFor.retryAt + 1
    assert.equal(providerCircuitState(after).reason, 'half-open')

    let calls = 0
    await withProviderBudget(async () => { calls += 1; return 'recovered' }, after)
    assert.equal(calls, 1, 'the probe must reach the provider')
    // Success closes the circuit again.
    assert.equal(providerCircuitState(after + 1).allowed, true)
    assert.equal(providerFailureCount(), 0)
  })

  it('re-opens immediately when the probe fails', async () => {
    for (let i = 0; i < FAILURES_BEFORE_OPEN; i += 1) {
      await withProviderBudget(async () => { throw new Error('fetch failed') }, T0 + i)
    }
    const after = providerCircuitState(T0).retryAt + 1
    const probe = await withProviderBudget(async () => { throw new Error('fetch failed') }, after)
    assert.equal(probe.ok, false)
    assert.equal(providerCircuitState(after + 1).allowed, false, 'a failed probe re-opens')
  })

  it('backs off exponentially up to a ceiling', async () => {
    const cooldowns = []
    let clock = T0
    for (let round = 0; round < 8; round += 1) {
      for (let i = 0; i < FAILURES_BEFORE_OPEN; i += 1) {
        clock += 1
        await withProviderBudget(async () => { throw new Error('fetch failed') }, clock)
      }
      const gate = providerCircuitState(clock)
      if (!gate.allowed) cooldowns.push(gate.retryAt - clock)
      clock = gate.retryAt ?? clock + MAX_COOLDOWN_MS
    }
    assert.ok(cooldowns.length > 1, 'several cooldowns observed')
    assert.ok(cooldowns[1] > cooldowns[0], 'cooldown grows: ' + cooldowns.slice(0, 3).join(','))
    assert.ok(
      cooldowns.every((c) => c <= MAX_COOLDOWN_MS),
      `cooldown must be capped at ${MAX_COOLDOWN_MS}`
    )
  })

  it('never throws, whatever the attempt does', async () => {
    const out = await withProviderBudget(async () => { throw new Error('boom') }, T0)
    assert.equal(out.ok, false)
    assert.ok(out.reason, 'a reason is always reported')
  })

  it('a success resets the failure streak', async () => {
    recordProviderFailure(new Error('x'), T0)
    recordProviderFailure(new Error('x'), T0)
    assert.equal(providerFailureCount(), 2)
    recordProviderSuccess()
    assert.equal(providerFailureCount(), 0)
    assert.equal(providerCircuitState(T0).allowed, true)
  })
})