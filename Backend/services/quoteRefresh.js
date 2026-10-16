// Per-symbol quote-refresh building blocks (side-effect free: safe to import
// from unit tests without booting the API router or touching the database).
import { toProviderTime } from '../config/universe.js'

// Minimum gap between quote refreshes for one user+symbol (abuse + Yahoo
// cost guard for the synchronous single-symbol refresh path).
export const QUOTE_REFRESH_THROTTLE_MS = 30 * 1000

const quoteRefreshLastByKey = new Map()
const pendingRefreshes = new Map()

export function deduplicateQuoteRefresh(symbol, fetchQuote) {
  if (pendingRefreshes.has(symbol)) return pendingRefreshes.get(symbol)
  if (pendingRefreshes.size >= 200) return Promise.reject(new Error('Quote refresh capacity reached'))
  const pending = Promise.resolve().then(fetchQuote).finally(() => pendingRefreshes.delete(symbol))
  pendingRefreshes.set(symbol, pending)
  return pending
}

// Pure throttle check. Returns { ok, retryAfterMs }.
export function refreshAllowed(key, now = Date.now()) {
  const last = quoteRefreshLastByKey.get(key)
  if (last === undefined) return { ok: true, retryAfterMs: 0 }
  const elapsed = now - last
  if (elapsed < QUOTE_REFRESH_THROTTLE_MS) {
    return { ok: false, retryAfterMs: QUOTE_REFRESH_THROTTLE_MS - elapsed }
  }
  return { ok: true, retryAfterMs: 0 }
}

export function rememberRefresh(key, now = Date.now()) {
  // Bounded: throttle keys are caller-influenced (user × symbol), so evict
  // oldest-first instead of growing without limit.
  if (!quoteRefreshLastByKey.has(key) && quoteRefreshLastByKey.size >= 5000) {
    const oldest = quoteRefreshLastByKey.keys().next().value
    quoteRefreshLastByKey.delete(oldest)
  }
  quoteRefreshLastByKey.set(key, now)
}

// Pure row builder. Returns the verified row to persist, or null when the
// provider quote is unusable. Never synthesizes:
// no usable quote → no row (callers must leave the stored row untouched and
// report the failure accurately instead of marking anything fresh).
export function buildVerifiedQuoteRow(base, quote, now = new Date()) {
  if (!base?.symbol || quote?.symbol !== base.symbol || quote?.marketState !== 'REGULAR') return null
  const price = quote?.regularMarketPrice
  if (!Number.isFinite(price) || price <= 0) return null
  const providerTime = toProviderTime(quote.regularMarketTime)
  const age = now.getTime() - providerTime?.getTime()
  // Provider state is not an exchange calendar. Missing/unknown state fails
  // closed; even REGULAR must have a quote within the existing 5-minute window.
  if (!providerTime || !Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return null
  return {
    symbol: base.symbol,
    name: quote?.shortName || quote?.longName || base.name,
    price,
    change: Number(quote?.regularMarketChange) || 0,
    changePercent: Number(quote?.regularMarketChangePercent) || 0,
    volume: Number(quote?.regularMarketVolume) || 0,
    marketCap: Number(quote?.marketCap) || 0,
    sector: base.sector,
    source: 'yahoo',
    asOf: providerTime,
    providerTime,
    lastVerifiedAt: now,
    stale: false
  }
}
