// Shared history-cache policy: key shape, per-range TTLs, freshness checks.
// Single source of truth for tradeStore (fetch/dedupe) and the OHLC hook
// (visible revalidation). Pure + side-effect free; unit-tested with
// `npm run test:unit` (node --test, zero new dependencies).
//
// TTL rationale: the backend refreshes daily history at most once per day
// (24h server cache) and intraday 60m bars every 15m. Client TTLs (1h daily,
// 15m intraday) sit comfortably inside the server windows, so a "fresh" entry
// can never be staler than what the server would serve anyway.
export const INTRADAY_TTL_MS = 15 * 60 * 1000
export const DAILY_TTL_MS = 60 * 60 * 1000

export function normalizeRange(range) {
  return String(range || 'ALL').toUpperCase()
}

export function historyCacheKey(symbol, range = 'ALL') {
  return `${symbol}|${normalizeRange(range)}`
}

// Symbol/range isolation lives here: different symbols or ranges must never
// share an entry. Returns false for missing, malformed, or future-dated
// entries (clock skew must not grant false freshness).
export function historyTtlMs(range = 'ALL') {
  return normalizeRange(range) === '1D' ? INTRADAY_TTL_MS : DAILY_TTL_MS
}

export function isHistoryFresh(entry, range = 'ALL', now = Date.now()) {
  if (!entry || typeof entry !== 'object') return false
  const fetchedAt = Number(entry.fetchedAt)
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0 || fetchedAt > now) return false
  if (!Array.isArray(entry.data)) return false
  return now - fetchedAt < historyTtlMs(range)
}
