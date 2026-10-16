import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import toast from 'react-hot-toast'
import {
  Search,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  CandlestickChart as CandleIcon,
  LineChart as LineIcon,
  CheckCircle2,
  Zap
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { useTrade } from '../store/tradeStore'
import {
  CandleChart,
  TerminalLineChart,
  sliceHistoryByRange
} from './TerminalCharts'
import { priceDomain } from './charts/market-charts'
import {
  formatCompact,
  formatCurrency
} from '../utils/marketAnalytics'
import { ParticleButton } from './kokonutui/ParticleButton'
import { LiveValue } from './LiveValue'
import { Button, Chip } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import Reveal from './ui/Reveal'
import { QuantityStepper } from './ui/QuantityStepper'
import { PredictionPanel, PredictionBadge } from './ml/PredictionWidgets'
import PriceAlertsPanel from './PriceAlertsPanel'
import {
  fetchAccuracy,
  fetchPrediction,
  fetchAutomationRules,
  saveAutomationRule,
  patchAutomationRule
} from './ml/predictionApi'

export default function Market() {
  const location = useLocation()
  const {
    stocks,
    fetchStocks,
    fetchMarketSummary,
    buyStock,
    sellStock,
    fetchHistory,
    fetchPortfolio,
    startPolling,
    stopPolling,
    portfolio
  } = useTrade()

  const { currentUser, addToWatchlist, removeFromWatchlist } = useAuth()

  const [query, setQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState('ALL')
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(null)
  const [pendingOrder, setPendingOrder] = useState(null)
  const confirmBtnRef = useRef(null)
  const [range, setRange] = useState('1M')
  const [chartMode, setChartMode] = useState('line') // 'line' | 'candle'
  const [stockHistory, setStockHistory] = useState([])
  const [intradayHistory, setIntradayHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(false)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [submittingTrade, setSubmittingTrade] = useState(false)
  const [orderSide, setOrderSide] = useState('BUY') // 'BUY' | 'SELL'
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [prediction, setPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [automationRule, setAutomationRule] = useState(null)
  const [predictionHorizon, setPredictionHorizon] = useState(1)
  const [predictionAccuracy, setPredictionAccuracy] = useState(null)

  // Confirm dialog keyboard contract: Escape cancels (unless executing),
  // focus lands on Confirm when the dialog opens.
  useEffect(() => {
    if (pendingOrder) confirmBtnRef.current?.focus()
  }, [pendingOrder])
  useEffect(() => {
    if (!pendingOrder) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !submittingTrade) setPendingOrder(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingOrder, submittingTrade])

  // Check URL query parameters for ?stock=SYMBOL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const stockParam = params.get('stock')
    if (stockParam) {
      setSelectedStockSymbol(stockParam.toUpperCase())
    }
  }, [location.search])

  useEffect(() => {
    fetchStocks()
    fetchMarketSummary()
    // Holdings power the ticket's position/sell state; without this the
    // store has no portfolio on this route and buys never refresh it.
    fetchPortfolio()
    startPolling()
    return () => stopPolling()
  }, [fetchStocks, fetchMarketSummary, fetchPortfolio, startPolling, stopPolling])

  // Extract unique sectors
  const sectors = useMemo(() => {
    const set = new Set(['ALL'])
    stocks.forEach((s) => {
      if (s.sector) set.add(s.sector)
    })
    return Array.from(set)
  }, [stocks])

  // Filter stocks list
  const filteredStocks = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return stocks.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.symbol.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized) ||
        item.sector?.toLowerCase().includes(normalized)
      const matchesSector =
        selectedSector === 'ALL' || item.sector === selectedSector
      return matchesQuery && matchesSector
    })
  }, [stocks, query, selectedSector])

  // Active selected stock
  const selectedStock = useMemo(() => {
    if (selectedStockSymbol) {
      const match = stocks.find((s) => s.symbol === selectedStockSymbol)
      if (match) return match
    }
    return filteredStocks[0] || stocks[0] || null
  }, [selectedStockSymbol, filteredStocks, stocks])

  // Fetch real OHLC history when selected stock changes.
  // Daily series always (26-range + 52W metric); intraday series for the 1D view.
  // Failures are recorded (not swallowed) so the chart shows failed, not empty.
  useEffect(() => {
    if (!selectedStock?.symbol) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(false)
    const isIntraday = range === '1D'
    Promise.all([
      fetchHistory(selectedStock.symbol, 'ALL'),
      isIntraday ? fetchHistory(selectedStock.symbol, '1D') : Promise.resolve(null)
    ]).then(([daily, intraday]) => {
      if (cancelled) return
      if (daily && daily.success === false) setHistoryError(true)
      if (isIntraday && intraday && intraday.success === false) setHistoryError(true)
      setStockHistory(daily?.data || [])
      setIntradayHistory(isIntraday && intraday ? (intraday.data || []) : [])
      setHistoryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedStock?.symbol, range, fetchHistory, historyAttempt])

  // Slice history by range. No synthetic fallback: empty data renders "no chart" state.
  const chartData = useMemo(() => {
    const source = range === '1D' ? intradayHistory : stockHistory
    return sliceHistoryByRange(source, range)
  }, [stockHistory, intradayHistory, range])

  // D1 compressed-scale caption: tiny visible ranges snap to mid ±0.5% in the
  // domain helpers — say so instead of rendering a misleading flat axis.
  const compressedScale = useMemo(() => {
    const closes = (chartData || []).map((d) => Number(d.close ?? d.price)).filter(Number.isFinite)
    if (closes.length < 2) return false
    return priceDomain(closes).compressed
  }, [chartData])

  // 52-week high/low from OHLC highs/lows (last 252 trading days).
  // Closes alone understate the true range — highs/lows are authoritative.
  const week52 = useMemo(() => {
    const bars = stockHistory.filter(d => Number(d.close) > 0).slice(-252)
    if (!bars.length) return null
    const highs = bars.map(d => Number(d.high ?? d.close)).filter(Number.isFinite)
    const lows = bars.map(d => Number(d.low ?? d.close)).filter(Number.isFinite)
    if (!highs.length || !lows.length) return null
    return { low: Math.min(...lows), high: Math.max(...highs) }
  }, [stockHistory])

  // Holding info for selected stock
  const currentHolding = useMemo(() => {
    if (!portfolio?.holdings || !selectedStock) return null
    return portfolio.holdings.find((h) => h.symbol === selectedStock.symbol)
  }, [portfolio, selectedStock])

  // ML prediction + automation rule for selected symbol
  useEffect(() => {
    if (!selectedStock?.symbol) return
    let cancelled = false
    setPredictionLoading(true)
    setPrediction(null)

    Promise.all([
      fetchPrediction(selectedStock.symbol, predictionHorizon).catch(() => null),
      fetchAutomationRules().catch(() => []),
      fetchAccuracy(selectedStock.symbol).catch(() => null)
    ]).then(([pred, rules, accuracy]) => {
      if (cancelled) return
      setPrediction(pred)
      setAutomationRule((rules || []).find((r) => r.symbol === selectedStock.symbol) || null)
      setPredictionAccuracy(accuracy)
      setPredictionLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [selectedStock?.symbol, predictionHorizon])

  const handleSaveAutomation = async (payload) => {
    try {
      const rule = await saveAutomationRule(payload)
      setAutomationRule(rule)
      toast.success(`Automation enabled for ${payload.symbol}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save automation')
    }
  }

  const handleToggleAutomation = async (symbol, enabled) => {
    try {
      const rule = await patchAutomationRule(symbol, { enabled })
      setAutomationRule(rule)
      toast.success(enabled ? 'Automation enabled' : 'Automation disabled')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update automation')
    }
  }

  const userBalance = currentUser?.balance ?? 100000
  const stockPrice = selectedStock?.price || 0
  const estimatedTotal = (stockPrice * orderQuantity)

  // Watchlist status
  const isWatchlisted = useMemo(() => {
    if (!currentUser?.watchlist || !selectedStock) return false
    return currentUser.watchlist.includes(selectedStock.symbol)
  }, [currentUser, selectedStock])

  const handleToggleWatchlist = async (e, symbol) => {
    e.stopPropagation()
    const target = symbol || selectedStock?.symbol
    if (!target) return

    const inList = currentUser?.watchlist?.includes(target)
    if (inList) {
      const res = await removeFromWatchlist(target)
      if (res.success) toast.success(`Removed ${target} from watchlist`)
      else toast.error(res.message || 'Error updating watchlist')
    } else {
      const res = await addToWatchlist(target)
      if (res.success) toast.success(`Added ${target} to watchlist`)
      else toast.error(res.message || 'Error updating watchlist')
    }
  }

  // Handle Trade Execution
  const handleInitiateOrder = (e) => {
    e.preventDefault()
    if (!selectedStock) return

    // Provenance gate mirrors the server: unverified/stale quotes never
    // reach review, let alone execution.
    if (!selectedStock.lastVerifiedAt || (selectedStock.source && selectedStock.source !== 'yahoo')) {
      toast.error('Quote unverified — refresh market data and retry.')
      return
    }
    if (selectedStock.stale) {
      toast.error('Quote is stale — refresh market data and retry.')
      return
    }

    if (orderQuantity <= 0 || !Number.isInteger(Number(orderQuantity))) {
      toast.error('Please enter a valid quantity of whole shares.')
      return
    }

    if (orderSide === 'BUY') {
      if (estimatedTotal > userBalance) {
        toast.error(`Insufficient funds. Need ${formatCurrency(estimatedTotal)}, you have ${formatCurrency(userBalance)}.`)
        return
      }
    } else {
      const owned = currentHolding?.quantity || 0
      if (orderQuantity > owned) {
        toast.error(`Cannot sell ${orderQuantity} shares. You currently own ${owned} shares.`)
        return
      }
    }

    // Stable idempotency key per draft: retries of the same review reuse the
    // key (safe retry → original receipt); a new draft gets a new key.
    setPendingOrder({
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      side: orderSide,
      quantity: Number(orderQuantity),
      price: stockPrice,
      total: estimatedTotal,
      idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    })
  }

  const handleConfirmOrder = async () => {
    if (!pendingOrder || submittingTrade) return
    setSubmittingTrade(true)

    try {
      const res = pendingOrder.side === 'BUY'
        ? await buyStock(pendingOrder.symbol, pendingOrder.quantity, pendingOrder.idempotencyKey)
        : await sellStock(pendingOrder.symbol, pendingOrder.quantity, pendingOrder.idempotencyKey)
      if (res.success) {
        const tx = res.transaction || res.receipt
        toast.success(tx
          ? `${tx.type === 'SELL' ? 'Sold' : 'Bought'} ${tx.quantity} ${tx.symbol} at ${formatCurrency(tx.price)}`
          : `${pendingOrder.side === 'BUY' ? 'Bought' : 'Sold'} ${pendingOrder.quantity} shares of ${pendingOrder.symbol}`)
        setPendingOrder(null)
        setOrderQuantity(1)
      } else {
        // Keep the draft open on failure so a retry reuses the same key.
        toast.error(res.message || 'Trade execution failed. Review and retry — the same order key is reused.')
      }
    } catch {
      toast.error('An error occurred during trade execution. Retry reuses the same order key.')
    } finally {
      setSubmittingTrade(false)
    }
  }

  const handleQuickPercent = (pct) => {
    if (!stockPrice || stockPrice <= 0) return
    if (orderSide === 'BUY') {
      const maxAffordable = Math.floor((userBalance * pct) / stockPrice)
      setOrderQuantity(Math.max(1, maxAffordable))
    } else {
      const owned = currentHolding?.quantity || 0
      const target = Math.floor(owned * pct)
      setOrderQuantity(Math.max(1, target))
    }
  }

  const isPosChange = (selectedStock?.changePercent || 0) >= 0

  return (
    <div className="flex-1 flex flex-col overflow-visible xl:overflow-hidden h-auto min-h-[calc(100vh-56px)] xl:h-[calc(100vh-56px)] bg-[#0B0C0E] animate-fade-in">
      {/* Workspace 3-Column Layout (3-col only at xl: rails don't fit at 1024) */}
      <div className="flex-1 flex flex-col xl:flex-row p-4 sm:p-6 gap-6 overflow-visible xl:overflow-hidden">
        {/* Left Column: Stock Discovery & Watchlist */}
        <Reveal as="aside" className="w-full xl:w-72 flex flex-col gap-4 shrink-0 bg-[#0B0C0E] border-r border-[rgba(255,255,255,0.08)] pr-4 xl:pr-2 pb-4 xl:pb-0 overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ivory)]">
              Markets
            </h2>
            <span className="mf-meta font-mono text-text-muted">
              {filteredStocks.length} listed
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker, name..."
              className="w-full bg-[#111316] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[var(--ivory)] focus:outline-none focus:border-[var(--brass)] transition placeholder-[var(--stone-muted)]"
            />
          </div>

          {/* Sector Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {sectors.slice(0, 5).map((sec) => (
              <Chip
                key={sec}
                active={selectedSector === sec}
                onClick={() => setSelectedSector(sec)}
                className="whitespace-nowrap px-2.5 py-1 text-[11px]"
              >
                {sec}
              </Chip>
            ))}
          </div>

          {/* Stock List */}
          <div className="flex flex-col gap-1.5 flex-1">
            {filteredStocks.map((stock) => {
              const isSelected = selectedStock?.symbol === stock.symbol
              const isPos = stock.changePercent >= 0
              return (
                <div
                  key={stock.symbol}
                  onClick={() => setSelectedStockSymbol(stock.symbol)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-[#181B1F] border-[var(--brass)]/50 shadow-sm'
                      : 'bg-[#111316] border-[rgba(255,255,255,0.06)] hover:bg-[#181B1F] hover:border-[rgba(255,255,255,0.12)]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-bold text-xs text-[var(--brass)]">
                        {stock.symbol[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-[var(--ivory)] block truncate">
                          {stock.symbol}
                        </span>
                        <span className="mf-meta block truncate max-w-[100px]">
                          {stock.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-[var(--ivory)] block">
                        ${Number(stock.price).toFixed(2)}
                      </span>
                      <span
                        className={`mf-num text-xs font-medium block ${
                          isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {stock.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>

        {/* Center Column: Stock Detail & Chart */}
        <Reveal as="section" delay={0.05} className="flex-1 flex flex-col min-w-0 bg-[#111316] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden shadow-xl">
          {selectedStock ? (
            <>
              {/* Stock Header */}
              <div className="p-5 sm:p-6 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-start">
                <div className="flex gap-4 items-center min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#181B1F] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-mono text-lg font-bold text-[var(--brass)] shrink-0">
                    {selectedStock.symbol[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-xl sm:text-2xl font-bold font-mono text-[var(--ivory)] leading-none m-0">
                        {selectedStock.symbol}
                      </h2>
                      <button
                        onClick={(e) => handleToggleWatchlist(e, selectedStock.symbol)}
                        className="text-[var(--stone)] hover:text-[var(--ivory)] transition"
                        title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            isWatchlisted ? 'fill-[#D9A441] text-[#D9A441]' : ''
                          }`}
                        />
                      </button>
                      {!predictionLoading && prediction?.ok && (
                        <PredictionBadge prediction={prediction} compact />
                      )}
                    </div>
                    <p className="text-xs text-[var(--stone-muted)] mt-1.5 flex items-center gap-2">
                      <span className="truncate">{selectedStock.name}</span>
                      <span>•</span>
                      <span className="text-text-muted font-mono">{selectedStock.sector || 'US Equity'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--ivory)] whitespace-nowrap">
                    <LiveValue value={Number(selectedStock.price ?? 0)} format={(v) => `$${Number(v).toFixed(2)}`} />
                  </div>
                  <div
                    className={`text-xs font-mono font-semibold flex items-center justify-end gap-1 mt-1 ${
                      isPosChange ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                    }`}
                  >
                    {isPosChange ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isPosChange ? '+' : ''}
                      {Number(selectedStock.change || 0).toFixed(2)} ({isPosChange ? '+' : ''}
                      {selectedStock.changePercent?.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart Controls & Canvas */}
              <div className="flex-1 relative p-5 sm:p-6 flex flex-col min-h-[320px]">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  {/* Candlestick vs Line Toggle */}
                  <SegmentedControl
                    value={chartMode}
                    onChange={setChartMode}
                    ariaLabel="Chart type"
                    options={[
                      { value: 'line', label: 'Line', icon: LineIcon },
                      { value: 'candle', label: 'Candles', icon: CandleIcon }
                    ]}
                  />

                  {/* Range Selectors */}
                  <SegmentedControl
                    value={range}
                    onChange={setRange}
                    ariaLabel="Chart range"
                    size="sm"
                    options={['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((r) => ({ value: r, label: r }))}
                  />
                </div>

                {/* Chart Area */}
                <div className="flex-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0B0C0E]/80 p-3 relative overflow-hidden flex flex-col justify-center min-h-[260px]">
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-full text-xs text-[var(--stone)]" role="status">
                      Loading market price history…
                    </div>
                  ) : chartMode === 'candle' ? (
                    <CandleChart
                      data={chartData}
                      height={250}
                      status={historyError ? 'failed' : undefined}
                      onRetry={() => setHistoryAttempt((n) => n + 1)}
                    />
                  ) : (
                    <TerminalLineChart
                      data={chartData}
                      label="Price chart"
                      color="#C9A96E"
                      height={250}
                      showGrid={true}
                      status={historyError ? 'failed' : undefined}
                      onRetry={() => setHistoryAttempt((n) => n + 1)}
                    />
                  )}
                </div>
                {compressedScale && !historyLoading && (
                  <p className="mf-meta mt-1.5">Compressed scale — price moved &lt;0.5% in view.</p>
                )}
              </div>

              {/* Key Metrics Bento Grid */}
              <div className="p-5 sm:p-6 border-t border-[rgba(255,255,255,0.08)] grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0B0C0E]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-text-muted">Volume (shares)</span>
                  <span className="text-xs font-mono font-semibold text-[var(--ivory)]">
                    {selectedStock.volume ? Number(selectedStock.volume).toLocaleString('en-US') : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-text-muted">Market Cap</span>
                  <span className="text-xs font-mono font-semibold text-[var(--ivory)]">
                    {selectedStock.marketCap
                      ? formatCompact(selectedStock.marketCap)
                      : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-text-muted">52W Range</span>
                  <span className="text-xs font-mono font-semibold text-[var(--ivory)]">
                    {week52
                      ? `$${week52.low.toFixed(2)} - $${week52.high.toFixed(2)}`
                      : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 border-l pl-4 border-[rgba(255,255,255,0.08)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--brass)]">Your Position</span>
                  <span className="text-xs font-mono font-semibold text-[var(--ivory)]">
                    {currentHolding ? `${currentHolding.quantity} shares` : '0 shares'}
                  </span>
                  {currentHolding && (
                <span className="mf-meta font-mono">
                      Avg ${Number(currentHolding.avgBuyPrice || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-text-muted">
              Select a stock to view details
            </div>
          )}
        </Reveal>

        {/* Right Column: AI + Trade Ticket */}
        <Reveal as="aside" delay={0.1} className="w-full xl:w-80 shrink-0 flex flex-col gap-4 h-fit max-h-full overflow-y-auto">
          {selectedStock && (
            <PredictionPanel
              symbol={selectedStock.symbol}
              prediction={prediction}
              loading={predictionLoading}
              automationRule={automationRule}
              onSaveAutomation={handleSaveAutomation}
              onToggleAutomation={handleToggleAutomation}
              horizon={predictionHorizon}
              onHorizonChange={setPredictionHorizon}
              accuracy={predictionAccuracy}
            />
          )}

          {selectedStock && (
            <PriceAlertsPanel symbol={selectedStock.symbol} currentPrice={selectedStock.price} />
          )}

          <div className="bg-[#111316] rounded-2xl border border-[rgba(255,255,255,0.08)] p-5 sm:p-6 flex flex-col shadow-xl">
          <h3 className="text-sm font-semibold text-[var(--ivory)] mb-5">
            Trade {selectedStock?.symbol || 'Stock'}
          </h3>

          {/* Buy / Sell Segmented Toggle */}
          <SegmentedControl
            value={orderSide}
            onChange={setOrderSide}
            ariaLabel="Order side"
            fullWidth
            className="mb-5"
            options={[
              {
                value: 'BUY',
                label: 'Buy',
                pillClass: 'bg-[var(--gain)] shadow-[0_2px_10px_rgba(79,178,134,.35)]',
                activeClass: 'text-black font-bold'
              },
              {
                value: 'SELL',
                label: 'Sell',
                pillClass: 'bg-[var(--loss)] shadow-[0_2px_10px_rgba(217,102,122,.35)]',
                activeClass: 'text-white font-bold'
              }
            ]}
          />

          <form onSubmit={handleInitiateOrder} className="space-y-4">
            {/* Quantity Input with Controls */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="mf-input-label font-mono">Quantity</label>
                <span className="mf-meta font-mono">
                  {orderSide === 'BUY'
                    ? `Max ~${Math.floor(userBalance / (stockPrice || 1))} shares`
                    : `Owned: ${currentHolding?.quantity || 0} shares`}
                </span>
              </div>

              <QuantityStepper
                value={orderQuantity}
                onChange={(n) => setOrderQuantity(n)}
                min={1}
                max={orderSide === 'BUY'
                  ? Math.max(1, Math.floor((userBalance || 0) / (stockPrice || 1)))
                  : Math.max(1, currentHolding?.quantity || 0)}
                className="w-full"
              />

              {/* Quick Percent Buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-2">
                {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                  <Chip
                    key={pct}
                    onClick={() => handleQuickPercent(pct)}
                    className="w-full py-1 text-[10px] text-center"
                  >
                    {pct === 1.0 ? 'MAX' : `${pct * 100}%`}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="py-3 border-y border-[rgba(255,255,255,0.08)] space-y-2 text-xs font-mono">
              <div className="flex justify-between text-[var(--stone-muted)]">
                <span>Share Price</span>
                <span className="text-[var(--ivory)]">${Number(stockPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--stone-muted)]">
                <span>Estimated Total</span>
                <span className="text-sm font-bold text-[var(--ivory)]">
                  {formatCurrency(estimatedTotal)}
                </span>
              </div>
              <div className="flex justify-between mf-meta pt-1">
                <span>Available Cash</span>
                <span className="text-[var(--stone-muted)]">{formatCurrency(userBalance)}</span>
              </div>
            </div>

            {orderSide === 'BUY' ? (
              <Button
                variant="primary"
                type="submit"
                disabled={submittingTrade || estimatedTotal > userBalance || !selectedStock}
                className="w-full py-3 text-xs font-bold"
                onClick={handleInitiateOrder}
              >
                {`Review buy ${orderQuantity} ${selectedStock?.symbol || ''}`}
              </Button>
            ) : (
              <ParticleButton
                type="submit"
                disabled={submittingTrade}
                tone="red"
                className="w-full py-3 text-xs font-bold font-mono"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {`Sell ${orderQuantity} ${selectedStock?.symbol}`}
                </span>
              </ParticleButton>
            )}
          </form>
          </div>
        </Reveal>
      </div>

      {/* Order Confirmation Modal */}
      {pendingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm ${pendingOrder.side} order for ${pendingOrder.symbol}`}
        >
          <div className="w-full max-w-md bg-[#181B1F]/95 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--stone)]" />
                <h3 className="mf-h2">
                  Confirm Order
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                  pendingOrder.side === 'BUY'
                    ? 'bg-[rgba(79,178,134,.12)] text-[var(--gain)]'
                    : 'bg-[rgba(217,102,122,.12)] text-[var(--loss)]'
                }`}
              >
                {pendingOrder.side}
              </span>
            </div>

            <div className="space-y-3 bg-[#111316] p-4 rounded-xl border border-[rgba(255,255,255,0.06)] text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--stone-muted)]">Symbol</span>
                <span className="text-[var(--ivory)] font-bold">{pendingOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--stone-muted)]">Action</span>
                <span className={pendingOrder.side === 'BUY' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>
                  {pendingOrder.side}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--stone-muted)]">Quantity</span>
                <span className="text-[var(--ivory)]">{pendingOrder.quantity} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--stone-muted)]">Execution Price</span>
                <span className="text-[var(--ivory)]">${Number(pendingOrder.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[rgba(255,255,255,0.08)] font-bold text-sm">
                <span className="text-[var(--ivory)]">Total Value</span>
                <span className="text-[var(--brass)]">{formatCurrency(pendingOrder.total)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setPendingOrder(null)}
                disabled={submittingTrade}
                className="flex-1 py-2.5"
              >
                Cancel
              </Button>
              <Button
                variant={pendingOrder.side === 'BUY' ? 'success' : 'danger'}
                onClick={handleConfirmOrder}
                disabled={submittingTrade}
                className="flex-1 py-2.5"
                ref={confirmBtnRef}
              >
                {submittingTrade ? 'Executing...' : 'Confirm Execution'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
