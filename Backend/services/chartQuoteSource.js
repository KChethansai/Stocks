// Secondary transport for the same provider.
//
// Oct 2026: during a partial Yahoo block the quote endpoint failed while the
// chart endpoint kept answering with genuine, provider-stamped data
// (`regularMarketPrice` + `regularMarketTime`). Because a single failing
// endpoint took the whole app down, the chart endpoint is now a fallback.
//
// This is NOT a different data source and NOT synthetic data: it is the same
// provider's own price and timestamp, read from its chart endpoint. The chart
// response carries no `marketState`, so the session is derived from the
// provider's own timestamp in the exchange timezone (see sessionClock.js) —
// and only when the provider supplied nothing.
//
// Failures here are classified exactly like the primary path so the circuit
// breaker treats them identically.
const CHART_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']

function toProviderQuote(symbol, meta) {
  const price = Number(meta?.regularMarketPrice)
  const price2 = Number(meta?.previousClose)
  if (!Number.isFinite(price) || price <= 0) {
    if (!Number.isFinite(price2) || price2 <= 0) return null
  }
  const stamp = Number(meta?.regularMarketTime)
  const when = Number.isFinite(stamp) ? new Date(stamp * 1000) : null
  if (!when || Number.isNaN(when.getTime())) return null
  return {
    symbol,
    shortName: meta?.shortName || meta?.longName || symbol,
    regularMarketPrice: Number.isFinite(price) && price > 0 ? price : price2,
    regularMarketChange: Number(meta?.chartPreviousClose)
      ? price - Number(meta.chartPreviousClose)
      : 0,
    regularMarketChangePercent: Number(meta?.chartPreviousClose)
      ? ((price - Number(meta.chartPreviousClose)) / Number(meta.chartPreviousClose)) * 100
      : 0,
    regularMarketVolume: Number(meta?.regularMarketVolume) || 0,
    marketCap: Number(meta?.marketCap) || 0,
    regularMarketTime: when,
    // The chart endpoint does not report a session; null lets the caller
    // derive it from `regularMarketTime` + `exchangeTimezoneName`.
    marketState: meta?.marketState ?? null,
    exchangeTimezoneName: meta?.exchangeTimezoneName || 'America/New_York'
  }
}

/**
 * Fetch one symbol via the chart endpoint. Returns a provider-shaped quote or
 * throws so the caller can classify it.
 */
export async function fetchQuoteViaChart(symbol, { timeoutMs = 6000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  timer?.unref?.()
  let lastErr
  try {
    for (const host of CHART_HOSTS) {
      try {
        const res = await fetch(
          `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketForge/1.0)' }
          }
        )
        if (!res.ok) {
          lastErr = Object.assign(new Error(`chart endpoint ${res.status}`), { status: res.status })
          continue
        }
        const body = await res.json()
        const result = body?.chart?.result?.[0]
        if (!result?.meta) {
          lastErr = new Error('chart response had no meta')
          continue
        }
        const quote = toProviderQuote(result.meta.symbol || symbol, result.meta)
        if (quote) return quote
        lastErr = new Error('chart response had no usable price')
      } catch (err) {
        lastErr = err.name === 'AbortError' ? Object.assign(new Error('ChartProviderTimeout'), { name: 'ChartProviderTimeout' }) : err
      }
    }
    throw lastErr ?? new Error('chart endpoint unavailable')
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch many symbols through the chart endpoint, preserving input order. */
export async function fetchQuotesViaChart(symbols, opts) {
  const out = []
  for (const symbol of symbols) {
    const quote = await fetchQuoteViaChart(symbol, opts)
    if (quote) out.push(quote)
  }
  return out
}