// Execution policy for paper fills.
//
// Design rule (Oct 2026): GENUINE provenance is always mandatory; the
// freshness limit is session-aware. A paper-trading simulator must remain
// usable outside regular trading hours — an earlier REGULAR-only rule made
// every order fail on evenings and weekends, which is exactly the "cannot
// buy or sell" defect.
//
// - Regular session: the quote must be current (≤ QUOTE_FRESH_MAX_AGE_MS).
// - Closed session (PRE/POST/CLOSED/…): the provider's last close is
//   authoritative for the session that just ended, so it does not decay into
//   "stale" overnight. It is still bounded by MAX_CLOSED_QUOTE_AGE_MS so a
//   months-old row can never fill, and callers must present it as a last
//   close, never as a live price.
// - Unknown/absent session state: fail closed.
// - Unverified, mismatched, future-dated, non-positive or synthetic data:
//   always rejected, in every session.
import { toProviderTime } from '../config/universe.js'

export const QUOTE_FRESH_MAX_AGE_MS = 5 * 60 * 1000

// A closed-session quote must still belong to a recent completed session.
export const MAX_CLOSED_QUOTE_AGE_MS = 7 * 24 * 60 * 60 * 1000

const REGULAR_STATES = new Set(['REGULAR'])
const CLOSED_STATES = new Set(['PRE', 'PREPRE', 'POST', 'POSTPOST', 'CLOSED', 'CLOSEDEXTENDED'])

// Single classification used by the execution gate and the row builder, so
// the two can never disagree about what counts as a closed session.
export function isClosedSessionState(marketState) {
  return CLOSED_STATES.has(marketState)
}

export function isExecutableQuote(stock, symbol = stock?.symbol, now = Date.now()) {
  if (!stock || stock.symbol !== symbol) return false
  if (stock.source !== 'yahoo' || stock.stale) return false
  if (!Number.isFinite(stock.price) || stock.price <= 0) return false

  const providerTime = toProviderTime(stock.providerTime)?.getTime()
  const verifiedAt = toProviderTime(stock.lastVerifiedAt)?.getTime()
  if (!Number.isFinite(providerTime) || !Number.isFinite(verifiedAt)) return false

  const providerAge = now - providerTime
  const verifiedAge = now - verifiedAt
  // A provider or verification timestamp from the future is never acceptable.
  if (providerAge < 0 || verifiedAge < 0) return false

  if (REGULAR_STATES.has(stock.marketState)) {
    return providerAge <= QUOTE_FRESH_MAX_AGE_MS && verifiedAge <= QUOTE_FRESH_MAX_AGE_MS
  }
  if (isClosedSessionState(stock.marketState)) {
    return providerAge <= MAX_CLOSED_QUOTE_AGE_MS
  }
  // Unknown or absent session state fails closed.
  return false
}