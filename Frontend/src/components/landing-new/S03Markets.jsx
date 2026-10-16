import { Link } from 'react-router'
import { ArrowRight, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'
import { MarketCandles, useOhlcSeries } from '../charts/market-charts'
import { useTrade } from '../../store/tradeStore'

const SECTORS = ['Technology', 'Healthcare', 'Energy']

// D10: genuine AAPL history (fixed 1M frame) instead of the seeded series.
// Search, sectors, and ranges stay visibly illustrative; the app adds them.
export default function S03Markets() {
  const { rows, state, seriesAsOf, seriesStale, error, retry } = useOhlcSeries('AAPL', '1M')
  const stocks = useTrade((s) => s.stocks)
  const quote = (stocks || []).find((s) => s.symbol === 'AAPL')
  const first = rows[0]?.close ?? 0
  const failed = state === 'error'
  const last = rows.length ? rows[rows.length - 1].close : (!failed && Number(quote?.price)) || 0
  const up = last >= first
  const pct = first ? ((last - first) / first) * 100 : 0
  const MoveIcon = up ? TrendingUp : TrendingDown
  const loading = state === 'loading'
  const thin = state === 'insufficient'
  const sample = state === 'sample'
  const stale = state === 'stale'
  const asOf = seriesAsOf
    ? new Date(seriesAsOf).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''
  const caption = loading
    ? 'Loading AAPL history…'
    : sample
      ? 'Sample data — backend unreachable.'
      : failed
        ? 'History unavailable.'
        : thin
          ? 'Not enough history for this window.'
          : `${stale ? 'Stale — last fetched' : 'Genuine history · AAPL past month · fetched'}${asOf ? ` ${asOf}` : ''}`

  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Market exploration"
          title="Browse thirty stocks."
          lede="AAPL past month with genuine history — the full app adds search, sectors, and ranges."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative caption="Preview frame is illustrative; the chart shows genuine AAPL history.">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5 sm:p-6">
            <div className="relative" aria-hidden="true">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--stone-muted)]"
              />
              <input
                readOnly
                tabIndex={-1}
                placeholder="Search ticker, name…"
                className="min-h-[44px] w-full rounded-lg border border-[rgba(236,233,226,.08)] bg-[#181B1F] pl-10 pr-3 text-sm text-[var(--ivory)] placeholder:text-[var(--stone-muted)] focus:outline-none"
              />
            </div>
            <div aria-hidden="true" className="mt-3 flex flex-wrap gap-2">
              {SECTORS.map((sector) => (
                <span
                  key={sector}
                  className="rounded-full border border-[rgba(236,233,226,.08)] px-3 py-2 text-xs font-semibold text-[var(--stone)]"
                >
                  {sector}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
              <p className="text-sm font-bold text-[var(--ivory)]">AAPL</p>
              <p className="text-sm font-bold tabular-nums text-[var(--ivory)]">
                {loading ? '—' : `$${last.toFixed(2)}`}
              </p>
              {!loading && rows.length > 1 && (
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
            </div>
            <div className="mt-2" role="img" aria-label={`AAPL candlesticks, past month, ${loading ? 'loading' : sample ? 'sample data' : failed || thin ? 'unavailable' : 'genuine history'}`}>
              {loading ? (
                <div className="aspect-[2/1] rounded-lg bg-white/[0.04] animate-pulse" aria-busy="true" aria-label="Loading AAPL history" />
              ) : failed || thin ? (
                <div className="aspect-[2/1] rounded-lg border border-white/8 bg-[#0B0C0E] flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-xs text-[var(--stone)]">{failed ? (error || 'History unavailable.') : 'Not enough history for this window.'}</p>
                  {failed && (
                    <button type="button" onClick={retry} className="min-h-[44px] px-4 rounded-lg border border-white/10 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50">
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
                <button type="button" onClick={retry} className="ml-2 underline decoration-[var(--brass)]/60 underline-offset-2 text-[var(--stone)]">
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
