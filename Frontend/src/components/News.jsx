import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Search, Newspaper, ExternalLink, AlertTriangle, RotateCw } from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import Reveal from './ui/Reveal'
import { ShinyText } from './reactbits/ShinyText'
import { Select } from './ui/Select'
import { fetchGeneralNews, fetchStockNews, timeAgo, absoluteTime } from './newsApi'

// General market news is the default. "All symbols" previously meant "six
// per-symbol feeds merged", which is not general market news and mislabelled
// every headline with whichever ticker's search surfaced it. The backend now
// answers market-level queries and attributes each article from the provider's
// own `relatedTickers`; this page just renders what it is given.
//
// Stock-specific news remains available as a secondary view, selected from the
// tracked universe — and it reports how many articles the provider actually
// attributed to that symbol, which can be fewer than the rows returned.
const PAGE_SIZE = 12
const GENERAL = 'GENERAL'

export default function News() {
  const { stocks, fetchStocks } = useTrade()
  const { currentUser } = useAuth()
  const location = useLocation()

  const [view, setView] = useState(GENERAL)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [attributedTo, setAttributedTo] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Deep-link support: /news?symbol=NVDA opens the stock-specific view.
  const deepLinkSymbol = useMemo(
    () => new URLSearchParams(location.search).get('symbol')?.toUpperCase() || null,
    [location.search]
  )

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  // The default view stays General unless a deep link names a symbol, and an
  // explicit user choice wins over the deep link from then on.
  const userPicked = useRef(false)
  useEffect(() => {
    if (deepLinkSymbol && !userPicked.current) setView(deepLinkSymbol)
  }, [deepLinkSymbol])

  const universe = useMemo(() => {
    const watched = (currentUser?.watchlist || []).filter(Boolean)
    const fromStocks = stocks.map((s) => s.symbol).filter(Boolean)
    return [...new Set([...watched, ...fromStocks])].sort()
  }, [currentUser?.watchlist, stocks])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    setStale(false)
    setAttributedTo(null)

    const run = view === GENERAL
      ? fetchGeneralNews({ limit: 60, signal: controller.signal })
      : fetchStockNews(view, { limit: 24, signal: controller.signal })

    run
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setStale(res.stale)
        setFetchedAt(res.fetchedAt)
        setAttributedTo(view === GENERAL ? null : res.attributedTo)
      })
      .catch((err) => {
        if (cancelled || err?.name === 'CanceledError' || err?.name === 'AbortError') return
        setItems([])
        setError('Could not load news. Check your connection and retry.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [view])

  // Search + pagination reset together: a query that narrows the set can make
  // the current page invalid.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        item.publisher?.toLowerCase().includes(q) ||
        (item.symbols || []).some((s) => s.toLowerCase().includes(q)) ||
        (item.indices || []).some((i) => i.toLowerCase().includes(q))
    )
  }, [items, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const shown = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  )

  useEffect(() => {
    setPage(1)
  }, [query, view])

  const onSelectView = useCallback((next) => {
    userPicked.current = true
    setView(next)
    setQuery('')
  }, [])

  const retry = useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    const run = view === GENERAL
      ? fetchGeneralNews({ limit: 60, signal: controller.signal })
      : fetchStockNews(view, { limit: 24, signal: controller.signal })
    run
      .then((res) => {
        setItems(res.items)
        setStale(res.stale)
        setFetchedAt(res.fetchedAt)
        setAttributedTo(view === GENERAL ? null : res.attributedTo)
      })
      .catch(() => setError('Could not load news. Check your connection and retry.'))
      .finally(() => setLoading(false))
  }, [view])

  const viewOptions = useMemo(() => {
    const options = [
      { value: GENERAL, label: 'General market' },
      ...universe.map((s) => ({ value: s, label: s }))
    ]
    // Keep a deep-linked symbol selectable so the control never shows one thing
    // while the page shows another.
    if (view !== GENERAL && !options.some((o) => o.value === view)) {
      options.push({ value: view, label: view })
    }
    return options
  }, [universe, view])

  const isGeneral = view === GENERAL
  // Counts describe the data actually available, never a target.
  const headline = loading ? '—' : filtered.length
  const scopedLabel = isGeneral
    ? 'general market news'
    : `${attributedTo ?? 0} attributed to ${view}`

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mf-h1 mb-2">
            <ShinyText>Market News</ShinyText>
          </h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="mf-label">Headlines</span>
              <span className="text-[var(--ivory)] font-bold tabular-nums">{headline}</span>
              {!loading && !error && (
                <span className="text-text-muted">
                  {isGeneral ? 'in general market news' : `for ${view}`}
                </span>
              )}
            </div>
            {/* Only claim a cached feed is being shown when rows actually
                exist. Over an empty list the old wording asserted something
                the payload contradicted. */}
            {stale && (
              <span className="inline-flex items-center gap-1.5 text-[var(--loss)]">
                <AlertTriangle className="w-3 h-3" />
                {loading || items.length === 0
                  ? 'data provider unavailable'
                  : 'data provider unavailable — showing the last cached feed'}
              </span>
            )}
            {!loading && !error && fetchedAt && (
              <span className="mf-meta" title={absoluteTime(fetchedAt)}>
                fetched {timeAgo(fetchedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
          <Select
            // A deep-linked symbol outside the tracked universe has no entry in
            // the option list. Falling back to "General market" made the
            // control claim General while the body rendered that symbol's feed,
            // so the option is injected instead of mislabelling the view.
            value={isGeneral ? GENERAL : view}
            onChange={onSelectView}
            ariaLabel="News scope"
            className="w-full md:w-44"
            options={viewOptions}
          />
          <div className="relative w-full md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines, publisher, ticker..."
              aria-label="Search headlines"
              className="w-full bg-[#111316] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)] transition placeholder-[var(--stone-muted)] min-h-[34px]"
            />
          </div>
        </div>
      </Reveal>

      {/* Stock-specific views are secondary: the general feed is the default and
          stays visible above them. */}
      {!isGeneral && (
        <p className="mf-meta font-mono" aria-live="polite">
          Showing the provider&apos;s feed for {view}. {scopedLabel}. A headline is only
          labelled {view} when the provider associated it with {view}.
        </p>
      )}

      <Reveal delay={0.03} className="bg-[#111316] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-5 sm:p-6 space-y-5" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading news</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 rounded bg-[rgba(255,255,255,0.08)] w-3/4 mb-2" />
                <div className="h-2 rounded bg-[rgba(255,255,255,0.05)] w-1/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-xs font-mono text-[var(--loss)]">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-[#181B1F] px-3 py-1.5 text-xs font-mono text-[var(--stone)] hover:text-[var(--ivory)] hover:border-[var(--brass)]/40"
            >
              <RotateCw className="w-3 h-3" /> Retry
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-12 text-center">
            <p className="mf-empty">
              {items.length === 0
                ? isGeneral
                  ? 'No market headlines available right now — check back soon.'
                  : `No headlines available for ${view} right now.`
                : `No headlines match “${query}”.`}
            </p>
            {items.length === 0 && !isGeneral && (
              <button
                type="button"
                onClick={() => onSelectView(GENERAL)}
                className="mt-3 text-xs font-mono text-[var(--brass)] hover:underline"
              >
                Back to general market news
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="m-0 p-0 list-none divide-y divide-[rgba(255,255,255,0.04)]">
              {shown.map((item) => {
                const symbols = item.symbols || []
                const indices = item.indices || []
                const subject = [...symbols, ...indices]
                // Only link a ticker to Markets when the provider named a
                // tracked equity. `unattributed` is the backend's explicit
                // "the provider named no subject at all" signal — the case
                // where borrowing the retrieval query's symbol used to be the
                // bug. Index-only articles also get the neutral marker, since
                // there is no tradeable ticker to link.
                const lead = symbols[0]
                return (
                  <li
                    key={item.link || item.title}
                    className="p-3.5 sm:px-5 sm:py-4 flex gap-3 sm:gap-4"
                  >
                    {lead ? (
                      <Link
                        to={`/markets?stock=${lead}`}
                        title={`Open ${lead} in Markets`}
                        aria-label={`Open ${lead} in Markets`}
                        className="shrink-0 w-9 h-9 rounded-lg bg-[#181B1F] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-mono text-xs font-bold text-[var(--stone)] hover:border-[var(--brass)]/50 transition"
                      >
                        {lead[0]}
                      </Link>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="shrink-0 w-9 h-9 rounded-lg bg-[#181B1F] border border-[rgba(255,255,255,0.06)] flex items-center justify-center"
                      >
                        <Newspaper className="w-4 h-4 text-[var(--stone-muted)]" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-start gap-1.5 text-sm font-medium text-[var(--ivory)] hover:text-[var(--brass)] transition leading-snug"
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-muted group-hover:text-[var(--brass)] transition" />
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-[var(--ivory)] leading-snug m-0">{item.title}</p>
                      )}

                      <p className="text-[11px] uppercase text-text-muted mt-1 m-0 flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold text-[var(--stone)]">
                          {item.publisher || 'Unknown publisher'}
                        </span>
                        {/* Publication time, with the exact stamp on hover so an
                            old article never reads as a fresh fetch. */}
                        {item.publishedAt ? (
                          <time dateTime={item.publishedAt} title={absoluteTime(item.publishedAt)}>
                            {timeAgo(item.publishedAt)}
                          </time>
                        ) : (
                          <span title="The provider supplied no publication time for this article">
                            publication time unavailable
                          </span>
                        )}
                        {subject.length > 0 && (
                          <span className="font-mono normal-case">
                            · {subject.join(' · ')}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>

            {totalPages > 1 && (
              <div className="p-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3">
                <span className="mf-meta font-mono" aria-live="polite">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    aria-label="Previous page of headlines"
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] font-mono text-[var(--stone)] disabled:opacity-40 hover:text-[var(--ivory)] hover:border-[var(--brass)]/40 min-h-[32px]"
                  >
                    Prev
                  </button>
                  <span className="mf-meta font-mono tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="Next page of headlines"
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] font-mono text-[var(--stone)] disabled:opacity-40 hover:text-[var(--ivory)] hover:border-[var(--brass)]/40 min-h-[32px]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Reveal>

      {!stocks.length && !loading && !error && (
        <p className="mf-meta text-center font-mono">
          <Newspaper className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          General market news does not depend on the tracked universe — headlines are shown above.
        </p>
      )}
    </div>
  )
}