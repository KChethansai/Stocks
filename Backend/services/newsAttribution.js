// News aggregation with honest article attribution.
//
// Two defects this fixes (Oct 2026):
//
// 1. MISATTRIBUTION. The old code queried `yahooFinance.search(symbol)` and
//    then stamped `symbol: <the query symbol>` onto EVERY returned article.
//    Yahoo's search is a *retrieval* endpoint: it returns whatever matched the
//    query, not articles about that entity. So a Motley Fool piece about Tesla
//    earnings came back from the NVDA query and was labelled "NVDA". The
//    retrieval query is not evidence of subject.
//
//    Yahoo DOES publish the subject: every news item carries `relatedTickers`
//    (verified live: a stock-market-crash ETF piece carries ["NVDA"]; an
//    Opendoor piece carries ["OPEN","^IXIC","Z","^GSPC"]). That is the
//    provider's own entity metadata and is the only thing used for
//    attribution now. A ticker is attached when the provider attached it, and
//    an article with no related ticker gets none — unsupported associations are
//    omitted rather than guessed.
//
// 2. NO GENERAL NEWS. "All symbols" meant "six per-symbol feeds merged", which
//    is not general market news. Yahoo's search accepts market-level queries
//    and returns index moves, macro developments, business and sector
//    reporting. A small bounded set of those queries now backs the default
//    view, so the default page is genuinely about the market rather than about
//    whichever six tickers the user happens to hold.
//
// Every retained field is provider-supplied: publisher, publication time
// (`providerPublishTime`), original URL, thumbnail and summary. Publication
// time and fetch time are kept separate — an article is old because it is old,
// not because we fetched it late.
import { baseStocks } from '../config/universe.js'

// Index/futures symbols Yahoo attaches to broad-market stories. They are real
// provider associations but they are not tradeable stocks in the tracked
// universe, so they are labelled rather than linked as tickers.
const INDEX_LABELS = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'Nasdaq',
  '^DJI': 'Dow Jones',
  '^RUT': 'Russell 2000',
  '^VIX': 'VIX',
  '^N225': 'Nikkei 225',
  '^FTSE': 'FTSE 100',
  '^GDAXI': 'DAX',
  '^STOXX50E': 'Euro Stoxx 50',
  'GC=F': 'Gold',
  'CL=F': 'Crude Oil',
  'DX-Y.NYB': 'US Dollar Index',
  '^TNX': 'US 10Y Yield'
}

const UNIVERSE = new Set(baseStocks.map((s) => s.symbol))

// Canonical article identity. Normalized URL (scheme/host case, tracking
// params, fragment) is the stable key; title+publisher is the fallback for an
// article with no link.
export function canonicalArticleKey(article) {
  const raw = String(article?.link || '').trim()
  if (raw) {
    try {
      const url = new URL(raw, 'https://news.example.invalid')
      url.hash = ''
      for (const param of [...url.searchParams.keys()]) {
        if (/^(utm_|fbclid|gclid|mc_|igshid|vero_|pk_)/i.test(param)) url.searchParams.delete(param)
      }
      const path = url.pathname.replace(/\/+$/, '') || '/'
      return `url:${url.host.toLowerCase()}${path}${url.search}`
    } catch {
      // Fall through to the title fallback.
    }
  }
  return `title:${String(article?.title || '').trim().toLowerCase()}|${String(article?.publisher || '').trim().toLowerCase()}`
}

/**
 * A second, coarser identity used only to COLLAPSE duplicates.
 *
 * Measured against the live provider (Oct 2026): Yahoo publishes the same
 * syndicated press release twice under two different slugs, with DIFFERENT
 * `uuid`s and DIFFERENT `providerPublishTime` values —
 *
 *   .../crisis-resilience-evolution-building-tourism-004500627.html  00:45
 *   .../crisis-resilience-evolution-building-tourism-004000022.html  00:40
 *
 * So neither the URL nor the provider's own uuid identifies them as one
 * article, and the feed rendered the identical headline twice. Byte-identical
 * title + publisher is the only signal that survives, and two different
 * articles from one outlet sharing an entire headline is vanishingly rare next
 * to a syndicated release landing minutes apart.
 *
 * Deliberately collapse-only: it may merge rows, never split them.
 */
export function duplicateFingerprint(article) {
  const title = String(article?.title || '').trim().toLowerCase()
  const publisher = String(article?.publisher || '').trim().toLowerCase()
  if (!title) return null
  return `fp:${title}|${publisher}`
}

/**
 * Split the provider's `relatedTickers` into the associations we can stand
 * behind:
 *   - symbols   tracked-universe equities the article is genuinely about
 *   - indices    provider-attached indexes/futures, labelled readably
 * Anything else (a ticker outside the universe with no label) is dropped
 * rather than rendered as a bare, unexplained symbol.
 */
export function attributeArticle(relatedTickers) {
  const symbols = []
  const indices = []
  for (const raw of Array.isArray(relatedTickers) ? relatedTickers : []) {
    const key = String(raw || '').trim().toUpperCase()
    if (!key) continue
    if (UNIVERSE.has(key)) {
      if (!symbols.includes(key)) symbols.push(key)
      continue
    }
    if (INDEX_LABELS[key]) {
      if (!indices.includes(INDEX_LABELS[key])) indices.push(INDEX_LABELS[key])
    }
    // No universe membership and no label: an association we cannot explain,
    // so it is omitted rather than shown as a bare ticker.
  }
  symbols.sort()
  indices.sort()
  return { symbols, indices }
}

