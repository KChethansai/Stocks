import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  ArrowRight,
  PieChart
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { useTrade } from '../store/tradeStore'
import { TerminalLineChart } from './TerminalCharts'
import {
  createPortfolioHistory,
  formatCurrency,
  summarizePortfolio
} from '../utils/marketAnalytics'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { BorderBeam } from './magicui/BorderBeam'
import { NumberTicker } from './magicui/NumberTicker'
import { ShinyText } from './reactbits/ShinyText'

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const {
    stocks,
    portfolio,
    transactions,
    fetchStocks,
    fetchPortfolio,
    fetchTransactions,
    startPolling,
    stopPolling
  } = useTrade()

  const [range, setRange] = useState('1M')
  const [moverTab, setMoverTab] = useState('gainers') // 'gainers' | 'losers' | 'active'

  useEffect(() => {
    fetchStocks()
    fetchPortfolio()
    fetchTransactions()
    startPolling()
    return () => stopPolling()
  }, [fetchStocks, fetchPortfolio, fetchTransactions, startPolling, stopPolling])

  // Get user greeting according to time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // Summarize current portfolio metrics
  const analytics = useMemo(
    () => summarizePortfolio(portfolio, transactions, stocks),
    [portfolio, transactions, stocks]
  )

  // Calculate portfolio history curve
  const portfolioHistory = useMemo(
    () => createPortfolioHistory(portfolio, transactions, range),
    [portfolio, transactions, range]
  )

  // Watchlist items
  const watchlistStocks = useMemo(() => {
    const symbols = currentUser?.watchlist || []
    if (symbols.length === 0) {
      return stocks.slice(0, 4)
    }
    return symbols
      .map((sym) => stocks.find((s) => s.symbol === sym))
      .filter(Boolean)
      .slice(0, 6)
  }, [currentUser?.watchlist, stocks])

  // Market movers
  const movers = useMemo(() => {
    return {
      gainers: [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
      losers: [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3),
      active: [...stocks].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 3)
    }
  }, [stocks])

  const totalPnL = analytics.totalPnL
  const totalPnLPercent = analytics.totalPnLPercent
  const todayPnL = analytics.todayPnL
  const isTotalPos = totalPnL >= 0
  const isTodayPos = todayPnL >= 0

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Top Header / Hero Section */}
      <div className="flex flex-col gap-3">
        <p className="text-[#667085] text-sm font-medium">
          {greeting}{currentUser?.username ? `, ${currentUser.username}` : ''}
        </p>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-[#9CA3AF] mb-1">
              <ShinyText>Your Portfolio</ShinyText>
            </h2>
            <div className="flex flex-wrap items-baseline gap-4">
              <span className="text-4xl sm:text-5xl font-bold font-mono text-[#F5F7FA] tracking-tight">
                $<NumberTicker value={Number(analytics.portfolioValue || 0)} decimalPlaces={2} />
              </span>

              <div
                className={`inline-flex items-center gap-1 font-mono text-sm px-2.5 py-1 rounded-md font-semibold ${
                  isTotalPos
                    ? 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20'
                    : 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20'
                }`}
              >
                {isTotalPos ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {isTotalPos ? '+' : ''}
                  {totalPnLPercent.toFixed(2)}% ({isTotalPos ? '+' : ''}
                  {formatCurrency(totalPnL)})
                </span>
              </div>
            </div>
          </div>

          {/* Gridless Inline Metrics */}
          <div className="flex flex-wrap gap-8 items-end border-t lg:border-t-0 border-white/8 pt-4 lg:pt-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-mono">Today&apos;s P&amp;L</span>
              <span
                className={`font-mono text-sm font-semibold ${
                  isTodayPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
              >
                {isTodayPos ? '+' : ''}
                {formatCurrency(todayPnL)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-mono">Available Cash</span>
              <span className="text-[#F5F7FA] font-mono text-sm font-semibold">
                {formatCurrency(analytics.cashBalance || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-[#667085] text-xs font-mono">Invested Capital</span>
              <span className="text-[#F5F7FA] font-mono text-sm font-semibold">
                {formatCurrency(analytics.investedAmount || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: 8 Columns (Left) + 4 Columns (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Performance Chart & Market Movers */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Performance Chart Module */}
          <div className="rounded-2xl border border-white/8 bg-[#111318]/95 p-5 sm:p-6 relative overflow-hidden transition duration-200 hover:border-white/20 shadow-xl">
            <BorderBeam size={240} duration={9} colorFrom="#3B82F6" colorTo="#10B981" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-base font-semibold text-[#F5F7FA]">
                  Performance
                </h3>
                <div className="flex items-center gap-3 text-xs text-[#9CA3AF] font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                    Portfolio
                  </span>
                  <span className="flex items-center gap-1.5 text-[#667085]">
                    <span className="w-2 h-2 rounded-full bg-[#424754]"></span>
                    S&amp;P 500
                  </span>
                </div>
              </div>

              {/* Time Range Selectors */}
              <div className="flex bg-[#151820] rounded-lg p-1 border border-white/8">
                {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded text-xs font-mono transition cursor-pointer ${
                      range === r
                        ? 'bg-[#353437] text-[#F5F7FA] font-semibold shadow-sm'
                        : 'text-[#9CA3AF] hover:text-[#F5F7FA]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Performance Chart */}
            <div className="min-h-[300px]">
              <TerminalLineChart
                data={portfolioHistory}
                color="#3B82F6"
                height={280}
                yAxisLabel="Value ($)"
                showGrid={true}
              />
            </div>
          </div>

          {/* Market Movers Module */}
          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.15)"
            tiltIntensity={4}
            className="rounded-2xl border border-white/8 bg-[#111318]/95 p-5 sm:p-6 flex flex-col"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/8 pb-4">
              <h3 className="text-base font-semibold text-[#F5F7FA]">
                Market Movers
              </h3>
              <div className="flex items-center gap-4">
                {[
                  { id: 'gainers', label: 'Top Gainers' },
                  { id: 'losers', label: 'Top Losers' },
                  { id: 'active', label: 'Most Active' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMoverTab(tab.id)}
                    className={`text-xs font-mono pb-1 transition cursor-pointer ${
                      moverTab === tab.id
                        ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] font-semibold'
                        : 'text-[#9CA3AF] hover:text-[#F5F7FA]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mover Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {movers[moverTab].map((stock) => {
                const isPos = stock.changePercent >= 0
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => navigate(`/markets?stock=${stock.symbol}`)}
                    className="p-4 bg-[#151820]/90 rounded-xl border border-white/5 hover:border-[#3B82F6]/40 hover:shadow-lg hover:shadow-[#3B82F6]/5 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-mono text-sm text-[#F5F7FA] font-bold group-hover:text-[#3B82F6] transition">
                        {stock.symbol}
                      </div>
                      <div
                        className={`font-mono text-xs font-semibold ${
                          isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {stock.changePercent?.toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="font-mono text-sm text-[#F5F7FA]">
                        ${Number(stock.price).toFixed(2)}
                      </span>
                      <span className="text-[11px] text-[#667085] truncate max-w-[90px]">
                        {stock.name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </SpotlightCard>
        </div>

        {/* Right Column (4 cols): Watchlist & Quick Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Watchlist Module */}
          <SpotlightCard
            spotlightColor="rgba(245, 158, 11, 0.12)"
            tiltIntensity={4}
            className="rounded-2xl border border-white/8 bg-[#111318]/95 p-5 sm:p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-[#F5F7FA]">
                Watchlist
              </h3>
              <Link
                to="/watchlist"
                className="text-xs text-[#3B82F6] hover:underline flex items-center gap-1 font-mono"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Watchlist Table Headers */}
            <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-white/8 text-[#667085] text-[10px] uppercase font-mono tracking-wider">
              <div className="col-span-4">Symbol</div>
              <div className="col-span-4 text-right">Price</div>
              <div className="col-span-4 text-right">24H</div>
            </div>

            {/* Watchlist Rows */}
            <div className="divide-y divide-white/5">
              {watchlistStocks.map((stock) => {
                const isPos = stock.changePercent >= 0
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => navigate(`/markets?stock=${stock.symbol}`)}
                    className="grid grid-cols-12 gap-2 py-3 items-center hover:bg-[#151820] -mx-2 px-2 rounded-lg transition cursor-pointer group"
                  >
                    <div className="col-span-4 flex flex-col min-w-0">
                      <span className="font-mono text-xs font-bold text-[#F5F7FA] group-hover:text-[#3B82F6] transition truncate">
                        {stock.symbol}
                      </span>
                      <span className="text-[10px] text-[#667085] truncate">
                        {stock.name}
                      </span>
                    </div>

                    <div className="col-span-4 text-right font-mono text-xs font-medium text-[#F5F7FA]">
                      ${Number(stock.price).toFixed(2)}
                    </div>

                    <div
                      className={`col-span-4 text-right font-mono text-xs font-semibold ${
                        isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {stock.changePercent?.toFixed(2)}%
                    </div>
                  </div>
                )
              })}
            </div>
          </SpotlightCard>

          {/* Quick Actions Module */}
          <div className="rounded-2xl border border-white/8 bg-[#111318]/95 p-5 sm:p-6 flex flex-col gap-3">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-[#667085] mb-1">
              Quick Actions
            </h3>

            <Link
              to="/markets"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#3B82F6] text-white hover:bg-[#2563EB] transition font-medium text-xs shadow-md shadow-[#3B82F6]/20 font-mono"
            >
              <span>Explore Markets</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/portfolio"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 bg-[#151820] hover:bg-[#1c1b1d] text-[#F5F7FA] transition text-xs font-mono group"
            >
              <span>View Full Portfolio</span>
              <Briefcase className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#F5F7FA] transition" />
            </Link>

            <Link
              to="/analytics"
              className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 bg-[#151820] hover:bg-[#1c1b1d] text-[#F5F7FA] transition text-xs font-mono group"
            >
              <span>Analyze Allocation &amp; Risk</span>
              <PieChart className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#F5F7FA] transition" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
