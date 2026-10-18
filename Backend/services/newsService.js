// News retrieval: bounded, cached, deduplicated provider access.
//
// Yahoo's `search()` is the only yahoo-finance2 module that carries news (no
// standalone news module in v3.14.1) — verified against the installed package,
// so no second provider or invented endpoint is involved.
//
// Cost control, because the provider is the same one that rate-limits us:
//   * GENERAL_TOPICS is a small, fixed set. The default General view costs
//     those queries ONCE per cache window — it never fans out one feed per
//     stock just to populate the default view.
//   * a 30-minute TTL keeps us far under the provider rate limit, and news
//     tolerates staleness.
//   * concurrent requests for the same key share ONE in-flight promise, so a
//     page that mounts twice (or several users at once) cannot double the bill.
//   * requests are bounded by a timeout so one slow query cannot hold the
//     in-flight promise open and block every later request behind it.
import YahooFinance from 'yahoo-finance2'
import { mergeArticles } from './newsAttribution.js'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const NEWS_TTL_MS = 30 * 60 * 1000
const SEARCH_TIMEOUT_MS = 6000
const CACHE_MAX = 200

// Market-level queries that make the default view genuinely general: broad
// financial markets, macroeconomic developments, business and sector
// reporting.
//
// Measured against the live provider before being fixed here: Yahoo's search
// degrades sharply on long queries — 'business economy' returned 1 row,
// 'federal reserve interest rates' and 'global markets earnings' returned 0.
// Every topic below is one or two words and returned 6-8 rows on the same call,
// and their union is ~2.6x any single topic, so the merge is not dominated by
// one phrasing. Re-measure before changing: a topic that starts returning 0 is
// silently dead weight in a cache window.
export const GENERAL_TOPICS = [
  'stock market',
  'wall street',
  'stock market today',
  'federal reserve',
  'economy',
  'sector rally'
]

export const GENERAL_KEY = '__general__'

const cache = new Map()
const inFlight = new Map()

const remember = (key, value) => {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

/**
 * One bounded provider search.
 *
 * yahoo-finance2's search() accepts no AbortSignal, so the bound is a
 * Promise.race: it stops this function (and therefore the cached loader, and
 * therefore the in-flight promise every later request waits on) from hanging on
 * a stalled socket. An earlier version also built an AbortController and
 * aborted it in `finally`, which was a no-op — it never touched the request and
 * only looked like a bound. The leftover HTTP call is not cancelled; that is
 * stated here rather than implied away.
 */
async function searchOnce(query, newsCount) {
  let timer
  try {
    const results = await Promise.race([
      yahooFinance.search(query, { quotesCount: 0, newsCount }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('news search timeout')), SEARCH_TIMEOUT_MS)
        timer?.unref?.()
      })
    ])
    return results?.news || []
  } catch (err) {
    console.warn(`[News] search failed for "${query}": ${err?.message}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Cached, deduplicated news for a cache key. `loader` returns raw provider
 * articles; the merged result is cached for the TTL.
 */
async function cachedNews(key, loader) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < NEWS_TTL_MS) return { ...hit, cached: true }

  // Share one in-flight promise per key instead of letting every caller make
  // its own provider request.
  const pending = inFlight.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const articles = await loader()
      const entry = { at: Date.now(), articles }
      remember(key, entry)
      return { ...entry, cached: false }
    } catch (err) {
      // Stale cache beats an empty panel; an empty panel beats an error.
      console.error(`[News] loader failed for ${key}:`, err?.message)
      return { at: Date.now(), articles: [], stale: true, error: true, cached: false }
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, promise)
  return promise
}

/** General market news: one bounded fan-out over market-level topics. */
export async function fetchGeneralMarketNews({ limit = 40 } = {}) {
  // `limit` is part of the key. Without it a first request for ?limit=10 cached
  // ten articles under the shared general key, and every request for ?limit=60
  // inside that 30-minute window silently got ten back.
  const key = `${GENERAL_KEY}:${limit}`
  const { articles, cached, stale, error } = await cachedNews(key, async () => {
    const perTopic = Math.max(4, Math.ceil(limit / GENERAL_TOPICS.length))
    const groups = await Promise.all(GENERAL_TOPICS.map((topic) => searchOnce(topic, perTopic)))
    return mergeArticles(groups).slice(0, limit)
  })
  return { articles, cached, stale, error }
}

/**
 * Stock-specific news. The query narrows retrieval; attribution still comes
 * only from the provider's `relatedTickers`, so this view can legitimately
 * contain an article that also appears in the General feed, correctly
 * attributed to the symbol the provider named.
 */
export async function fetchStockNews(symbol, { limit = 20 } = {}) {
  const { articles, cached, stale, error } = await cachedNews(`sym:${symbol}:${limit}`, async () => {
    const raw = await searchOnce(symbol, limit)
    return mergeArticles([raw]).slice(0, limit)
  })
  return { articles, cached, stale, error }
}