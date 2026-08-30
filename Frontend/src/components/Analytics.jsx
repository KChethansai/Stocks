import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import { TerminalLineChart } from './TerminalCharts'
import {
  formatCurrency,
  summarizePortfolio
} from '../utils/marketAnalytics'
import { NumberTicker } from './magicui/NumberTicker'
import { ShimmerButton } from './magicui/ShimmerButton'
import { BorderBeam } from './magicui/BorderBeam'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ShinyText } from './reactbits/ShinyText'
import { SegmentedControl } from './ui/SegmentedControl'

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

  // Sector Exposure breakdown
  const sectorAllocation = useMemo(() => {
    const map = {}
    let totalInvested = 0
    holdings.forEach((h) => {
      const stock = stocks.find((s) => s.symbol === h.symbol)
      const sec = stock?.sector || 'Other'
      const val = h.currentValue || (h.quantity * (h.currentPrice || h.avgBuyPrice)) || 0
      map[sec] = (map[sec] || 0) + val
      totalInvested += val
    })

    const cash = currentUser?.balance || 0
    totalInvested += cash
    map['Cash'] = (map['Cash'] || 0) + cash

    if (totalInvested === 0) return []
    return Object.entries(map)
      .map(([name, val]) => ({
        name,
        value: val,
        percentage: ((val / totalInvested) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage)
  }, [holdings, stocks, currentUser])

  // Performance Movers list
  const performanceMovers = useMemo(() => {
    return [...holdings]
      .sort((a, b) => Math.abs(b.pnl || 0) - Math.abs(a.pnl || 0))
      .slice(0, 5)
  }, [holdings])

  const isTotalPos = analytics.totalPnL >= 0
  const isTodayPos = analytics.todayPnL >= 0

  const handleGenerateReport = () => {
    toast.success('Generated institutional risk & attribution report.')
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#F5F7FA]">
            <ShinyText>Portfolio Analytics</ShinyText>
          </h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
            Total Return &amp; Risk Profile vs Benchmark.
          </p>
        </div>

<div className="flex items-center gap-3">
          <SegmentedControl
            value={range}
            onChange={setRange}
            ariaLabel="Analytics range"
            options={['1M', '3M', '6M', 'YTD', '1Y'].map((r) => ({ value: r, label: r }))}
          />

          <ShimmerButton
            onClick={handleGenerateReport}
            background="#3B82F6"
            className="px-4 py-2 text-xs font-mono font-medium"
          >
            Generate Report
          </ShimmerButton>
        </div>
      </div>

      {/* Main Grid: 8 Cols Chart + 4 Cols Secondary Modules */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Main Visualization Area (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Performance Chart Module */}
          <div className="bg-[#111318]/95 rounded-2xl border border-white/8 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <BorderBeam size={220} duration={8} colorFrom="#3B82F6" colorTo="#22C55E" />
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <div className="text-[10px] font-mono text-[#667085] uppercase tracking-widest mb-1">
                  Total Portfolio Value
                </div>
                <div className="text-3xl sm:text-4xl font-bold font-mono text-[#F5F7FA]">
                  $<NumberTicker value={Number(analytics.portfolioValue || 0)} decimalPlaces={2} />
                </div>
                <div className="flex items-center gap-2 mt-1.5 font-mono text-xs">
                  <span
                    className={`font-semibold ${
                      isTotalPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                    }`}
                  >
                    {isTotalPos ? '+' : ''}
                    {Number(analytics.returnPercent || 0).toFixed(2)}%
                  </span>
                  <span className="text-[#667085]">
                    vs S&amp;P 500{' '}
                    <span className="text-[#9CA3AF]">
                      {benchmarkReturn != null
                        ? `${benchmarkReturn >= 0 ? '+' : ''}${benchmarkReturn.toFixed(2)}%`
                        : '—'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-[#9CA3AF]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                  Portfolio
                </span>
                <span className="flex items-center gap-1.5 text-[#667085]">
                  <span className="w-2 h-2 rounded-full bg-[#667085]"></span>
                  S&amp;P 500
                </span>
              </div>
            </div>

            <div className="min-h-[260px] w-full">
              <TerminalLineChart
                data={history}
                color="#3B82F6"
                height={260}
                yAxisLabel="Equity ($)"
                showGrid={true}
              />
            </div>
          </div>

          {/* Standardized Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]">
            <div className="bg-[#111318] p-5">
              <div className="text-[10px] font-mono text-[#667085] uppercase tracking-wider mb-1">
                Day Return
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  isTodayPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
              >
                {isTodayPos ? '+' : ''}
                {formatCurrency(analytics.todayPnL || 0)}
              </div>
              <div className="text-xs text-[#667085] font-mono mt-1">
                {isTodayPos ? '+' : ''}
                {Number(analytics.dailyReturn || 0).toFixed(2)}% Today
              </div>
            </div>

            <div className="bg-[#111318] p-5">
              <div className="text-[10px] font-mono text-[#667085] uppercase tracking-wider mb-1">
                Total Return
              </div>
              <div
                className={`text-xl font-bold font-mono ${
                  isTotalPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
              >
                {isTotalPos ? '+' : ''}
                {formatCurrency(analytics.totalPnL || 0)}
              </div>
              <div className="text-xs text-[#667085] font-mono mt-1">
                {isTotalPos ? '+' : ''}
                {Number(analytics.returnPercent || 0).toFixed(2)}% All Time
              </div>
            </div>

            <div className="bg-[#111318] p-5">
              <div className="text-[10px] font-mono text-[#667085] uppercase tracking-wider mb-1">
                Buying Power
              </div>
              <div className="text-xl font-bold font-mono text-[#F5F7FA]">
                {formatCurrency(currentUser?.balance ?? 100000)}
              </div>
              <div className="text-xs text-[#667085] font-mono mt-1">
                Available to trade
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Modules (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Sector Exposure Module */}
          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.15)"
            tiltIntensity={4}
            className="bg-[#111318]/95 rounded-2xl border border-white/8 p-5 sm:p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-[#F5F7FA]">
                Sector Exposure
              </h2>
              <span className="text-[10px] font-mono text-[#667085] uppercase">
                Weights
              </span>
            </div>

            <div className="space-y-4">
              {sectorAllocation.slice(0, 5).map((sec, i) => (
                <div key={sec.name} className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#9CA3AF]">{sec.name}</span>
                    <span className="text-[#F5F7FA] font-bold">
                      {sec.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#151820] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        i === 0
                          ? 'bg-[#3B82F6]'
                          : i === 1
                          ? 'bg-[#22C55E]'
                          : i === 2
                          ? 'bg-[#9CA3AF]'
                          : 'bg-[#667085]'
                      }`}
                      style={{ width: `${Math.min(100, sec.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Trading Activity (30D) Module */}
          <SpotlightCard
            spotlightColor="rgba(34, 197, 94, 0.15)"
            tiltIntensity={4}
            className="bg-[#111318]/95 rounded-2xl border border-white/8 p-5 sm:p-6 flex-1 flex flex-col"
          >
            <div className="text-[10px] font-mono text-[#667085] uppercase tracking-widest mb-3">
              Trading Activity (Ledger)
            </div>

            <div className="mb-5">
              <div className="text-2xl font-bold font-mono text-[#F5F7FA]">
                {formatCurrency(tradeStats.totalVolume)}
              </div>
              <div className="text-xs text-[#667085] font-mono mt-0.5">
                Total Executed Volume ({tradeStats.tradesCount} trades)
              </div>
            </div>

            <div className="text-[10px] font-mono text-[#667085] uppercase tracking-widest mb-2 border-t border-white/8 pt-3">
              Performance Movers
            </div>

            {/* Position Movers List */}
            <div className="flex flex-col -mx-2 divide-y divide-white/5">
              {performanceMovers.length === 0 ? (
                <p className="text-xs text-[#667085] px-2 py-3">No active positions yet.</p>
              ) : (
                performanceMovers.map((holding) => {
                  const isPos = (holding.pnl || 0) >= 0
                  return (
                    <div
                      key={holding.symbol}
                      className="flex justify-between items-center py-2.5 px-2 hover:bg-[#151820] transition rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-[#F5F7FA]">
                          {holding.symbol}
                        </span>
                        <span className="text-[11px] text-[#667085] truncate max-w-[80px]">
                          {holding.name}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <div
                          className={`text-xs font-semibold ${
                            isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {Number(holding.pnlPercent || 0).toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-[#667085]">
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
        </div>
      </div>
    </div>
  )
}
