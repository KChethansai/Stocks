import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  Star,
  ArrowUp,
  PlusCircle
} from 'lucide-react'
import { useTrade } from '../store/tradeStore'
import { useAuth } from '../store/authStore'
import { Sparkline } from './TerminalCharts'
import { ShimmerButton } from './magicui/ShimmerButton'
import { ShinyText } from './reactbits/ShinyText'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import toast from 'react-hot-toast'

export default function Watchlist() {
  const { stocks, fetchStocks, fetchSparkline, startPolling, stopPolling } = useTrade()
  const { currentUser, removeFromWatchlist } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('ALL') // 'ALL' | 'TECH' | 'FINANCE'
  const [sortKey, setSortKey] = useState('symbol')
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
  const [sparks, setSparks] = useState({})

  useEffect(() => {
    fetchStocks()
    startPolling()
    return () => stopPolling()
  }, [fetchStocks, startPolling, stopPolling])

  // Real last-30d close sparklines for each visible symbol (cached in store)
  const sparkSymbols = useMemo(() => {
    const symbols = currentUser?.watchlist || []
    return (symbols.length ? symbols : stocks.slice(0, 6)).filter(Boolean)
  }, [currentUser?.watchlist, stocks])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      sparkSymbols.map((s) =>
        fetchSparkline(typeof s === 'string' ? s : s.symbol)
          .then((res) => [s, res.data || []])
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return
      const next = {}
      results.filter(Boolean).forEach(([s, data]) => {
        next[typeof s === 'string' ? s : s.symbol] = data
      })
      setSparks(next)
    })
    return () => {
      cancelled = true
    }
  }, [sparkSymbols, fetchSparkline])

  // Get user watchlist items or default stocks if empty
  const watchlistStocks = useMemo(() => {
    const symbols = currentUser?.watchlist || []
    if (symbols.length === 0) {
      return stocks.slice(0, 6)
    }
    return symbols
      .map((sym) => stocks.find((s) => s.symbol === sym))
      .filter(Boolean)
  }, [currentUser?.watchlist, stocks])

  // Filter and sort watchlist
  const filteredWatchlist = useMemo(() => {
    let list = [...watchlistStocks]
    if (query.trim()) {
      const q = query.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector?.toLowerCase().includes(q)
      )
    }

    if (selectedFilter !== 'ALL') {
      list = list.filter((s) => s.sector?.toUpperCase() === selectedFilter)
    }

    list.sort((a, b) => {
      let valA = a[sortKey]
      let valB = b[sortKey]
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }
      valA = Number(valA || 0)
      valB = Number(valB || 0)
      return sortOrder === 'asc' ? valA - valB : valB - valA
    })

    return list
  }, [watchlistStocks, query, selectedFilter, sortKey, sortOrder])

  // Top mover
  const topMover = useMemo(() => {
    if (watchlistStocks.length === 0) return null
    return [...watchlistStocks].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0]
  }, [watchlistStocks])

  const handleRemove = async (e, symbol) => {
    e.stopPropagation()
    const res = await removeFromWatchlist(symbol)
    if (res.success) {
      toast.success(`Removed ${symbol} from watchlist`)
    } else {
      toast.error(res.message || 'Failed to remove')
    }
  }

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header Summary (Stitch Layout) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-[#F5F7FA] mb-3">
            <ShinyText>My Watchlist</ShinyText>
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#667085] uppercase tracking-wider">
                Tracked Assets
              </span>
              <span className="text-[#F5F7FA] font-bold">
                {watchlistStocks.length}
              </span>
            </div>

            <div className="h-4 w-px bg-[rgba(255,255,255,0.08)]"></div>

            {topMover && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#667085] uppercase tracking-wider">
                  Top Mover (24h)
                </span>
                <span className="text-[#F5F7FA] font-bold">
                  {topMover.symbol}
                </span>
                <span className="text-[#22C55E] bg-[#22C55E]/10 px-1.5 py-0.5 rounded font-semibold">
                  +{topMover.changePercent?.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action / Search / Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbols..."
              className="w-full bg-[#111318] border border-[rgba(255,255,255,0.08)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6] transition placeholder-[#667085]"
            />
          </div>

          <SegmentedControl
            value={selectedFilter}
            onChange={setSelectedFilter}
            ariaLabel="Watchlist filter"
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'TECHNOLOGY', label: 'Tech' },
              { value: 'FINANCIAL SERVICES', label: 'Finance' }
            ]}
          />

          <ShimmerButton
            onClick={() => navigate('/markets')}
            background="#3B82F6"
            className="px-4 py-2 text-xs font-mono font-medium"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Discover Stocks</span>
          </ShimmerButton>
        </div>
      </div>

      {/* High Density Stock Table */}
      <div className="bg-[#111318] rounded-xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] text-[10px] uppercase text-[#667085] tracking-wider bg-[#0e0e10]/50">
                <th className="py-3 px-5 cursor-pointer hover:text-[#F5F7FA]" onClick={() => toggleSort('symbol')}>
                  <span className="flex items-center gap-1">
                    Ticker <ArrowUp className="w-3 h-3" />
                  </span>
                </th>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-[#F5F7FA]" onClick={() => toggleSort('price')}>
                  Price
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-[#F5F7FA]" onClick={() => toggleSort('change')}>
                  $ Change
                </th>
                <th className="py-3 px-4 text-right cursor-pointer hover:text-[#F5F7FA]" onClick={() => toggleSort('changePercent')}>
                  % Change
                </th>
                <th className="py-3 px-4 text-center">24H Trend</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {filteredWatchlist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                    No tracked symbols found in watchlist.
                  </td>
                </tr>
              ) : (
                filteredWatchlist.map((stock) => {
                  const isPos = (stock.changePercent || 0) >= 0
                  const spark = sparks[stock.symbol] || []
                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => navigate(`/markets?stock=${stock.symbol}`)}
                      className="hover:bg-[#151820] transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => handleRemove(e, stock.symbol)}
                            className="text-[#F59E0B] hover:text-[#EF4444] transition cursor-pointer"
                            title="Remove from watchlist"
                          >
                            <Star className="w-4 h-4 fill-[#F59E0B]" />
                          </button>
                          <span className="font-bold text-sm text-[#F5F7FA] group-hover:text-[#3B82F6] transition">
                            {stock.symbol}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#9CA3AF] truncate max-w-[200px]">
                        {stock.name}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-[#F5F7FA]">
                        ${Number(stock.price).toFixed(2)}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-semibold ${
                          isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        ${Number(stock.change || 0).toFixed(2)}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-semibold ${
                          isPos ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {stock.changePercent?.toFixed(2)}%
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center">
                          <Sparkline
                            data={spark}
                            color={isPos ? '#22C55E' : '#EF4444'}
                            width={90}
                            height={22}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="cell"
                          size="xs"
                          onClick={() => navigate(`/markets?stock=${stock.symbol}`)}
                        >
                          Trade
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
