import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import { TerminalLineChart } from './TerminalCharts'
import {
  formatCurrency,
  summarizePortfolio
} from '../utils/marketAnalytics'
import { exportToCSV } from '../utils/csvExport'
import { LiveValue } from './LiveValue'
import { ParticleButton } from './kokonutui/ParticleButton'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { SectorAllocation, SECTOR_THEMES } from './charts/sector-donut'
import { ShinyText } from './reactbits/ShinyText'
import { SegmentedControl } from './ui/SegmentedControl'
import Reveal from './ui/Reveal'

export default function Analytics() {
  const [range, setRange] = useState('3M')
  const { currentUser } = useAuth()
  const {
    portfolio,
    transactions,
    stocks,
    fetchPortfolio,
    fetchTransactions,
    fetchStocks,
    fetchPortfolioPerformance,
    startPolling,
    stopPolling
  } = useTrade()

  const [history, setHistory] = useState([])
  const [benchmarkReturn, setBenchmarkReturn] = useState(null)

  useEffect(() => {
    fetchPortfolio()
    fetchTransactions()
    fetchStocks()
    startPolling()
    return () => stopPolling()
  }, [fetchPortfolio, fetchTransactions, fetchStocks, startPolling, stopPolling])

  const analytics = useMemo(
    () => summarizePortfolio(portfolio, transactions, stocks),
    [portfolio, transactions, stocks]
  )

  // Real portfolio equity curve for the selected range (server-computed)
  useEffect(() => {
    let cancelled = false
    fetchPortfolioPerformance(range).then((res) => {
      if (cancelled) return
      setHistory(res.data || [])
      if (typeof res.meta?.benchmarkReturn === 'number') {
        setBenchmarkReturn(res.meta.benchmarkReturn)
      }
    })
    return () => {
      cancelled = true
    }
  }, [range, fetchPortfolioPerformance])

  const holdings = useMemo(() => portfolio?.holdings || [], [portfolio?.holdings])

  const tradeStats = useMemo(() => {
    const totalVolume = transactions.reduce((sum, item) => sum + Number(item.total || 0), 0)
    const buys = transactions.filter((item) => item.type === 'BUY').length
    const sells = transactions.filter((item) => item.type === 'SELL').length

    return {
      totalVolume,
      tradesCount: transactions.length,
      buys,
      sells
    }
  }, [transactions])

  // Sector Exposure breakdown (live prices — consistent with summarizePortfolio)
  const sectorAllocation = useMemo(() => {
    const map = {}
    let totalInvested = 0
    holdings.forEach((h) => {
      const stock = stocks.find((s) => s.symbol === h.symbol)
      const sec = stock?.sector || 'Other'
      const val = (h.quantity * (stock?.price ?? h.currentPrice ?? h.avgBuyPrice)) || 0
      map[sec] = (map[sec] || 0) + val
      totalInvested += val
    })

    const cash = currentUser?.balance || 0
    totalInvested += cash
    map['Cash'] = (map['Cash'] || 0) + cash

    if (totalInvested === 0) return []
    const sorted = Object.entries(map)
      .map(([name, val]) => ({
        name,
        key: name,
        value: val,
        percentage: ((val / totalInvested) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage)
    // Phase 0: truncated donuts must not renormalize silently. Keep top 5
    // and fold the remainder into Other.
    if (sorted.length <= 5) return sorted
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5)
    const otherValue = rest.reduce((s, r) => s + r.value, 0)
    return [...top, { name: 'Other', key: '__other', isOther: true, count: rest.length, value: otherValue, percentage: (otherValue / totalInvested) * 100 }]
  }, [holdings, stocks, currentUser])

  // Performance Movers list
  const performanceMovers = useMemo(() => {
    return [...holdings]
      .sort((a, b) => Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0))
      .slice(0, 5)
  }, [holdings])

  const isTotalPos = analytics.totalPnL >= 0
  const isTodayPos = analytics.todayPnL >= 0

  // Phase 0: no toast-only report action. Export the visible equity + sector
  // data as CSV (react-hot-toast stays the only toast system).
  const handleGenerateReport = () => {
    const headers = ['Metric', 'Value']
    const rows = [
      ['Range', range],
      ['Total P&L', Number(analytics.totalPnL || 0).toFixed(2)],
      ['Benchmark (S&P 500)', benchmarkReturn != null ? `${benchmarkReturn.toFixed(2)}%` : 'unavailable'],
      ...sectorAllocation.map((s) => [`Sector ${s.name}`, `${s.value.toFixed(2)} (${s.percentage.toFixed(1)}%)`])
    ]
    exportToCSV(headers, rows, `marketforge_analytics_${range}.csv`)
    toast.success('Analytics summary exported as CSV.')
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Section */}
      <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="mf-h1">
            <ShinyText>Portfolio Analytics</ShinyText>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--stone-muted)] mt-1">
            Total Return &amp; Risk Profile vs Benchmark.
          </p>
        </div>

