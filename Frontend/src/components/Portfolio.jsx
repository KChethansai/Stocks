import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import toast from 'react-hot-toast'
import {
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Search,
  ArrowRight,
  PlusCircle,
  TrendingUp,
  PieChart,
  ShieldCheck,
  X
} from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import { TerminalLineChart } from './TerminalCharts'
import { exportToCSV } from '../utils/csvExport'
import {
  formatCurrency,
  summarizePortfolio
} from '../utils/marketAnalytics'
import { useShell } from './layout/ShellContext'
import { NumberTicker } from './magicui/NumberTicker'
import { BorderBeam } from './magicui/BorderBeam'
import { ParticleButton } from './kokonutui/ParticleButton'
import { SectorAllocation, SECTOR_THEMES } from './charts/sector-donut'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { ShinyText } from './reactbits/ShinyText'
import { Button } from './ui/Button'
import Reveal from './ui/Reveal'
import { QuantityStepper } from './ui/QuantityStepper'

class PortfolioErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[Portfolio] Render error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto text-center space-y-4">
          <div className="p-8 rounded-2xl bg-[#111318] border border-[rgba(255,255,255,0.08)] max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-bold text-[#F5F7FA]">Unable to display portfolio visualization</h2>
            <p className="text-xs text-[#9CA3AF]">
              A temporary display error occurred while rendering the 3D allocation. Your portfolio positions and balance are completely safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-mono font-semibold rounded-lg transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function PortfolioContent() {
  const navigate = useNavigate()
  const { openTradeModal } = useShell()
  const {
    portfolio,
    transactions,
    stocks,
    fetchPortfolio,
    fetchTransactions,
    fetchStocks,
    fetchPortfolioPerformance,
    sellStock,
    startPolling,
    stopPolling
  } = useTrade()
  const { fetchProfile } = useAuth()

  const [range, setRange] = useState('1M')
  const [query, setQuery] = useState('')
  const [sellModalHolding, setSellModalHolding] = useState(null)
  const [sellQty, setSellQty] = useState(1)
  const [selling, setSelling] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetchPortfolio()
    fetchTransactions()
    fetchStocks()
    fetchProfile()
    startPolling()
    return () => stopPolling()
  }, [fetchPortfolio, fetchTransactions, fetchStocks, fetchProfile, startPolling, stopPolling])

  const holdings = useMemo(() => portfolio?.holdings || [], [portfolio?.holdings])

  const filteredHoldings = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return holdings
    return holdings.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q)
    )
  }, [holdings, query])

  // Summarized metrics
  const analytics = useMemo(
    () => summarizePortfolio(portfolio, transactions, stocks),
    [portfolio, transactions, stocks]
  )

  // Real portfolio equity curve for the selected range (server-computed)
  useEffect(() => {
    let cancelled = false
    fetchPortfolioPerformance(range).then((res) => {
      if (!cancelled) setHistory(res.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [range, fetchPortfolioPerformance])

  const isTotalPos = analytics.totalPnL >= 0
  const isTodayPos = analytics.todayPnL >= 0

  // Find best performer
  const bestPerformer = useMemo(() => {
    if (holdings.length === 0) return null
    return [...holdings].sort((a, b) => (b.pnlPercent || 0) - (a.pnlPercent || 0))[0]
  }, [holdings])

  // Sector breakdown (live prices — same derivation as summarizePortfolio,
  // so Insight-2 stays consistent with the fixed portfolio totals)
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
    if (totalInvested === 0) return []
    return Object.entries(map).map(([name, val]) => ({
      name,
      value: val,
      percentage: ((val / totalInvested) * 100)
    })).sort((a, b) => b.percentage - a.percentage)
  }, [holdings, stocks])

  // Equity vs Cash mix for Insight-3 (live)
  const { equityValue, cashValue, equityPct } = useMemo(() => {
    const equity = sectorAllocation.reduce((s, sec) => s + (sec.value || 0), 0)
    const cash = Number(portfolio?.user?.balance ?? 0)
    const total = equity + cash
    return {
      equityValue: equity,
      cashValue: cash,
      equityPct: total > 0 ? Math.min(100, Math.max(0, (equity / total) * 100)) : 0,
    }
  }, [sectorAllocation, portfolio])

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = [
      'Symbol',
      'Company',
      'Shares',
      'Avg Price ($)',
      'Current Price ($)',
      'Invested ($)',
      'Market Value ($)',
      'Unrealized P&L ($)',
      'P&L (%)'
    ]
    const rows = holdings.map((h) => [
      h.symbol,
      h.name || '-',
      h.quantity,
      Number(h.avgBuyPrice || 0).toFixed(2),
      Number(h.currentPrice || 0).toFixed(2),
      Number(h.invested || 0).toFixed(2),
      Number(h.currentValue || 0).toFixed(2),
      Number(h.pnl || 0).toFixed(2),
      `${Number(h.pnlPercent || 0).toFixed(2)}%`
    ])
    exportToCSV(headers, rows, 'portfolio_holdings.csv')
  }, [holdings])

  // Open sell modal
  const handleOpenSell = (e, holding) => {
    e.stopPropagation()
    setSellModalHolding(holding)
    setSellQty(holding.quantity)
  }

  // Execute sell
  const handleExecuteSell = async () => {
    if (!sellModalHolding) return
    setSelling(true)
    try {
      const res = await sellStock(sellModalHolding.symbol, Number(sellQty))
      if (res.success) {
        toast.success(`Successfully sold ${sellQty} shares of ${sellModalHolding.symbol}!`)
        setSellModalHolding(null)
      } else {
        toast.error(res.message || 'Sell execution failed.')
      }
    } catch {
      toast.error('An error occurred while selling.')
    } finally {
      setSelling(false)
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Section: Total Value & CTAs */}
      <Reveal as="section" className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="mf-eyebrow mb-1.5">
            <ShinyText>Total Portfolio Value</ShinyText>
          </h1>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-[#F5F7FA] tracking-tight whitespace-nowrap">
              $<NumberTicker value={Number(analytics.portfolioValue || 0)} decimalPlaces={2} />
            </span>
            <span
              className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 ${
                isTotalPos
                  ? 'text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20'
                  : 'text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20'
              }`}
            >
              {isTotalPos ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {isTotalPos ? '+' : ''}
              {analytics.totalPnLPercent?.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 font-mono">
            {isTodayPos ? '+' : ''}
            {formatCurrency(analytics.todayPnL || 0)} Today
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-[#111318] border border-white/8 hover:bg-[#151820] text-[#F5F7FA] rounded-xl text-xs font-mono font-medium transition flex items-center gap-2 cursor-pointer shadow-sm hover:border-white/20"
          >
            <Download className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Export CSV</span>
          </button>
          <ParticleButton
            onClick={() => openTradeModal()}
            tone="blue"
            className="px-4 py-2 text-xs font-mono font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Trade</span>
          </ParticleButton>
        </div>
      </Reveal>

      {/* Bento Grid: 8 Cols Chart + 4 Cols Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Performance Chart */}
        <Reveal delay={0.05} className="lg:col-span-8 bg-[#111318]/95 rounded-2xl border border-white/8 p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden shadow-xl">
          <BorderBeam size={220} duration={8} colorFrom="#3B82F6" colorTo="#22C55E" />
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="mf-h2">
                Performance
              </h2>
              <div className="h-4 w-px bg-white/8"></div>
              <div className="flex items-center gap-3 text-xs text-[#9CA3AF] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                  Portfolio
                </span>
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-[#8A93A6]"></span>
                  S&amp;P 500
                </span>
              </div>
            </div>

            <div className="flex bg-[#151820] rounded-lg p-1 border border-white/8">
              {['1D', '1W', '1M', '3M', 'YTD', '1Y'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-xs font-mono transition cursor-pointer ${
                    range === r
                      ? 'bg-white/10 text-[#F5F7FA] font-medium shadow-sm'
                      : 'text-[#9CA3AF] hover:text-[#F5F7FA]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[260px] w-full">
            <TerminalLineChart
              data={history}
              color="#3B82F6"
              height={260}
              yAxisLabel="Value ($)"
              showGrid={true}
            />
          </div>
        </Reveal>

        {/* Right Column (4 cols): Insights Modules */}
        <Reveal delay={0.1} className="lg:col-span-4 flex flex-col gap-4">
          {/* Insight 1: Best Performer */}
          <SpotlightCard
            spotlightColor="rgba(34, 197, 94, 0.15)"
            tiltIntensity={4}
            className="bg-[#111318]/95 rounded-2xl border border-white/8 p-5 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                <span className="mf-label font-mono">
                  Best Performer
                </span>
              </div>
              <span className="text-xs font-mono bg-[#151820] px-2 py-0.5 rounded text-[#F5F7FA] border border-white/8">
                {bestPerformer ? bestPerformer.symbol : 'N/A'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#F5F7FA]">
                {bestPerformer ? `+${(bestPerformer.pnlPercent || 0).toFixed(1)}%` : '+0.0%'}
              </span>
              <span className="text-xs text-text-muted font-mono">unrealized return</span>
            </div>
            <p className="mt-2 text-xs text-[#9CA3AF] leading-relaxed">
              {bestPerformer
                ? `${bestPerformer.name || bestPerformer.symbol} leads total position returns with ${formatCurrency(bestPerformer.pnl || 0)} gains.`
                : 'Execute your first stock trade to start generating asset insights.'}
            </p>
          </SpotlightCard>

          {/* Insight 2: Largest Sector / Allocation */}
          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.15)"
            tiltIntensity={4}
            className="bg-[#111318]/95 rounded-2xl border border-white/8 p-5 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#3B82F6]" />
                <span className="mf-label font-mono">
                  Sector Weight
                </span>
              </div>
              <span className="text-xs font-mono bg-[#151820] px-2 py-0.5 rounded text-[#F5F7FA] border border-white/8">
                {sectorAllocation[0]?.name || 'Equities'}
              </span>
            </div>

            {/* Stacked Allocation Bar → shared sector donut (real data) */}
            <SectorAllocation
              items={sectorAllocation.slice(0, 3).map((sec) => ({
                label: sec.name,
                value: sec.value,
                display: `${sec.percentage.toFixed(1)}%`,
              }))}
              palette={SECTOR_THEMES.terminal}
              size={118}
              totalDisplay={formatCurrency(
                sectorAllocation.reduce((s, sec) => s + (sec.value || 0), 0)
              )}
              totalLabel="Invested"
              legendLimit={3}
              className="my-1"
            />

            <div className="flex justify-between items-baseline">
              <span className="text-lg font-bold font-mono text-[#F5F7FA]">
                {sectorAllocation[0]?.percentage ? `${sectorAllocation[0].percentage.toFixed(1)}%` : '100%'}
              </span>
              <span className="text-xs text-text-muted font-mono">
                {sectorAllocation[0]?.name || 'Portfolio'}
              </span>
            </div>
          </SpotlightCard>

          {/* Insight 3: Equity vs Cash mix (replaces the removed 3D torus —
              it rendered hardcoded dummy segments; this shows live data) */}
          <div className="bg-gradient-to-br from-[#111318] to-[#151820] rounded-2xl border border-[rgba(255,255,255,0.08)] p-5 flex flex-col justify-between relative overflow-hidden shadow-xl">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
                <span className="mf-label font-mono">
                  Asset Mix
                </span>
              </div>
              <span className="mf-badge text-[#22C55E]">Live</span>
            </div>
            <div
              className="w-full h-3 rounded-full overflow-hidden flex bg-white/[0.08]"
              role="img"
              aria-label={`Equity ${equityPct.toFixed(1)} percent, cash ${(100 - equityPct).toFixed(1)} percent`}
            >
              <div className="h-full bg-[#3B82F6]" style={{ width: `${equityPct}%` }} />
              <div className="h-full bg-[#22C55E]" style={{ width: `${100 - equityPct}%` }} />
            </div>
            <div className="mt-3 space-y-1.5 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-[#3B82F6]" />
                <span className="text-[#9CA3AF]">Equity</span>
                <span className="text-[#F5F7FA] font-bold ml-auto">{formatCurrency(equityValue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0 bg-[#22C55E]" />
                <span className="text-[#9CA3AF]">Cash</span>
                <span className="text-[#F5F7FA] font-bold ml-auto">{formatCurrency(cashValue)}</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Holdings Section & Table */}
      <Reveal delay={0.15} as="section" className="bg-[#111318] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
        <div className="p-5 border-b border-[rgba(255,255,255,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="mf-h2">
              Holdings &amp; Positions
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {holdings.length} active position{holdings.length === 1 ? '' : 's'} in portfolio
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search holdings..."
              className="w-full bg-[#151820] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6] transition placeholder-[#8A93A6]"
            />
          </div>
        </div>

        {/* Holdings Table */}
        {filteredHoldings.length === 0 ? (
          <div className="p-12 mf-empty">
            <p>No active stock positions found.</p>
            <Link
              to="/markets"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#3B82F6] hover:underline"
            >
              <span>Explore markets to buy stocks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs mf-num">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)] mf-label">
                  <th className="py-3 px-5">Symbol</th>
                  <th className="py-3 px-4 text-right">Shares</th>
                  <th className="py-3 px-4 text-right">Avg Price</th>
                  <th className="py-3 px-4 text-right">Current Price</th>
                  <th className="py-3 px-4 text-right">Invested</th>
                  <th className="py-3 px-4 text-right">Market Value</th>
                  <th className="py-3 px-4 text-right">Unrealized P&amp;L</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                {filteredHoldings.map((holding) => {
                  const isPos = (holding.pnl || 0) >= 0
                  return (
                    <tr
                      key={holding.symbol}
                      onClick={() => navigate(`/markets?stock=${holding.symbol}`)}
                      className="hover:bg-[#151820] transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-[rgba(255,255,255,0.08)] flex items-center justify-center font-bold text-xs text-[#3B82F6]">
                            {holding.symbol[0]}
                          </div>
                          <div>
                            <span className="font-bold text-[#F5F7FA] group-hover:text-[#3B82F6] transition block">
                              {holding.symbol}
                            </span>
                            <span className="mf-meta block truncate max-w-[120px]">
                              {holding.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-[#F5F7FA]">
                        {holding.quantity}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-[#9CA3AF]">
                        ${Number(holding.avgBuyPrice || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-[#F5F7FA]">
                        ${Number(holding.currentPrice || 0).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-[#9CA3AF]">
                        {formatCurrency(holding.invested || 0)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-[#F5F7FA]">
                        {formatCurrency(holding.currentValue || 0)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-semibold ${
                            isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {formatCurrency(holding.pnl || 0)} ({isPos ? '+' : ''}
                          {Number(holding.pnlPercent || 0).toFixed(2)}%)
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="cell-danger"
                          size="xs"
                          onClick={(e) => handleOpenSell(e, holding)}
                        >
                          Sell
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>

      {/* Position Liquidation Sell Modal */}
      {sellModalHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-[#151820]/95 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4 relative overflow-hidden">
            <BorderBeam size={180} duration={7} colorFrom="#EF4444" colorTo="#3B82F6" />
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <h3 className="text-sm font-bold text-[#F5F7FA]">
                Liquidate {sellModalHolding.symbol}
              </h3>
              <button
                onClick={() => setSellModalHolding(null)}
                className="text-[#9CA3AF] hover:text-[#F5F7FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Shares Owned</span>
                <span className="text-[#F5F7FA] font-bold">{sellModalHolding.quantity}</span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Market Price</span>
                <span className="text-[#F5F7FA]">${Number(sellModalHolding.currentPrice).toFixed(2)}</span>
              </div>

              <div>
                <label className="mf-input-label block mb-1">
                  Quantity to Sell
                </label>
                <QuantityStepper
                  value={sellQty}
                  onChange={(n) => setSellQty(n)}
                  min={1}
                  max={sellModalHolding.quantity}
                  className="w-full"
                />
              </div>

              <div className="p-3 bg-[#111318] rounded-lg border border-white/8 flex justify-between font-bold text-sm">
                <span className="text-[#F5F7FA]">Estimated Payout</span>
                <span className="text-[#22C55E]">
                  {formatCurrency((sellModalHolding.currentPrice || 0) * sellQty)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSellModalHolding(null)}
                className="flex-1 py-2.5 rounded-xl"
              >
                Cancel
              </Button>
              <ParticleButton
                type="button"
                onClick={handleExecuteSell}
                disabled={selling}
                tone="red"
                className="flex-1 py-2.5 text-xs font-bold font-mono"
              >
                {selling ? 'Selling...' : 'Confirm Sell'}
              </ParticleButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Portfolio() {
  return (
    <PortfolioErrorBoundary>
      <PortfolioContent />
    </PortfolioErrorBoundary>
  )
}
