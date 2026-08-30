import { useEffect, useMemo, useState } from 'react'
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
import {
  formatCompact,
  formatCurrency
} from '../utils/marketAnalytics'
import { ShimmerButton } from './magicui/ShimmerButton'
import { BorderBeam } from './magicui/BorderBeam'
import { NumberTicker } from './magicui/NumberTicker'
import { BuyButton } from './ui/BuyButton'
import { Button, Chip } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { QuantityStepper } from './ui/QuantityStepper'
import { PredictionPanel, PredictionBadge } from './ml/PredictionWidgets'
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
    startPolling,
    stopPolling,
    portfolio
  } = useTrade()

  const { currentUser, addToWatchlist, removeFromWatchlist } = useAuth()

  const [query, setQuery] = useState('')
  const [selectedSector, setSelectedSector] = useState('ALL')
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(null)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [range, setRange] = useState('1M')
  const [chartMode, setChartMode] = useState('line') // 'line' | 'candle'
  const [stockHistory, setStockHistory] = useState([])
  const [intradayHistory, setIntradayHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [submittingTrade, setSubmittingTrade] = useState(false)
  const [orderSide, setOrderSide] = useState('BUY') // 'BUY' | 'SELL'
  const [orderQuantity, setOrderQuantity] = useState(1)
  const [prediction, setPrediction] = useState(null)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [automationRule, setAutomationRule] = useState(null)
  const [predictionHorizon, setPredictionHorizon] = useState(1)
  const [predictionAccuracy, setPredictionAccuracy] = useState(null)

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
    startPolling()
    return () => stopPolling()
  }, [fetchStocks, fetchMarketSummary, startPolling, stopPolling])

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
  useEffect(() => {
    if (!selectedStock?.symbol) return
    let cancelled = false
    setHistoryLoading(true)
    const isIntraday = range === '1D'
    Promise.all([
      fetchHistory(selectedStock.symbol, 'ALL'),
      isIntraday ? fetchHistory(selectedStock.symbol, '1D') : Promise.resolve(null)
    ]).then(([daily, intraday]) => {
      if (cancelled) return
      setStockHistory(daily.data || [])
      setIntradayHistory(isIntraday && intraday ? (intraday.data || []) : [])
      setHistoryLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedStock?.symbol, range, fetchHistory])

  // Slice history by range. No synthetic fallback: empty data renders "no chart" state.
  const chartData = useMemo(() => {
    const source = range === '1D' ? intradayHistory : stockHistory
    return sliceHistoryByRange(source, range)
  }, [stockHistory, intradayHistory, range])

  // Real 52-week high/low from the daily series (last 252 trading days).
  const week52 = useMemo(() => {
    const closes = stockHistory
      .filter(d => Number(d.close) > 0)
      .slice(-252)
      .map(d => Number(d.close))
    if (!closes.length) return null
    return { low: Math.min(...closes), high: Math.max(...closes) }
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

    setPendingOrder({
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      side: orderSide,
      quantity: Number(orderQuantity),
      price: stockPrice,
      total: estimatedTotal
    })
  }

  const handleConfirmOrder = async () => {
    if (!pendingOrder) return
    setSubmittingTrade(true)

    try {
      if (pendingOrder.side === 'BUY') {
        const res = await buyStock(pendingOrder.symbol, pendingOrder.quantity)
        if (res.success) {
          toast.success(`Successfully bought ${pendingOrder.quantity} shares of ${pendingOrder.symbol}!`)
          setPendingOrder(null)
          setOrderQuantity(1)
        } else {
          toast.error(res.message || 'Trade execution failed.')
        }
      } else {
        const res = await sellStock(pendingOrder.symbol, pendingOrder.quantity)
        if (res.success) {
          toast.success(`Successfully sold ${pendingOrder.quantity} shares of ${pendingOrder.symbol}!`)
          setPendingOrder(null)
          setOrderQuantity(1)
        } else {
          toast.error(res.message || 'Trade execution failed.')
        }
      }
    } catch {
      toast.error('An error occurred during trade execution.')
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
    <div className="flex-1 overflow-hidden flex flex-col h-[calc(100vh-56px)] bg-[#09090B] animate-fade-in">
      {/* Workspace 3-Column Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row p-4 sm:p-6 gap-6">
        {/* Left Column: Stock Discovery & Watchlist */}
        <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0 bg-[#09090B] border-r border-[rgba(255,255,255,0.08)] pr-4 lg:pr-2 pb-4 lg:pb-0 overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F7FA]">
              Markets
            </h2>
            <span className="text-[11px] font-mono text-[#667085]">
              {filteredStocks.length} listed
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker, name..."
              className="w-full bg-[#111318] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6] transition placeholder-[#667085]"
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
                      ? 'bg-[#151820] border-[#3B82F6]/50 shadow-sm'
                      : 'bg-[#111318] border-[rgba(255,255,255,0.06)] hover:bg-[#151820] hover:border-[rgba(255,255,255,0.12)]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1c1b1d] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-bold text-xs text-[#3B82F6]">
                        {stock.symbol[0]}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-[#F5F7FA] block truncate">
                          {stock.symbol}
                        </span>
                        <span className="text-[11px] text-[#667085] block truncate max-w-[100px]">
                          {stock.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-[#F5F7FA] block">
                        ${Number(stock.price).toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-medium block ${
                          isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
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
        </aside>

        {/* Center Column: Stock Detail & Chart */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#111318] rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
          {selectedStock ? (
            <>
              {/* Stock Header */}
              <div className="p-5 sm:p-6 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-start">
                <div className="flex gap-4 items-center min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#151820] border border-[rgba(255,255,255,0.1)] flex items-center justify-center font-mono text-lg font-bold text-[#3B82F6] shrink-0">
                    {selectedStock.symbol[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl sm:text-2xl font-bold font-mono text-[#F5F7FA] leading-none m-0">
                        {selectedStock.symbol}
                      </h2>
                      <button
                        onClick={(e) => handleToggleWatchlist(e, selectedStock.symbol)}
                        className="text-[#9CA3AF] hover:text-[#F5F7FA] transition"
                        title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            isWatchlisted ? 'fill-[#F59E0B] text-[#F59E0B]' : ''
                          }`}
                        />
                      </button>
                      {!predictionLoading && prediction?.ok && (
                        <PredictionBadge prediction={prediction} compact />
                      )}
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-1.5 flex items-center gap-2">
                      <span className="truncate">{selectedStock.name}</span>
                      <span>•</span>
                      <span className="text-[#667085] font-mono">{selectedStock.sector || 'US Equity'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-[#F5F7FA]">
                    <NumberTicker value={Number(selectedStock.price)} decimalPlaces={2} prefix="$" />
                  </div>
                  <div
                    className={`text-xs font-mono font-semibold flex items-center justify-end gap-1 mt-1 ${
                      isPosChange ? 'text-[#22C55E]' : 'text-[#EF4444]'
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
                <BorderBeam size={200} duration={10} colorFrom="#3B82F6" colorTo="#22C55E" />
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
                <div className="flex-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0e0e10]/80 p-3 relative overflow-hidden flex flex-col justify-center min-h-[260px]">
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-full text-xs font-mono text-[#3B82F6] animate-pulse">
                      Loading market price history...
                    </div>
                  ) : chartMode === 'candle' ? (
                    <CandleChart data={chartData} height={250} />
                  ) : (
                    <TerminalLineChart
                      data={chartData}
                      color="#3B82F6"
                      height={250}
                      yAxisLabel="Price ($)"
                      showGrid={true}
                    />
                  )}
                </div>
              </div>

              {/* Key Metrics Bento Grid */}
              <div className="p-5 sm:p-6 border-t border-[rgba(255,255,255,0.08)] grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#0e0e10]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-[#667085]">Volume</span>
                  <span className="text-xs font-mono font-semibold text-[#F5F7FA]">
                    {selectedStock.volume ? formatCompact(selectedStock.volume) : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-[#667085]">Market Cap</span>
                  <span className="text-xs font-mono font-semibold text-[#F5F7FA]">
                    {selectedStock.marketCap
                      ? formatCompact(selectedStock.marketCap)
                      : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-[#667085]">52W Range</span>
                  <span className="text-xs font-mono font-semibold text-[#F5F7FA]">
                    {week52
                      ? `$${week52.low.toFixed(2)} - $${week52.high.toFixed(2)}`
                      : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5 border-l pl-4 border-[rgba(255,255,255,0.08)]">
                  <span className="text-[10px] font-mono uppercase text-[#3B82F6]">Your Position</span>
                  <span className="text-xs font-mono font-semibold text-[#F5F7FA]">
                    {currentHolding ? `${currentHolding.quantity} shares` : '0 shares'}
                  </span>
                  {currentHolding && (
                    <span className="text-[10px] text-[#667085] font-mono">
                      Avg ${Number(currentHolding.avgBuyPrice || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#667085]">
              Select a stock to view details
            </div>
          )}
        </section>

        {/* Right Column: AI + Trade Ticket */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4 h-fit max-h-full overflow-y-auto">
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

          <div className="bg-[#111318] rounded-xl border border-[rgba(255,255,255,0.08)] p-5 sm:p-6 flex flex-col">
          <h3 className="text-sm font-semibold text-[#F5F7FA] mb-5">
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
                pillClass: 'bg-[#22C55E] shadow-[0_2px_10px_rgba(34,197,94,0.35)]',
                activeClass: 'text-black font-bold'
              },
              {
                value: 'SELL',
                label: 'Sell',
                pillClass: 'bg-[#EF4444] shadow-[0_2px_10px_rgba(239,68,68,0.35)]',
                activeClass: 'text-white font-bold'
              }
            ]}
          />

          <form onSubmit={handleInitiateOrder} className="space-y-4">
            {/* Quantity Input with Controls */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] text-[#9CA3AF] font-mono">Quantity</label>
                <span className="text-[10px] text-[#667085] font-mono">
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
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Share Price</span>
                <span className="text-[#F5F7FA]">${Number(stockPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Estimated Total</span>
                <span className="text-sm font-bold text-[#F5F7FA]">
                  {formatCurrency(estimatedTotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#667085] text-[11px] pt-1">
                <span>Available Cash</span>
                <span className="text-[#9CA3AF]">{formatCurrency(userBalance)}</span>
              </div>
            </div>

            {orderSide === 'BUY' ? (
              <BuyButton
                label={`Buy ${orderQuantity} ${selectedStock?.symbol || ''}`}
                disabled={submittingTrade || estimatedTotal > userBalance || !selectedStock}
                className="w-full py-3 text-xs font-bold"
                onClick={async () => {
                  if (!selectedStock) return { success: false }
                  if (orderQuantity <= 0 || !Number.isInteger(Number(orderQuantity))) {
                    toast.error('Please enter a valid quantity of whole shares.')
                    return { success: false }
                  }
                  if (estimatedTotal > userBalance) {
                    toast.error(`Insufficient funds. Need ${formatCurrency(estimatedTotal)}, you have ${formatCurrency(userBalance)}.`)
                    return { success: false }
                  }
                  setPendingOrder({
                    symbol: selectedStock.symbol,
                    name: selectedStock.name,
                    side: 'BUY',
                    quantity: Number(orderQuantity),
                    price: stockPrice,
                    total: estimatedTotal
                  })
                  return { success: true }
                }}
              />
            ) : (
              <ShimmerButton
                type="submit"
                disabled={submittingTrade}
                background="#EF4444"
                className="w-full py-3 text-xs font-bold font-mono text-black"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {`Sell ${orderQuantity} ${selectedStock?.symbol}`}
                </span>
              </ShimmerButton>
            )}
          </form>
          </div>
        </aside>
      </div>

      {/* Order Confirmation Modal */}
      {pendingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#151820]/95 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
            <BorderBeam size={200} duration={8} colorFrom={pendingOrder.side === 'BUY' ? '#22C55E' : '#EF4444'} colorTo="#3B82F6" />
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="text-base font-semibold text-[#F5F7FA]">
                  Confirm Order
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                  pendingOrder.side === 'BUY'
                    ? 'bg-[#22C55E]/10 text-[#22C55E]'
                    : 'bg-[#EF4444]/10 text-[#EF4444]'
                }`}
              >
                {pendingOrder.side}
              </span>
            </div>

            <div className="space-y-3 bg-[#111318] p-4 rounded-xl border border-[rgba(255,255,255,0.06)] text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Symbol</span>
                <span className="text-[#F5F7FA] font-bold">{pendingOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Action</span>
                <span className={pendingOrder.side === 'BUY' ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                  {pendingOrder.side}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Quantity</span>
                <span className="text-[#F5F7FA]">{pendingOrder.quantity} shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Execution Price</span>
                <span className="text-[#F5F7FA]">${Number(pendingOrder.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[rgba(255,255,255,0.08)] font-bold text-sm">
                <span className="text-[#F5F7FA]">Total Value</span>
                <span className="text-[#3B82F6]">{formatCurrency(pendingOrder.total)}</span>
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
