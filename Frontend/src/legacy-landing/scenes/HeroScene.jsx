import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useScroll, useTransform } from 'motion/react'
import { useAuth } from '../../store/authStore'
import { useTrade } from '../../store/tradeStore'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, EASING } from '../../lib/motion'
import { PriceAreaChart, useOhlcSeries } from '../charts/market-charts'
import { fmtMoney, fmtPct } from '../../utils/format'

const FALLBACK_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 227.14, change: 1.42 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 942.81, change: 4.24 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.1, change: -0.6 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 170.8, change: -2.95 },
]

const FACTS = [
  { value: '$100K', label: 'Virtual starting capital' },
  { value: '30', label: 'US stocks to trade' },
  { value: '$0', label: 'Real money at risk' },
]

export default function HeroScene() {
  const { isAuthenticated } = useAuth()
  const isComfort = useReducedMotion()
  const sceneRef = useRef(null)
  const [activeSymbol, setActiveSymbol] = useState('NVDA')
  const [timeframe, setTimeframe] = useState('1D')

  // Live quotes from the public stock feed; static fallbacks keep the hero
  // readable offline (clearly the same shape, replaced when quotes land).
  const stocks = useTrade((s) => s.stocks)
  const fetchStocks = useTrade((s) => s.fetchStocks)
  useEffect(() => {
    if (typeof fetchStocks === 'function') fetchStocks()
  }, [fetchStocks])

  const tickers = FALLBACK_TICKERS.map((s) => {
    const q = (stocks || []).find((r) => r.symbol === s.symbol)
    if (!q) return { ...s, live: false }
    return {
      ...s,
      price: Number(q.price ?? s.price),
      change: Number(q.changePercent ?? s.change),
      live: Boolean(q.lastVerifiedAt) && !q.stale,
      stale: Boolean(q.stale),
    }
  })
  const active = tickers.find((t) => t.symbol === activeSymbol) ?? tickers[0]
  const { prices, live } = useOhlcSeries(active.symbol, timeframe)
  const lastPrice = prices.length ? prices[prices.length - 1].price : active.price
  const firstPrice = prices.length ? prices[0].price : active.price
  const periodChange = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : active.change

  // Single scroll moment: content scales down + fades (Scroll Zoom Hero).
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ['start start', 'end start'],
  })
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const contentScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.94])
  const scrollStyles = isComfort ? {} : { opacity: contentOpacity, scale: contentScale }

  return (
    <section ref={sceneRef} className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      <motion.div
        className="mf-scene relative z-10 flex flex-1 items-center pb-20 pt-20 sm:pt-28"
        style={scrollStyles}
      >
        <div className="mf-scene-frame grid w-full items-center gap-12 xl:grid-cols-12 xl:gap-16">
          {/* Left: headline, sentence, CTA, text link */}
          <div className="flex max-w-2xl flex-col gap-6 xl:col-span-7 xl:max-w-none">
            <h1
              className="font-display leading-[1.05] tracking-[-0.02em] text-[var(--ivory)]"
              style={{ fontSize: 'clamp(2.5rem, 1.75rem + 3.5vw, 4rem)' }}
            >
              Practice with real prices. Risk nothing.
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--stone)]">
              MarketForge is a paper-trading simulator with live market quotes and $100,000 in
              virtual capital. Place orders, track positions, and review every fill.
            </p>

            <div className="flex flex-wrap items-center gap-5 pt-1">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="rounded-lg bg-[var(--ivory)] px-5 py-2.5 text-sm font-semibold text-[#0B0C0E] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E]"
              >
                {isAuthenticated ? 'Open dashboard' : 'Open practice account'}
              </Link>
              <Link
                to={isAuthenticated ? '/markets' : '/features'}
                className="text-[15px] font-medium text-[var(--stone)] underline decoration-[var(--hairline-hover)] underline-offset-8 transition hover:text-[var(--ivory)]"
              >
                {isAuthenticated ? 'Browse markets' : 'See how it works'}
              </Link>
            </div>

            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--hairline)] pt-6">
              {FACTS.map((f) => (
                <div key={f.label}>
                  <dt className="order-2 mt-1 text-[13px] text-[var(--stone)]">{f.label}</dt>
                  <dd className="order-1 text-xl font-semibold tabular-nums text-[var(--ivory)]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: live order ticket + price chart, edge-aligned, no chrome */}
          <motion.div
            className="hidden w-full lg:block xl:col-span-5"
            initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: isComfort ? 0 : DURATIONS.card, ease: EASING.contentReveal }}
          >
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-wide text-[var(--ivory)]">{active.symbol}</p>
                  <p className="text-xs text-[var(--stone)]">{active.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-[var(--ivory)]">
                    {fmtMoney(lastPrice)}
                  </p>
                  <p
                    className={`text-xs tabular-nums ${
                      periodChange >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                    }`}
                  >
                    {fmtPct(periodChange)}
                    {!live && <span className="ml-2 text-[var(--stone-muted)]">sample</span>}
                    {active.stale && <span className="ml-2 text-[var(--stone-muted)]">stale</span>}
                  </p>
                </div>
              </div>

              <div className="mt-4 min-h-[180px]">
                <PriceAreaChart data={prices} height={180} animationDuration={isComfort ? 0 : 900} />
              </div>

              <div
                className="mt-3 flex gap-1 overflow-x-auto rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] p-0.5"
                role="group"
                aria-label="Chart timeframe"
              >
                {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    aria-pressed={timeframe === tf}
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] ${
                      timeframe === tf
                        ? 'bg-white/10 font-medium text-[var(--ivory)]'
                        : 'text-[var(--stone)] hover:text-[var(--ivory)]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-1.5 overflow-x-auto" role="group" aria-label="Watch symbols">
                {tickers.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => setActiveSymbol(t.symbol)}
                    aria-pressed={active.symbol === t.symbol}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] ${
                      active.symbol === t.symbol
                        ? 'border-[var(--brass)]/50 bg-white/[0.05]'
                        : 'border-[var(--hairline)] hover:border-[var(--hairline-hover)]'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-[var(--ivory)]">{t.symbol}</span>
                    <span className="block text-[11px] tabular-nums text-[var(--stone)]">
                      {fmtMoney(t.price)}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-xs text-[var(--stone-muted)]">
                {active.live ? 'Live quote' : 'Delayed or sample quote'} · Simulated trading. Not
                investment advice.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
