// Session-state derivation for provider rows that lack a session field.
//
// Why this exists (Oct 2026): during a partial Yahoo block the quote endpoint
// fails while the chart endpoint keeps answering. The chart response carries
// `regularMarketPrice` and `regularMarketTime` — genuine, provider-stamped —
// but no `marketState`. Rows without a session state fail closed, so the whole
// universe became unusable and trading stopped.
//
// Deriving the session from the provider's own timestamp in the exchange's own
// timezone is not fabrication: the price and the timestamp both come from the
// provider. We are only answering a question the provider left out — "was this
// print inside the regular session?" The answer is a deterministic function of
// the timestamp and the exchange timezone.
//
// Rules (US equities, which is what the universe is):
//   Sat/Sun                         -> CLOSED
//   09:30-16:00 in the exchange TZ  -> REGULAR
//   anything else                   -> CLOSED
//
// A half-day early close (13:00 ET) still falls inside the window, so it
// classifies as REGULAR — the conservative direction, since a genuinely open
// market should not be reported closed. A holiday produces no print at all, so
// no timestamp can land inside the window.
//
// This is a FALLBACK ONLY. A provider-supplied session state always wins, and
// an unparseable timestamp yields null so the caller fails closed.
export const REGULAR_OPEN_MINUTE = 9 * 60 + 30
export const REGULAR_CLOSE_MINUTE = 16 * 60

// Returns { weekday, minute } in the given IANA zone, or null if unparseable.
export function exchangeLocalParts(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(date)
    const get = (type) => parts.find((p) => p.type === type)?.value
    const weekday = get('weekday')
    const hour = Number(get('hour'))
    const minute = Number(get('minute'))
    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null
    return { weekday, minute: hour * 60 + minute }
  } catch {
    // An unknown IANA zone must not be guessed at.
    return null
  }
}

/**
 * Derive a market state from a provider timestamp and exchange timezone.
 * Returns 'REGULAR' | 'CLOSED', or null when it cannot be determined.
 */
export function deriveMarketState(providerTime, timeZone = 'America/New_York') {
  const local = exchangeLocalParts(providerTime, timeZone)
  if (!local) return null
  if (local.weekday === 'Sat' || local.weekday === 'Sun') return 'CLOSED'
  const inSession = local.minute >= REGULAR_OPEN_MINUTE && local.minute < REGULAR_CLOSE_MINUTE
  return inSession ? 'REGULAR' : 'CLOSED'
}

// The states the provider is actually known to emit. Anything else is not a
// session we should trust: a garbage string must not be treated as a real
// state, and must not silently read as "regular".
export const KNOWN_MARKET_STATES = new Set([
  'REGULAR',
  'PRE',
  'PREPRE',
  'POST',
  'POSTPOST',
  'CLOSED',
  'CLOSEDEXTENDED'
])

/**
 * A *recognised* provider state wins; otherwise derive from the provider's own
 * timestamp. Returns null when neither source can answer, so callers fail
 * closed.
 */
export function resolveMarketState(providerState, providerTime, timeZone) {
  if (typeof providerState === 'string' && KNOWN_MARKET_STATES.has(providerState.trim().toUpperCase())) {
    return providerState.trim().toUpperCase()
  }
  return deriveMarketState(providerTime, timeZone)
}