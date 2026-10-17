// Shared provider budget + circuit breaker.
//
// The Oct 2026 production incident: the background sync retried every 60s
// against a failing provider. Each failure ran `updateMany({}, {stale:true})`
// and never wrote a fresh row, so quotes sat 18 hours stale with no session
// state, the execution gate failed closed, and orders were rejected. Worse,
// ~1440 wasted provider calls per day kept the provider rejecting us.
//
// An unbounded retry loop against a failing provider is the defect, not the
// provider being down. This bounds it: after a few consecutive failures the
// circuit opens and NO provider call is made until a cooldown expires, at
// which point exactly one probe is allowed through.
//
// Pure and side-effect free (module-global state only), so it is unit tested
// without a network or a clock dependency beyond an injected `now`.
import { classifyProviderError } from './quoteRefresh.js'

export const FAILURES_BEFORE_OPEN = 3
export const BASE_COOLDOWN_MS = 60 * 1000
export const MAX_COOLDOWN_MS = 15 * 60 * 1000

// Kept separate from the quote payload so a provider outage never masquerades
// as "this data is stale". The UI shows "provider cooling down" instead of a
// red stale badge when the last close is still perfectly valid for its session.
let state = {
  failures: 0,
  openUntil: 0,
  probing: false
}

// Pure query — no side effects. Admission happens in `withProviderBudget`.
export function providerCircuitState(now = Date.now()) {
  // A probe is already in flight; let it finish rather than letting a second
  // caller slip past while the circuit is half-open.
  if (state.probing) return { allowed: false, reason: 'probing', retryAt: state.openUntil }
  if (state.openUntil > now) return { allowed: false, reason: 'open', retryAt: state.openUntil }
  if (state.openUntil !== 0 && state.openUntil <= now) return { allowed: true, reason: 'half-open' }
  return { allowed: true, reason: 'closed' }
}

export function recordProviderSuccess() {
  state = { failures: 0, openUntil: 0, probing: false }
}

export function recordProviderFailure(err, now = Date.now()) {
  const wasProbing = state.probing
  state.probing = false
  state.failures += 1
  if (!wasProbing && state.failures < FAILURES_BEFORE_OPEN) return state.failures
  const exponent = Math.max(0, state.failures - FAILURES_BEFORE_OPEN)
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** exponent, MAX_COOLDOWN_MS)
  state.openUntil = now + cooldown
  return state.failures
}

// Test-only: reset module-global breaker state between cases.
export function resetProviderCircuit() {
  state = { failures: 0, openUntil: 0, probing: false }
}

export function providerFailureCount() {
  return state.failures
}

/**
 * Run `attempt` under the shared budget.
 *
 * Returns `{ ok: true, value }` on success, `{ ok: false, reason }` when the
 * circuit is open (no provider call is made at all) or every attempt failed.
 * Never throws: callers decide how to surface a degraded result.
 */
export async function withProviderBudget(attempt, now = Date.now()) {
  const gate = providerCircuitState(now)
  if (!gate.allowed) {
    return { ok: false, reason: 'circuit-open', retryAt: gate.retryAt }
  }
  // Admitting a half-open probe claims the single probe slot.
  if (gate.reason === 'half-open') state.probing = true
  try {
    const value = await attempt()
    recordProviderSuccess()
    return { ok: true, value }
  } catch (err) {
    const classified = classifyProviderError(err)
    recordProviderFailure(err, now)
    return { ok: false, reason: classified.kind, error: err }
  }
}