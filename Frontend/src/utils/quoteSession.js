// Quote provenance labelling for the order ticket.
//
// Mirrors the backend session-aware policy (Backend/services/quotePolicy.js):
// a genuine last close is usable, but it must never be presented as a live
// price, and an unknown session must not be labelled as verified.
//
// This is the single frontend source of truth. TradeModal renders from it and
// the unit tests assert against it — an earlier version of the test re-declared
// these functions inline, so it asserted a copy and stayed green when the
// shipped component drifted.

// Provider-reported states that mean "not currently in the regular session".
// Mirrors CLOSED_STATES in Backend/services/quotePolicy.js.
export const CLOSED_SESSION_STATES = new Set([
  'PRE',
  'PREPRE',
  'POST',
  'POSTPOST',
  'CLOSED',
  'CLOSEDEXTENDED'
])

// Returns an advisory suffix for the session, or null during a regular session.
export function sessionLabel(marketState) {
  if (marketState === 'REGULAR') return null
  if (CLOSED_SESSION_STATES.has(marketState)) return 'Market closed · fills at last close'
  return 'Session unknown'
}

function timeLabel(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return ` · as of ${d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

// Classifies a quote row for display. `state` drives the indicator colour;
// `label` must never claim a last close is live.
export function provenanceOf(stock) {
  if (!stock || !(Number(stock.price) > 0)) return { state: 'unavailable', label: 'Quote unavailable' }
  if (!stock.lastVerifiedAt || (stock.source && stock.source !== 'yahoo')) {
    return { state: 'unverified', label: 'Unverified quote' }
  }
  if (stock.stale) return { state: 'stale', label: 'Stale quote' }
  const session = sessionLabel(stock.marketState)
  const asOf = timeLabel(stock.asOf || stock.providerTime)
  return {
    state: 'verified',
    label: `${session ?? 'Yahoo Finance'}${asOf}`
  }
}

// Non-blocking disclosure shown on the ticket whenever the displayed quote is
// not currently verified. The server remains authoritative and will still
// refuse anything it cannot verify; this exists so the user is not surprised
// by a price that may be replaced.
export function quoteDisclosure(stock) {
  const quote = provenanceOf(stock)
  if (quote.state === 'verified') return ''
  if (quote.state === 'unavailable') return 'No live quote is loaded. Submitting will attempt to fetch and verify one.'
  if (quote.state === 'stale') return 'This quote is stale. Submitting will refresh it from the provider before filling.'
  return 'This quote is not verified. Submitting will refresh it from the provider before filling.'
}