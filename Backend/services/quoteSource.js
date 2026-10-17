// Resilient multi-transport quote fetch.
//
// The primary `yahoo-finance2` quote endpoint and the chart endpoint fail
// independently. During the Oct 2026 partial block the quote endpoint failed
// while the chart endpoint kept answering with the same provider's genuine
// price and timestamp.
//
// Both transports are tried inside ONE circuit-breaker attempt, so a primary
// failure that recovers via the chart endpoint never records a provider
// failure and never opens the circuit.
import { fetchQuotesViaChart } from './chartQuoteSource.js'
import { resolveMarketState } from './sessionClock.js'

/**
 * Normalises a provider quote so every consumer sees a resolved session state.
 * The provider's own state always wins; the chart endpoint supplies none, so
 * the session is derived from the provider's timestamp in the exchange
 * timezone. Unresolvable sessions stay null so the gate fails closed.
 */
export function normalizeProviderQuote(quote) {
  if (!quote) return null
  return {
    ...quote,
    marketState: resolveMarketState(quote.marketState, quote.regularMarketTime, quote.exchangeTimezoneName)
  }
}

/**
 * Fetch quotes for `symbols`, trying the primary transport first and falling
 * back to the chart endpoint. Throws only when BOTH transports fail, so the
 * breaker records one genuine provider failure.
 */
export async function fetchQuotesResilient(symbols, primaryFetch) {
  try {
    const primary = await primaryFetch(symbols)
    const list = Array.isArray(primary) ? primary : [primary]
    return list.filter(Boolean).map(normalizeProviderQuote).filter(Boolean)
  } catch (primaryErr) {
    console.warn(`[Quote Source] Primary transport failed (${primaryErr?.message}); trying the chart endpoint.`)
    const fallback = await fetchQuotesViaChart(symbols)
    return fallback.map(normalizeProviderQuote).filter(Boolean)
  }
}