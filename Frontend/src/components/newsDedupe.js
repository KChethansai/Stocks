// Pure news-feed helpers (no network, no import.meta — safe for node --test).
// Canonical article identity for cross-symbol deduplication. The same Yahoo
// article is returned for every queried symbol it mentions, so merging
// per-symbol feeds without this repeats headlines under different symbols.
// Normalized URL (scheme/host case, tracking params, fragments stripped) is
// the stable key; title+publisher is the fallback when no link exists.
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

// Merge per-symbol feeds into unique articles. Each survivor keeps the union
// of its symbols (sorted) so filtering by any of them still finds it, and
// keeps the newest publishedAt seen. Genuinely distinct articles (different
// canonical keys) are never merged.
export function dedupeNews(items) {
  const byKey = new Map()
  for (const item of items || []) {
    if (!item?.title) continue
    const key = canonicalArticleKey(item)
    const symbols = new Set(Array.isArray(item.symbols) ? item.symbols : [item.symbol].filter(Boolean))
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { ...item, symbols: [...symbols] })
      continue
    }
    for (const s of symbols) {
      if (!prev.symbols.includes(s)) prev.symbols.push(s)
    }
    prev.symbols.sort()
    const prevTime = new Date(prev.publishedAt || 0).getTime()
    const nextTime = new Date(item.publishedAt || 0).getTime()
    if (nextTime > prevTime) prev.publishedAt = item.publishedAt
  }
  return [...byKey.values()].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
}
