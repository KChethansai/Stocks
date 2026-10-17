import { useMemo } from 'react'
import { Illustrative, LReveal, Section, SectionHead } from './ui'
import { Area } from '../charts/area-chart'
import {
  PriceAreaChart,
  useOhlcSeries,
} from '../charts/market-charts'

// D10 (integrity pass): a portfolio illustration must derive its performance
// from a clearly disclosed example allocation and real historical inputs —
// never one stock's history relabeled, never a synthetic curve. This section
// fetches genuine daily history for a disclosed example ($10,000 split
// equally across NVDA, AAPL, MSFT, normalized to 100) plus a genuine SPY
// benchmark over the same window. Four bounded requests, shared cache, no
// polling. Zero fabricated performance.
const FUND = ['NVDA', 'AAPL', 'MSFT']

function commonDates(seriesList) {
  if (!seriesList.length) return []
  const sets = seriesList.map((rows) => new Set(rows.map((r) => r.date.getTime())))
  const first = seriesList[0].map((r) => r.date.getTime()).sort((a, b) => a - b)
  const [, ...rest] = sets
  return first.filter((t) => rest.every((s) => s.has(t)))
}

export default function S06Analytics() {
  const nvda = useOhlcSeries('NVDA', '3M')
  const aapl = useOhlcSeries('AAPL', '3M')
  const msft = useOhlcSeries('MSFT', '3M')
  const spy = useOhlcSeries('SPY', '3M')
  const hooks = [nvda, aapl, msft, spy]

  const composite = useMemo(() => {
    const lists = hooks.map((h) => h.rows)
    if (lists.some((rows) => rows.length <= 3)) return null
    const dates = commonDates(lists)
    if (dates.length <= 3) return null
    const byTime = lists.map((rows) => {
      const m = new Map(rows.map((r) => [r.date.getTime(), Number(r.close)]))
      return m
    })
    // Normalize each leg to 100 at the window start, then equal-weight.
    const base = byTime.map((m) => m.get(dates[0]))
    if (base.some((b) => !Number.isFinite(b) || b <= 0)) return null
    return dates.map((t, i) => {
      const legs = byTime.map((m, k) => (m.get(t) / base[k]) * 100)
      if (legs.some((v) => !Number.isFinite(v))) return null
      const fund = (legs[0] + legs[1] + legs[2]) / 3
      const spyBase = byTime[3].get(dates[0])
      const benchmark = spyBase > 0 ? (byTime[3].get(t) / spyBase) * 100 : null
      if (!Number.isFinite(benchmark)) return null
      return { date: new Date(t), fund, benchmark, index: i }
    }).filter(Boolean)
  }, [nvda.rows, aapl.rows, msft.rows, spy.rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = hooks.some((h) => h.state === 'loading') && !composite
  const failed = !loading && !composite
  const anyStale = hooks.some((h) => h.state === 'stale' || h.seriesStale)
  const fetchedTimes = hooks.map((h) => h.seriesAsOf).filter(Boolean)
  const asOf = fetchedTimes.length
    ? new Date(Math.min(...fetchedTimes)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''
  const retryAll = () => hooks.forEach((h) => h.retry())

  return (
    <Section>
      <LReveal>
        <SectionHead
          eyebrow="Analytics"
          title="Performance with context."
          lede="An example $10,000 split equally across NVDA, AAPL, and MSFT against the S&P 500 (SPY) — all genuine daily history."
        />
      </LReveal>
      <LReveal delay={0.08}>
        <Illustrative className="mt-8" caption="Example allocation — not your portfolio. Fund and benchmark from genuine daily history.">
          <div className="rounded-xl border border-[rgba(236,233,226,.08)] bg-[#111316] p-5 sm:p-6">
            <div role="img" aria-label={`Example three-stock fund vs S&P 500, past three months, ${loading ? 'loading' : composite ? 'genuine history' : 'unavailable'}`}>
              {loading ? (
                <div className="aspect-[2/1] rounded-lg bg-white/[0.04] animate-pulse" aria-busy="true" aria-label="Loading example fund history" />
              ) : failed || !composite ? (
                <div className="aspect-[2/1] rounded-lg border border-white/8 bg-[#0B0C0E] flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-xs text-[var(--stone)]">Example fund history unavailable.</p>
                  <button type="button" onClick={retryAll} className="min-h-[44px] px-4 rounded-lg border border-white/10 text-xs font-semibold text-[var(--ivory)] hover:border-[var(--brass)]/50">
                    Retry
                  </button>
                </div>
              ) : (
                <div className={anyStale ? 'opacity-70' : undefined}>
                  <PriceAreaChart
                    data={composite}
                    yKey="fund"
                    showAxes
                    animationDuration={0}
                    formatY={(v) => Number(v).toFixed(1)}
                    theme={{
                      stroke: '#ECE9E2',
                      gradientFrom: 'rgba(201,169,110,0.28)',
                      gradientTo: 'rgba(201,169,110,0)',
                    }}
                  >
                    <Area dataKey="benchmark" stroke="#C9A96E" strokeWidth={1.5} fill="transparent" fillOpacity={0} dashFromIndex={0} />
                  </PriceAreaChart>
                </div>
              )}
            </div>
            <p className="mf-meta mt-3">
              {loading ? 'Loading genuine history for NVDA, AAPL, MSFT, SPY…' : composite ? `Genuine daily history · histories fetched ${asOf}${anyStale ? ' · some stale' : ''}` : 'Histories unavailable — retry to load genuine data.'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--stone)]">
              In the app this same construction runs on your own positions; here
              it runs on a disclosed example.
            </p>
          </div>
        </Illustrative>
      </LReveal>
    </Section>
  )
}
