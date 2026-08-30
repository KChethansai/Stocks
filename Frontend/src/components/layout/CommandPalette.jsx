import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Bookmark,
  Briefcase,
  BarChart3,
  History,
  User,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  X
} from 'lucide-react'
import { useTrade } from '../../store/tradeStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import { BorderBeam } from '../magicui/BorderBeam'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Navigation' },
  { label: 'Markets & Trading', path: '/markets', icon: TrendingUp, category: 'Navigation' },
  { label: 'Watchlist', path: '/watchlist', icon: Bookmark, category: 'Navigation' },
  { label: 'Portfolio', path: '/portfolio', icon: Briefcase, category: 'Navigation' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, category: 'Navigation' },
  { label: 'Activity & History', path: '/activity', icon: History, category: 'Navigation' },
  { label: 'Profile & Settings', path: '/profile', icon: User, category: 'Navigation' },
]

export default function CommandPalette({ isOpen, onClose, onOpenTrade }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { stocks } = useTrade()

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          // Open
          setQuery('')
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredStocks = useMemo(() => {
    if (!query.trim()) return stocks.slice(0, 6)
    const q = query.toLowerCase().trim()
    return stocks
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector?.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [stocks, query])

  const filteredNav = useMemo(() => {
    if (!query.trim()) return NAV_ITEMS
    const q = query.toLowerCase().trim()
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  if (!isOpen) return null

  const handleSelectNav = (path) => {
    navigate(path)
    onClose()
  }

  const handleSelectStock = (stock) => {
    navigate(`/markets?stock=${stock.symbol}`)
    onClose()
  }

  const handleQuickTrade = (e, stock) => {
    e.stopPropagation()
    if (onOpenTrade) {
      onOpenTrade(stock)
      onClose()
    } else {
      navigate(`/markets?stock=${stock.symbol}`)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#111318]/95 shadow-2xl overflow-hidden text-[#F5F7FA] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <BorderBeam size={220} duration={8} colorFrom="#3B82F6" colorTo="#10B981" />
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-[rgba(255,255,255,0.08)] px-4 py-3.5">
          <Search className="w-5 h-5 text-[#9CA3AF] mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search stocks, sectors, pages, or quick actions (⌘K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-[#F5F7FA] placeholder:text-[#667085] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="text-[#9CA3AF] hover:text-[#F5F7FA] p-1 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[0.7rem] text-[#9CA3AF] font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Content List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[rgba(255,255,255,0.04)]">
          {/* Stocks Section */}
          <div className="py-2">
            <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-[#667085]">
              Equities & Assets
            </p>
            {filteredStocks.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#9CA3AF]">No stocks found matching &quot;{query}&quot;</p>
            ) : (
              filteredStocks.map((stock) => {
                const isPositive = Number(stock.changePercent || 0) >= 0
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleSelectStock(stock)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-xs font-bold text-[#F5F7FA] shrink-0 font-mono">
                        {stock.symbol.slice(0, 3)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#F5F7FA] font-mono">
                            {stock.symbol}
                          </span>
                          <span className="text-xs text-[#9CA3AF] truncate">
                            {stock.name}
                          </span>
                        </div>
                        <span className="text-[0.7rem] text-[#667085]">
                          {stock.sector || 'Stock'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#F5F7FA] font-mono">
                          {formatCurrency(stock.price)}
                        </p>
                        <p
                          className={`text-xs flex items-center justify-end font-mono ${
                            isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3 inline mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 inline mr-0.5" />
                          )}
                          {isPositive ? '+' : ''}
                          {Number(stock.changePercent || 0).toFixed(2)}%
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleQuickTrade(e, stock)}
                        className="hidden sm:inline-flex items-center gap-1 rounded bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 border border-[#3B82F6]/30 text-[#3B82F6] px-2.5 py-1 text-xs font-medium transition"
                      >
                        <PlusCircle className="w-3 h-3" /> Trade
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Navigation Section */}
          <div className="py-2">
            <p className="px-3 pb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-[#667085]">
              Quick Navigation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {filteredNav.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.path}
                    onClick={() => handleSelectNav(item.path)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition cursor-pointer text-xs font-medium text-[#9CA3AF] hover:text-[#F5F7FA]"
                  >
                    <Icon className="w-4 h-4 text-[#3B82F6] shrink-0" />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)] px-4 py-2 text-[0.7rem] text-[#667085]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 mr-1 font-mono">
                ↑
              </kbd>
              <kbd className="rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 mr-1 font-mono">
                ↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 mr-1 font-mono">
                ↵
              </kbd>
              Select
            </span>
          </div>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  )
}
