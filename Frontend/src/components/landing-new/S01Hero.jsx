// S01 hero: proposition + working CTAs + live mini-ticket. The single
// permitted scroll-linked treatment lives here (D2): content scales 1→0.96
// and fades as it leaves, hero only, no parallax or pinning. Comfort / OS
// reduced-motion renders the final state statically.
import { useState } from 'react'
import { Link } from 'react-router'
import { motion, useScroll, useTransform } from 'motion/react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { PriceAreaChart, useOhlcSeries } from '../charts/market-charts'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useTrade } from '../../store/tradeStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import { LReveal } from './ui'

const TICKETS = ['NVDA', 'AAPL', 'MSFT', 'TSLA']

function MiniTicket() {
  const [symbol, setSymbol] = useState('NVDA')
  const { prices, state, seriesAsOf, seriesStale, error, retry } = useOhlcSeries(symbol, '1M', 30)
  const stocks = useTrade((s) => s.stocks)
  const quote = (stocks || []).find((s) => s.symbol === symbol)
  const failed = state === 'error'
  const last = prices.length ? prices[prices.length - 1].price : (!failed && Number(quote?.price)) || 0
  const first = prices.length ? prices[0].price : last
  const up = last >= first
  const loading = state === 'loading'
  const thin = state === 'insufficient'
  const sample = state === 'sample'
  const stale = state === 'stale'
  // Freshness is series-sourced only: the history entry timestamp for this
  // exact symbol|range, never a re-render clock.
  const asOf = seriesAsOf
    ? new Date(seriesAsOf).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''
  const freshness = loading
    ? 'Loading history…'
    : sample
      ? 'Sample data (offline) · Not investment advice.'
      : failed
        ? 'History unavailable · Not investment advice.'
        : thin
          ? 'Not enough history for this window · Not investment advice.'
          : `${stale ? 'Stale — last fetched' : 'History fetched'} ${asOf}${seriesStale ? ' · quote may be stale' : ''} · Not investment advice.`

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111316] p-5 shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono font-bold text-lg text-[var(--ivory)]">{symbol}</p>
          <p className="text-xs text-[var(--stone)] mt-0.5">{quote?.name ?? ''}</p>
        </div>
        <div className="text-right" aria-live="polite">
          {loading ? (
            <p className="font-mono font-bold text-lg text-[var(--stone-muted)]" aria-busy="true">—</p>
          ) : (
            <>
              <p className="font-mono font-bold text-lg text-[var(--ivory)] tabular-nums">
                {last > 0 ? formatCurrency(last) : '—'}
              </p>
              {prices.length > 1 && (
                <p className={`flex items-center justify-end gap-1 text-xs font-mono font-semibold ${up ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                  {up ? <ArrowUpRight className="w-3 h-3" aria-hidden="true" /> : <ArrowDownRight className="w-3 h-3" aria-hidden="true" />}
                  {up ? 'up' : 'down'} in view
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-3" role="img" aria-label={`${symbol}, past month, ${loading ? 'loading history' : sample ? 'sample data' : failed ? 'history unavailable' : thin ? 'insufficient history' : 'genuine history'}`}>
        {loading ? (
          <div className="aspect-[2/1] rounded-lg bg-white/[0.04] animate-pulse" aria-busy="true" aria-label="Loading price history" />
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
          <div className={stale ? 'opacity-70' : undefined} aria-busy={false}>
            <PriceAreaChart
              data={prices}
              yKey="price"
              showAxes={false}
              animationDuration={0}
              aspectRatio="2 / 1"
            />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1.5" role="group" aria-label="Ticket symbol">
        {TICKETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSymbol(t)}
            aria-pressed={t === symbol}
            className={`min-h-[44px] px-3 rounded-lg text-xs font-mono font-semibold transition border ${
              t === symbol
                ? 'border-[var(--brass)]/50 text-[var(--ivory)] bg-white/[0.05]'
                : 'border-transparent text-[var(--stone)] hover:text-[var(--ivory)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mf-meta mt-2">
        {freshness}
      </p>
      {stale && (
        <button type="button" onClick={retry} className="mt-2 min-h-[44px] px-4 rounded-lg border border-white/10 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50">
          Refresh history
        </button>
      )}
    </div>
  )
}

export default function S01Hero() {
  const comfort =
    useReducedMotion() ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.35], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.35], [1, 0.96])
  const scrollStyle = comfort ? {} : { opacity, scale }

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-14 sm:pb-20">
      <motion.div style={scrollStyle} className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <LReveal>
          <p className="mf-label text-[var(--brass)] text-xs font-bold tracking-[0.14em] uppercase">
            Paper-trading simulator
          </p>
          <h1 className="mf-landing-display mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[var(--ivory)]">
            Practice with real prices. Risk nothing.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--stone)] max-w-xl">
            MarketForge is a paper-trading simulator with live market quotes and
            $100,000 in virtual capital. Place orders, track positions, and review
            every fill.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--ivory)] px-5 text-sm font-semibold text-[#0B0C0E] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
            >
              Open practice account
            </Link>
            <Link
              to="/markets"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-white/12 px-5 text-sm font-semibold text-[var(--ivory)] transition hover:border-[var(--brass)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
            >
              Browse markets
            </Link>
          </div>
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-white/8 pt-5">
            {[
              ['Virtual starting capital', '$100K'],
              ['US stocks to trade', '30'],
              ['Real money at risk', '$0'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[var(--stone)]">{k}</dt>
                <dd className="mt-1 font-mono font-bold text-lg text-[var(--ivory)] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </LReveal>
        <LReveal delay={0.1}>
          <MiniTicket />
        </LReveal>
      </motion.div>
    </div>
  )
}
