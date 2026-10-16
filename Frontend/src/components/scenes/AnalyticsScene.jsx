import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, EASING } from '../../lib/motion'
import { useTrade } from '../../store/tradeStore'
import { PriceAreaChart, useOhlcSeries } from '../charts/market-charts'
import { SectorAllocation, SECTOR_THEMES } from '../charts/sector-donut'
import { Area } from '../charts/area-chart'
import { summarizePortfolio } from '../../utils/marketAnalytics'
import { fmtMoney, fmtPct } from '../../utils/format'

// Demo account, simulated: fixed holdings revalued with live quotes through
// the same summarizePortfolio every dashboard uses. Nothing here is a real
// user's performance; the caption says so.
const DEMO_HOLDINGS = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', quantity: 20, avgBuyPrice: 880.0, currentPrice: 880.0 },
  { symbol: 'AAPL', name: 'Apple Inc.', quantity: 40, avgBuyPrice: 220.0, currentPrice: 220.0 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', quantity: 15, avgBuyPrice: 410.0, currentPrice: 410.0 },
]
const DEMO_CASH = 68050

function DemoComparison() {
  const { prices: pf, live: pfLive } = useOhlcSeries('NVDA', 'ALL')
  const { prices: sp, live: spLive } = useOhlcSeries('SPY', 'ALL')

  const { rows, pfPct, spPct, ready } = useMemo(() => {
    const n = Math.min(pf.length, sp.length)
    if (n < 4) return { rows: [], pfPct: 0, spPct: 0, ready: false }
    const p0 = pf[pf.length - n].price
    const s0 = sp[sp.length - n].price
    const rows = []
    for (let i = 0; i < n; i++) {
      const a = pf[pf.length - n + i]
      const b = sp[sp.length - n + i]
      rows.push({ date: a.date, pf: (a.price / p0) * 100, sp: (b.price / s0) * 100 })
    }
    return { rows, pfPct: rows[n - 1].pf - 100, spPct: rows[n - 1].sp - 100, ready: true }
  }, [pf, sp])

  if (!ready) {
    return (
      <div className="flex h-[160px] items-center justify-center text-xs text-[var(--stone-muted)]" role="status">
        Loading comparison…
      </div>
    )
  }
  if (!pfLive || !spLive) {
    return (
      <div className="flex h-[160px] flex-col items-center justify-center gap-1 text-center" role="status">
        <p className="text-xs font-medium text-[var(--stone)]">Sample data — backend unreachable</p>
        <p className="max-w-xs text-xs text-[var(--stone-muted)]">
          The comparison below uses offline sample series, not market history.
        </p>
      </div>
    )
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-5 text-xs text-[var(--stone-muted)]">
        <span className="flex items-center gap-1.5 text-[var(--ivory)]">
          <span className="inline-block h-0.5 w-4 bg-[var(--ivory)]" aria-hidden="true" />
          NVDA {fmtPct(pfPct, 1)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[var(--stone-muted)]" aria-hidden="true" />
          S&amp;P 500 {fmtPct(spPct, 1)}
        </span>
      </div>
      <PriceAreaChart data={rows} yKey="pf" height={160} showAxes={false}>
        <Area
          dataKey="sp"
          stroke="#8A867E"
          strokeWidth={1.5}
          fill="transparent"
          fillOpacity={0}
          showHighlight={false}
        />
      </PriceAreaChart>
      <p className="mt-2 text-xs text-[var(--stone-muted)]">
        Normalized to 100 at the first close. Past moves do not predict your results.
      </p>
    </div>
  )
}

export default function AnalyticsScene() {
  const isComfort = useReducedMotion()
  const stocks = useTrade((s) => s.stocks)

  const demo = useMemo(() => {
    const portfolio = {
      holdings: DEMO_HOLDINGS,
      user: { balance: DEMO_CASH },
      currentValue: 0,
      totalInvested: 0,
      unrealizedPnL: 0,
    }
    return summarizePortfolio(portfolio, [], stocks || [])
  }, [stocks])

  const metrics = [
    { label: 'Demo portfolio value', value: fmtMoney(demo.portfolioValue) },
    { label: 'Total profit and loss', value: fmtMoney(demo.totalPnL), signed: true, positive: demo.totalPnL >= 0 },
    { label: 'Cash remaining', value: fmtMoney(demo.cashBalance) },
  ]

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mf-scene">
        <div className="mf-scene-frame">
          <motion.div
            className="mx-auto mb-12 max-w-2xl text-center"
            initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: isComfort ? 0 : DURATIONS.content, ease: EASING.contentReveal }}
          >
            <h2
              className="font-display leading-[1.05] tracking-[-0.02em] text-[var(--ivory)]"
              style={{ fontSize: 'clamp(1.75rem, 1.375rem + 2vw, 2.75rem)' }}
            >
              Analytics on a demo account
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--stone)]">
              The same equity curve, sector mix, and profit and loss math the app computes for
              your portfolio — shown here on fixed demo holdings revalued with live quotes.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5 sm:p-6 lg:col-span-7">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <p className="text-[13px] text-[var(--stone)]">{m.label}</p>
                    <p
                      className={`mt-1 text-2xl font-semibold tabular-nums ${
                        m.signed
                          ? m.positive
                            ? 'text-[var(--gain)]'
                            : 'text-[var(--loss)]'
                          : 'text-[var(--ivory)]'
                      }`}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <DemoComparison />
              </div>
              <p className="mt-4 text-xs text-[var(--stone-muted)]">
                Demo account, simulated: $31,950 invested at cost plus $68,050 cash equals the
                $100,000 starting balance. Computed from fixed holdings, not a real user.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5 sm:p-6 lg:col-span-5">
              <p className="text-[13px] text-[var(--stone)]">Demo sector mix</p>
              <div className="mt-3">
                <SectorAllocation
                  items={demo.sectorAllocation.map((s) => ({
                    label: s.label,
                    value: s.value,
                    display: `${s.percent.toFixed(1)}%`,
                  }))}
                  palette={SECTOR_THEMES.terminal}
                  size={160}
                  legendLimit={6}
                  totalDisplay={fmtMoney(demo.currentValue)}
                  totalLabel="Invested"
                />
              </div>
              <p className="mt-3 text-xs text-[var(--stone-muted)]">
                Computed with live prices through the same code as your portfolio page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