/**
 * providerPublishTime arrives in milliseconds on some articles and in seconds
 * on others. The two live three orders of magnitude apart (now: ~1.79e9 s vs
 * ~1.79e12 ms), so a 1e11 discriminator leaves ~55x headroom on both sides. An
 * older 1e12 cutoff sat exactly on the millisecond value with zero margin.
 */
function toIso(ts) {
  const n = Number(ts) || 0
  if (!n) return null
  const d = new Date(n > 1e11 ? n : n * 1000)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Normalise one provider article. `queriedSymbol` is NOT used for attribution —
 * it is recorded only on `matchedVia` so the UI can be explicit about why a
 * stock-specific search surfaced the article.
 */
export function normalizeArticle(raw, { fetchedAt } = {}) {
  const title = String(raw?.title || '').trim()
  if (!title) return null
  const { symbols, indices } = attributeArticle(raw?.relatedTickers)
  const publishedAt = toIso(raw?.providerPublishTime)
  return {
    title,
    publisher: raw?.publisher || 'Yahoo Finance',
    link: raw?.link || raw?.url || '',
    publishedAt,
    // Publication time and fetch time are distinct facts. `publishedAt` is
    // when the article was written; `fetchedAt` is when we retrieved it.
    fetchedAt: fetchedAt || new Date().toISOString(),
    thumbnail: raw?.thumbnail?.resolutions?.find((r) => r.size === 'large')?.url || raw?.thumbnail?.resolutions?.[0]?.url || null,
    summary: raw?.summary || null,
    relatedTickers: Array.isArray(raw?.relatedTickers) ? raw.relatedTickers.filter(Boolean) : [],
    // Derived, never assumed: these are the provider's own associations.
    symbols,
    indices,
    // True when the provider named no subject at all. Rendered without a
    // ticker instead of borrowing the retrieval query's symbol.
    unattributed: symbols.length === 0 && indices.length === 0
  }
}

/**
 * Merge articles across feeds. Deduplicates on canonical identity while
 * preserving every legitimate symbol association, and keeps the newest
 * publication time seen for the shared article.
 */
export function mergeArticles(groups, { fetchedAt } = {}) {
  const byKey = new Map()
  // Canonical key AND title+publisher fingerprint both point at the same
  // survivor, so a syndicated release that arrived under two slugs collapses.
  const survivorByFingerprint = new Map()

  // Fingerprint collapsing is time-boxed. A publisher CAN legitimately run the
  // same headline more than once, so only entries published close together
  // count as one syndicated release. Two months apart is two stories.
  const FINGERPRINT_WINDOW_MS = 24 * 60 * 60 * 1000

  const fingerprintMatches = (article) => {
    const fp = duplicateFingerprint(article)
    if (!fp) return null
    const candidate = survivorByFingerprint.get(fp)
    if (!candidate) return null
    const a = candidate.publishedAt ? new Date(candidate.publishedAt).getTime() : NaN
    const b = article.publishedAt ? new Date(article.publishedAt).getTime() : NaN
    // An undated entry cannot be shown to be near the survivor, so it is not
    // collapsed on title alone. This needs an explicit NaN: `new Date(null)` and
    // `new Date(0)` both yield 0, which IS finite, so the earlier
    // `Number.isFinite` check could never fire and two undated same-headline
    // articles still collapsed.
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    if (Math.abs(a - b) > FINGERPRINT_WINDOW_MS) return null
    return candidate
  }

  const mergeInto = (prev, article) => {
    prev.sources += 1
    prev.duplicateCount += 1
    for (const s of article.symbols) if (!prev.symbols.includes(s)) prev.symbols.push(s)
    for (const i of article.indices) if (!prev.indices.includes(i)) prev.indices.push(i)
    prev.symbols.sort()
    prev.indices.sort()
    // An article attributed by any feed is attributed.
    prev.unattributed = prev.symbols.length === 0 && prev.indices.length === 0
    const prevTime = new Date(prev.publishedAt || 0).getTime()
    const nextTime = new Date(article.publishedAt || 0).getTime()
    if (nextTime > prevTime) {
      prev.publishedAt = article.publishedAt
      // Keep pointing at the freshest copy of the same story.
      if (article.link) prev.link = article.link
    }
    if (!prev.thumbnail && article.thumbnail) prev.thumbnail = article.thumbnail
    if (!prev.summary && article.summary) prev.summary = article.summary
    return prev
  }

  for (const group of groups) {
    for (const raw of group || []) {
      const article = normalizeArticle(raw, { fetchedAt })
      if (!article) continue
      const key = canonicalArticleKey(article)

      const existing = byKey.get(key) || fingerprintMatches(article)

      if (existing) {
        mergeInto(existing, article)
        // Re-point the canonical index so a later sighting of either copy
        // still finds the survivor.
        byKey.set(key, existing)
        continue
      }

      const survivor = { ...article, sources: 1, duplicateCount: 0 }
      byKey.set(key, survivor)
      const fp = duplicateFingerprint(survivor)
      if (fp && !survivorByFingerprint.has(fp)) survivorByFingerprint.set(fp, survivor)
    }
  }

  // A collapsed duplicate leaves BOTH its canonical key and the fingerprint
  // pointing at one survivor, so `[...byKey.values()]` would yield that survivor
  // once per key it answers to. De-duplicate the survivors themselves.
  const survivors = [...new Set(byKey.values())]

  // Newest first; an article with no publication time sorts last rather than
  // pretending to be recent.
  return survivors.sort((a, b) => {
    const av = new Date(a.publishedAt || 0).getTime() || -Infinity
    const bv = new Date(b.publishedAt || 0).getTime() || -Infinity
    return bv - av
  })
}