import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Search, Newspaper, ExternalLink } from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import Reveal from './ui/Reveal'
import { ShinyText } from './reactbits/ShinyText'
import { fetchNews, timeAgo } from './newsApi'

// Aggregate feed: watchlist → holdings → fallback trio. Each symbol is one
// cached backend call (30-min server TTL), fetched in parallel with
// per-symbol fail-soft so one bad symbol never empties the feed.
const FALLBACK_SYMBOLS = ['AAPL', 'NVDA', 'MSFT']
const MAX_FEED_SYMBOLS = 8

export default function News() {
  const { stocks, fetchStocks, fetchPortfolio, portfolio, startPolling, stopPolling } = useTrade()
  const { currentUser } = useAuth()
  const location = useLocation()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchStocks()
    fetchPortfolio()
    startPolling()
    return () => stopPolling()
  }, [fetchStocks, fetchPortfolio, startPolling, stopPolling])

  // Deep-link support: /news?symbol=NVDA prefilters the feed.
  useEffect(() => {
    const sym = new URLSearchParams(location.search).get('symbol')?.toUpperCase()
    if (sym) setFilter(sym)
  }, [location.search])

  const feedSymbols = useMemo(() => {
    const watchlisted = (currentUser?.watchlist || []).filter(Boolean)
    if (watchlisted.length) return watchlisted.slice(0, MAX_FEED_SYMBOLS)
    const held = (portfolio?.holdings || []).map((h) => h.symbol).filter(Boolean)
    if (held.length) return held.slice(0, MAX_FEED_SYMBOLS)
    return FALLBACK_SYMBOLS
  }, [currentUser?.watchlist, portfolio?.holdings])

  useEffect(() => {
    if (!feedSymbols.length) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all(
      feedSymbols.map((symbol) =>
        fetchNews(symbol)
          .then((news) => news.map((n) => ({ ...n, symbol })))
          .catch(() => [])
      )
    ).then((groups) => {
      if (cancelled) return
      const merged = groups
        .flat()
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      setItems(merged)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [feedSymbols.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => {
    const q = query.toLowerCase().trim()
    return items.filter((item) => {
      if (filter !== 'ALL' && item.symbol !== filter) return false
      if (!q) return true
      return (
        item.title?.toLowerCase().includes(q) ||
        item.publisher?.toLowerCase().includes(q)
      )
    })
  }, [items, filter, query])

  const chips = useMemo(() => ['ALL', ...feedSymbols], [feedSymbols])

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="mf-h1 mb-3">
            <ShinyText>Market News</ShinyText>
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="mf-label">Headlines</span>
              <span className="text-[#F5F7FA] font-bold">{items.length}</span>
            </div>
            <div className="h-4 w-px bg-[rgba(255,255,255,0.08)]"></div>
            <div className="flex items-center gap-2">
              <span className="mf-label">Symbols</span>
              <span className="text-[#F5F7FA] font-bold">{feedSymbols.length}</span>
            </div>
          </div>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines..."
            className="w-full bg-[#111318] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6] transition placeholder-[#8A93A6]"
          />
        </div>
      </Reveal>

      <Reveal delay={0.03} className="flex flex-wrap gap-2">
        {chips.map((sym) => (
          <button
            key={sym}
            onClick={() => setFilter(sym)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              filter === sym
                ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30'
                : 'bg-[#111318] text-[#9CA3AF] border border-[rgba(255,255,255,0.08)] hover:text-[#F5F7FA]'
            }`}
          >
            {sym === 'ALL' ? 'All symbols' : sym}
          </button>
        ))}
      </Reveal>

      <Reveal delay={0.05} className="bg-[#111318] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-5 sm:p-6 space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 rounded bg-[rgba(255,255,255,0.08)] w-3/4 mb-2" />
                <div className="h-2 rounded bg-[rgba(255,255,255,0.05)] w-1/4" />
              </div>
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="py-12 mf-empty">
            {items.length === 0
              ? 'No headlines available right now — check back soon.'
              : 'No headlines match this filter.'}
          </p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-[rgba(255,255,255,0.04)]">
            {visibleItems.map((item, i) => (
              <li key={`${item.symbol}-${item.link || item.title}-${i}`} className="p-5 sm:p-6 flex gap-4">
                <Link
                  to={`/markets?stock=${item.symbol}`}
                  title={`Open ${item.symbol} in Markets`}
                  className="shrink-0 w-11 h-11 rounded-xl bg-[#151820] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-mono text-sm font-bold text-[#3B82F6] hover:border-[#3B82F6]/50 transition"
                >
                  {item.symbol[0]}
                </Link>
                <div className="min-w-0">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-1.5 text-sm font-medium text-[#F5F7FA] hover:text-[#3B82F6] transition leading-snug"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-muted group-hover:text-[#3B82F6] transition" />
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-[#F5F7FA] leading-snug m-0">{item.title}</p>
                  )}
                  <p className="text-[11px] font-mono uppercase text-text-muted mt-1.5 m-0">
                    {item.symbol} • {item.publisher}
                    {item.publishedAt ? ` • ${timeAgo(item.publishedAt)}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Reveal>

      {!stocks.length && !loading && (
        <p className="mf-meta text-center font-mono">
          <Newspaper className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Market data is syncing — headlines appear once symbols load.
        </p>
      )}
    </div>
  )
}
