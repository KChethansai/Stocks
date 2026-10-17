import { Link } from 'react-router'
import { ArrowRight, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'
import { MarketCandles } from '../charts/market-charts'
import { useOhlcSeries, useLandingStockSelector } from './landingStockSelector'
import { formatAsOfLabel } from './stockSearch'
import { useState } from 'react'

// Browseable, searchable stock selection over the real supported universe.
// The previous version rendered a read-only input and fake category chips —
// it looked functional but did nothing. This replaces both with a working
// combobox-style picker (pointer, keyboard and touch) driving genuine data.
export default function S03Markets() {
  const { universe, results, selected, query, setQuery, choose, loading } = useLandingStockSelector()
  // Combobox popup state lives here so the list is not open on first paint:
  // an always-open list pushed the default selection off-screen and read as
  // a wall of unrelated symbols.
  const [popupOpen, setPopupOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const symbol = selected?.symbol || 'AAPL'
  const { rows, state, seriesAsOf, error, retry } = useOhlcSeries(symbol, '1M')

  const first = rows[0]?.close ?? 0
  const failed = state === 'error'
  const last = rows.length ? rows[rows.length - 1].close : Number(selected?.price) || 0
  const up = last >= first
  const pct = first ? ((last - first) / first) * 100 : 0
  const MoveIcon = up ? TrendingUp : TrendingDown
  const loadingChart = state === 'loading'
  const thin = state === 'insufficient'
  const sample = state === 'sample'
  const stale = state === 'stale'

  const asOf = formatAsOfLabel(seriesAsOf)
  const noResults = !loading && query.trim().length > 0 && results.length === 0

  const caption = loadingChart
    ? `Loading ${symbol} history…`
    : sample
      ? 'Sample data — backend unreachable.'
      : failed
        ? 'History unavailable.'
        : thin
          ? 'Not enough history for this window.'
          : `${stale ? 'Last fetched' : 'Genuine history · ' + symbol + ' past month · fetched'}${asOf ? ` ${asOf}` : ''}`

  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Market exploration"
          title="Browse thirty stocks."
          lede="Pick any symbol for genuine history and the latest verified quote — the full app adds sectors and ranges."
        />
      </LReveal>

      <LReveal delay={0.08}>
        <Illustrative className="mt-8" caption="Chart shows genuine market history for the symbol you select.">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5 sm:p-6">
            {/* Stock selector */}
            <div className="relative">
              <label htmlFor="landing-stock-search" className="sr-only">
                Search stocks by ticker or company name
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--stone-muted)]"
              />
              <input
                id="landing-stock-search"
                type="text"
                role="combobox"
                aria-expanded={popupOpen}
                aria-controls="landing-stock-results"
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 ? `landing-stock-option-${results[activeIndex]?.symbol}` : undefined
                }
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(-1)
                }}
                onFocus={() => setPopupOpen(true)}
                onBlur={() => setPopupOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('')
                    setPopupOpen(false)
                    setActiveIndex(-1)
                    return
                  }
                  if (!results.length) return
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault()
                    setPopupOpen(true)
                    const step = e.key === 'ArrowDown' ? 1 : -1
                    setActiveIndex((i) => (i + step + results.length) % results.length)
                    return
                  }
                  if (e.key === 'Enter' && activeIndex >= 0) {
                    e.preventDefault()
                    choose(results[activeIndex])
                  }
                }}
                placeholder="Search ticker or company…"
                className="min-h-[44px] w-full rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] pl-10 pr-3 text-sm text-[var(--ivory)] placeholder:text-[var(--stone-muted)] focus:border-[var(--brass)] focus:outline-none"
              />

              {/* Result count, so the list is never silently truncated. */}
              <p className="sr-only" role="status" aria-live="polite">
                {query.trim()
                  ? `${results.length} ${results.length === 1 ? 'match' : 'matches'} for ${query.trim()}`
                  : ''}
              </p>

              {noResults && (
                <p className="mt-2 px-3 py-3 text-sm text-[var(--stone-muted)]">
                  No stocks match “{query.trim()}”.
                </p>
              )}

              {popupOpen && results.length > 0 && (
                <ul
                  id="landing-stock-results"
                  role="listbox"
                  aria-label="Stock results"
                  className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] p-1"
                >
                  {results.map((s, index) => {
                    const isSelected = s.symbol === symbol
                    return (
                      <li key={s.symbol} role="presentation">
                        <button
                          type="button"
                          id={`landing-stock-option-${s.symbol}`}
                          role="option"
                          aria-selected={isSelected}
                          // Pointer interaction must not steal the keyboard
                          // caret, so focus stays in the input.
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => choose(s)}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                            index === activeIndex
                              ? 'bg-white/[0.1]'
                              : isSelected
                                ? 'bg-white/[0.07]'
                                : 'hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold font-mono text-[var(--ivory)]">
                              {s.symbol}
                            </span>
                            <span className="block truncate text-xs text-[var(--stone-muted)]">
                              {s.name}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-sm font-mono text-[var(--ivory)]">
                              {Number(s.price) > 0 ? `$${Number(s.price).toFixed(2)}` : '—'}
                            </span>
                            <span
                              className={`block font-mono text-[11px] ${
                                Number(s.changePercent) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                              }`}
                            >
                              {Number.isFinite(Number(s.changePercent))
                                ? `${Number(s.changePercent) >= 0 ? '+' : ''}${Number(s.changePercent).toFixed(2)}%`
                                : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {loading && universe.length === 0 && (
              <p className="mt-3 text-xs text-[var(--stone-muted)]" role="status">
                Loading the supported universe…
              </p>
            )}

            {!loading && universe.length === 0 && (
              <div className="mt-3 rounded-lg border border-white/8 bg-[#0B0C0E] p-3 text-center">
                <p className="text-xs text-[var(--stone)]">Market data is unavailable right now.</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-2 min-h-[44px] rounded-lg border border-white/10 px-4 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Selected symbol context */}
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
              <p className="text-sm font-bold font-mono text-[var(--ivory)]">{symbol}</p>
              <p className="text-sm font-bold tabular-nums text-[var(--ivory)]">
                {loadingChart ? '—' : `$${last.toFixed(2)}`}
              </p>
              {!loadingChart && rows.length > 1 && (
                <p
                  className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                    up ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                  }`}
                >
                  <MoveIcon aria-hidden="true" className="h-4 w-4" />
                  <span aria-hidden="true">{up ? '▲' : '▼'}</span>
                  {up ? '+' : ''}
                  {pct.toFixed(2)}% in view
                </p>
              )}
              {selected?.name && (
                <p className="text-xs text-[var(--stone-muted)]">{selected.name}</p>
              )}
            </div>

            {/* Chart */}
            <div
              className="mt-2"
              role="img"
              aria-label={`${symbol} candlesticks, past month, ${
                loadingChart ? 'loading' : sample ? 'sample data' : failed || thin ? 'unavailable' : 'genuine history'
              }`}
            >
              {loadingChart ? (
                <div
                  className="aspect-[2/1] animate-pulse rounded-lg bg-white/[0.04]"
                  aria-busy="true"
                  aria-label={`Loading ${symbol} history`}
                />
              ) : failed || thin ? (
                <div className="flex aspect-[2/1] flex-col items-center justify-center gap-2 rounded-lg border border-white/8 bg-[#0B0C0E] p-4 text-center">
                  <p className="text-xs text-[var(--stone)]">
                    {failed ? error || 'History unavailable.' : 'Not enough history for this window.'}
                  </p>
                  {failed && (
                    <button
                      type="button"
                      onClick={retry}
                      className="min-h-[44px] rounded-lg border border-white/10 px-4 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <div className={stale ? 'opacity-70' : undefined}>
                  <MarketCandles data={rows} />
                </div>
              )}
            </div>

            <p className="mf-meta mt-3">
              {caption}
              {stale && (
                <button
                  type="button"
                  onClick={retry}
                  className="ml-2 underline decoration-[var(--brass)]/60 underline-offset-2 text-[var(--stone)]"
                >
                  Refresh
                </button>
              )}
            </p>
          </div>
        </Illustrative>

        <Link
          to="/markets"
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[var(--brass)] hover:underline"
        >
          Browse markets
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </LReveal>
    </Section>
  )
}