<div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            value={range}
            onChange={setRange}
            ariaLabel="Analytics range"
            options={['1M', '3M', '6M', 'YTD', '1Y'].map((r) => ({ value: r, label: r }))}
          />

          <ParticleButton
            onClick={handleGenerateReport}
            tone="brass"
            className="px-4 py-2 text-xs font-mono font-medium"
          >
            Generate Report
          </ParticleButton>
        </div>
      </Reveal>

      {/* Main Grid: 8 Cols Chart + 4 Cols Secondary Modules */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Visualization Area (8 cols) */}
        <Reveal delay={0.05} className="xl:col-span-8 flex flex-col gap-6">
          {/* Performance Chart Module */}
          <div className="bg-[#111316]/95 rounded-2xl border border-white/8 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
                  Total Portfolio Value
                </div>
                <div className="text-3xl sm:text-4xl font-bold font-mono text-[var(--ivory)] whitespace-nowrap">
                  <LiveValue value={Number(analytics.portfolioValue || 0)} format={(v) => `$${v.toFixed(2)}`} />
                </div>
                <div className="flex items-center gap-2 mt-1.5 font-mono text-xs">
                  <span
                    className={`font-semibold ${
                      isTotalPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                    }`}
                  >
                    {isTotalPos ? '+' : ''}
                    {Number(analytics.returnPercent || 0).toFixed(2)}%
                  </span>
                  <span className="text-text-muted">
                    vs S&amp;P 500{' '}
                    <span className="text-[var(--stone-muted)]" title="Scalar benchmark over the selected window (real S&P 500 closes, 24h cached). Date-aligned series lands post-Phase 0.">
                      {benchmarkReturn != null
                        ? `${benchmarkReturn >= 0 ? '+' : ''}${benchmarkReturn.toFixed(2)}%`
                        : 'unavailable'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-[var(--stone)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--brass)]"></span>
                  Portfolio
                </span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-[var(--stone-muted)]"></span>
                  S&amp;P 500
                </span>
              </div>
            </div>

            <div className="min-h-[260px] w-full">
              <TerminalLineChart
                data={history}
                label="Equity curve"
                color="#C9A96E"
                height={260}
                showGrid={true}
              />
            </div>
          </div>

          {/* Standardized Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.08)] shadow-xl">
            <div className="bg-[#111316] p-5">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">
                Day Return
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  isTodayPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                }`}
              >
                {isTodayPos ? '+' : ''}
                {formatCurrency(analytics.todayPnL || 0)}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">
                {isTodayPos ? '+' : ''}
                {Number(analytics.dailyReturn || 0).toFixed(2)}% Today
              </div>
            </div>

            <div className="bg-[#111316] p-5">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">
                Total Return
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  isTotalPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                }`}
              >
                {isTotalPos ? '+' : ''}
                {formatCurrency(analytics.totalPnL || 0)}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">
                {isTotalPos ? '+' : ''}
                {Number(analytics.returnPercent || 0).toFixed(2)}% All Time
              </div>
            </div>

            <div className="bg-[#111316] p-5">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">
                Buying Power
              </div>
              <div className="text-xl font-bold font-mono text-[var(--ivory)]">
                {formatCurrency(currentUser?.balance ?? 100000)}
              </div>
              <div className="text-xs text-text-muted font-mono mt-1">
                Available to trade
              </div>
            </div>
          </div>
        </Reveal>

        {/* Secondary Modules (4 cols) */}
        <Reveal delay={0.1} className="xl:col-span-4 flex flex-col gap-6">
          {/* Sector Exposure Module */}
          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.15)"
            tiltIntensity={4}
            className="bg-[#111316]/95 rounded-2xl border border-white/8 p-5 sm:p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="mf-h2">
                Sector Exposure
              </h2>
              <span className="text-[10px] font-mono text-text-muted uppercase">
                Weights
              </span>
            </div>

            <SectorAllocation
              items={sectorAllocation.map((sec) => ({
                label: sec.isOther && sec.count > 0 ? `Other (${sec.count} holdings)` : sec.name,
                key: sec.key ?? sec.name,
                isOther: Boolean(sec.isOther),
                value: sec.value,
                display: `${sec.percentage.toFixed(1)}%`,
              }))}
              palette={SECTOR_THEMES.terminal}
              size={168}
              layout="column"
              legendLimit={6}
              totalDisplay={`${sectorAllocation.length} sectors`}
              totalLabel="Covered"
            />
          </SpotlightCard>

          {/* Trading Activity (30D) Module */}
          <SpotlightCard
            spotlightColor="rgba(34, 197, 94, 0.15)"
            tiltIntensity={4}
            className="bg-[#111316]/95 rounded-2xl border border-white/8 p-5 sm:p-6 flex-1 flex flex-col"
          >
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3">
              Trading Activity (Ledger)
            </div>

            <div className="mb-5">
              <div className="text-2xl font-bold font-mono text-[var(--ivory)]">
                {formatCurrency(tradeStats.totalVolume)}
              </div>
              <div className="text-xs text-text-muted font-mono mt-0.5">
                Total Executed Volume ({tradeStats.tradesCount} trades)
              </div>
            </div>

            <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 border-t border-white/8 pt-3">
              Performance Movers
            </div>

            {/* Position Movers List */}
            <div className="flex flex-col -mx-2 divide-y divide-white/5">
              {performanceMovers.length === 0 ? (
                <p className="text-xs text-text-muted px-2 py-3">No active positions yet.</p>
              ) : (
                performanceMovers.map((holding) => {
                  const isPos = (holding.pnl || 0) >= 0
                  return (
                    <div
                      key={holding.symbol}
                      className="flex justify-between items-center py-2.5 px-2 hover:bg-[#181B1F] transition rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[var(--ivory)]">
                          {holding.symbol}
                        </span>
                        <span className="mf-meta truncate max-w-[80px]">
                          {holding.name}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <div
                          className={`text-xs font-semibold ${
                            isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {Number(holding.pnlPercent || 0).toFixed(2)}%
                        </div>
                        <div className="mf-num text-xs text-[var(--stone-muted)]">
                          {isPos ? '+' : ''}
                          {formatCurrency(holding.pnl || 0)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </SpotlightCard>
        </Reveal>
      </div>
    </div>
  )
}
