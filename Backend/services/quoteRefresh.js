// Per-symbol quote-refresh building blocks (side-effect free: safe to import
// from unit tests without booting the API router or touching the database).
import { toProviderTime } from '../config/universe.js'
import { isClosedSessionState, QUOTE_FRESH_MAX_AGE_MS, MAX_CLOSED_QUOTE_AGE_MS } from './quotePolicy.js'

// Minimum gap between quote refreshes for one user+symbol (abuse + Yahoo
// cost guard for the synchronous single-symbol refresh path).
export const QUOTE_REFRESH_THROTTLE_MS = 30 * 1000

const quoteRefreshLastByKey = new Map()
const pendingRefreshes = new Map()

export function deduplicateQuoteRefresh(symbol, fetchQuote) {
  if (pendingRefreshes.has(symbol)) return pendingRefreshes.get(symbol)
  if (pendingRefreshes.size >= 200) return Promise.reject(new Error('Quote refresh capacity reached'))
  // The symbol is handed to the fetcher: callers may close over it (the
  // manual route) or take it as a positional argument (the execution path).
  // Calling `fetchQuote` bare passed `undefined` and made the provider fetch
  // nothing.
  const pending = Promise.resolve()
    .then(() => fetchQuote(symbol))
    .finally(() => pendingRefreshes.delete(symbol))
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

// Global (not per-user) cooldown between execution-path refreshes of the same
// symbol. The provider budget is shared, so many accounts must not multiply
// requests for one ticker; short enough that a genuine retry succeeds.
export const EXECUTION_REFRESH_COOLDOWN_MS = 10 * 1000

// Upper bound on one execution-path provider request. The trade queue is
// serialised per user, so an unbounded fetch is a availability risk, not
// just a slow path.
export const EXECUTION_REFRESH_TIMEOUT_MS = 8 * 1000

function withTimeout(promise, ms, message) {
  let timer
  const guard = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
    // Never hold the process open for this timer.
    timer?.unref?.()
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer))
}

const executionRefreshLastBySymbol = new Map()

// Pure cooldown check for the execution path.
export function executionRefreshAllowed(symbol, now = Date.now()) {
  const last = executionRefreshLastBySymbol.get(symbol)
  if (last === undefined) return true
  return now - last >= EXECUTION_REFRESH_COOLDOWN_MS
}

export function rememberExecutionRefresh(symbol, now = Date.now()) {
  if (!executionRefreshLastBySymbol.has(symbol) && executionRefreshLastBySymbol.size >= 500) {
    const oldest = executionRefreshLastBySymbol.keys().next().value
    executionRefreshLastBySymbol.delete(oldest)
  }
  executionRefreshLastBySymbol.set(symbol, now)
}

/**
 * Refresh one symbol for the execution path and return the verified row, or
 * null when the quote is unusable, the provider is unavailable, or the
 * shared cooldown blocks another request.
 *
 * `base` is the stored row being superseded — it supplies the identity fields
 * (symbol, name, sector) that must survive the refresh, and its symbol is the
 * one the provider is asked for.
 *
 * This automates the step the old flow asked the user to perform by hand
 * (click Refresh, then retry). It does not relax any rule: the row is built
 * by the same `buildVerifiedQuoteRow` gate, so a closed session, mismatched
 * symbol, stale provider time, or non-positive price still returns null and
 * the caller still rejects the order.
 */
export async function refreshSymbolForExecution(base, fetchQuote, now = Date.now()) {
  const symbol = base?.symbol
  if (!symbol) return null
  if (!executionRefreshAllowed(symbol, now)) return null
  let quotes
  try {
    // Bounded: the caller runs inside a per-user serialised trade queue, so a
    // hung provider request would otherwise block that user indefinitely.
    quotes = await withTimeout(
      deduplicateQuoteRefresh(symbol, fetchQuote),
      EXECUTION_REFRESH_TIMEOUT_MS,
      'Quote provider timed out'
    )
  } catch {
    // The cooldown is deliberately NOT consumed on failure. A transient
    // provider error must not cost every account on this symbol a 10s wait,
    // and a rate-limit must never be reported to a user as a data failure.
    return null
  }
  const list = Array.isArray(quotes) ? quotes : [quotes]
  const row = buildVerifiedQuoteRow(base, list.find((q) => q?.symbol === symbol) ?? null, new Date(now))
  // Only a genuinely verified result spends the shared cooldown. Concurrent
  // callers are still collapsed by `deduplicateQuoteRefresh`, so this cannot
  // produce a stampede.
  if (row) rememberExecutionRefresh(symbol, now)
  return row
}

export function buildVerifiedQuoteRow(base, quote, now = new Date()) {
  if (!base?.symbol || quote?.symbol !== base.symbol) return null
  const price = quote?.regularMarketPrice
  if (!Number.isFinite(price) || price <= 0) return null
  const providerTime = toProviderTime(quote.regularMarketTime)
  const age = now.getTime() - providerTime?.getTime()
  // Session-aware freshness, matching the execution policy: a closed market's
  // last close is authoritative for the session that just ended and must not
  // decay overnight, but it is still bounded, and an unknown session state
  // fails closed. Provider state is not an exchange calendar.
  if (!providerTime || !Number.isFinite(age) || age < 0) return null
  if (quote.marketState === 'REGULAR') {
    if (age > QUOTE_FRESH_MAX_AGE_MS) return null
  } else if (isClosedSessionState(quote.marketState)) {
    if (age > MAX_CLOSED_QUOTE_AGE_MS) return null
  } else {
    return null
  }
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
    // Session state is provenance, not decoration: the execution gate keys on
    // it, so it must travel with the row. Omitting it made every refreshed
    // row fail the gate as "unknown session" — callers that patched it in
    // afterwards were papering over a builder gap.
    marketState: quote.marketState,
    lastVerifiedAt: now,
    stale: false
  }
}
