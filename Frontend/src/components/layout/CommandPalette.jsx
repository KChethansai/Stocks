import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Newspaper,
  Bookmark,
  Briefcase,
  BarChart3,
  Crosshair,
  History,
  User,
  PlusCircle,
  RefreshCw,
  X
} from 'lucide-react'
import { useTrade } from '../../store/tradeStore'
import { fmtMoney, fmtPct } from '../../utils/format'
import { Button } from '../ui/Button'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, category: 'Go to' },
  { label: 'Markets & Trading', path: '/markets', icon: TrendingUp, category: 'Go to' },
  { label: 'News', path: '/news', icon: Newspaper, category: 'Go to' },
  { label: 'Watchlist', path: '/watchlist', icon: Bookmark, category: 'Go to' },
  { label: 'Portfolio', path: '/portfolio', icon: Briefcase, category: 'Go to' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, category: 'Go to' },
  { label: 'Forecast accuracy', path: '/accuracy', icon: Crosshair, category: 'Go to' },
  { label: 'Activity & History', path: '/activity', icon: History, category: 'Go to' },
  { label: 'Profile & Settings', path: '/profile', icon: User, category: 'Go to' },
]

const RECENT_KEY = 'mf-palette-recent'

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((r) => r?.path).slice(0, 4) : []
  } catch {
    return []
  }
}

export default function CommandPalette({ isOpen, onClose, onOpenTrade }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState([])
  const navigate = useNavigate()
  const { stocks, fetchStocks } = useTrade()
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActive(0)
      setRecent(readRecent())
      // Synchronous primary focus: effects run in the same task as the open
      // commit, so no keystroke can interleave before focus lands. (A lone
      // rAF focus left a gap on WebKit where immediate typing was silently
      // lost — proven 2/3 empty + 1/3 partial in browser probes, Oct 2026.)
      // One bounded 120ms re-assert remains as safety for exotic remounts.
      inputRef.current?.focus()
      const t = window.setTimeout(() => {
        if (document.activeElement !== inputRef.current) inputRef.current?.focus()
      }, 120)
      return () => window.clearTimeout(t)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
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

  // D8: exactly two action rows (Open trade, Refresh prices) after Stocks,
  // before Go to. They join the flat actions array so keyboard nav is unchanged.
  const filteredActions = useMemo(() => {
    const rows = [
      { kind: 'action', section: 'actions', actionId: 'open-trade', label: 'Open trade', icon: PlusCircle },
      { kind: 'action', section: 'actions', actionId: 'refresh-prices', label: 'Refresh prices', icon: RefreshCw },
    ]
    if (!query.trim()) return rows
    const q = query.toLowerCase().trim()
    return rows.filter((r) => r.label.toLowerCase().includes(q) || 'action'.includes(q))
  }, [query])

  // Flat action list for arrow-key navigation: recent, stocks, actions, nav.
  const actions = useMemo(() => {
    const list = []
    if (!query.trim() && recent.length) {
      recent.forEach((r) => {
        const item = NAV_ITEMS.find((n) => n.path === r.path)
        if (item) list.push({ kind: 'nav', section: 'recent', ...item })
      })
    }
    filteredStocks.forEach((stock) => list.push({ kind: 'stock', section: 'stocks', ...stock }))
    filteredActions.forEach((a) => list.push(a))
    filteredNav.forEach((item) => list.push({ kind: 'nav', section: 'nav', ...item }))
    return list
  }, [filteredNav, filteredStocks, filteredActions, recent, query])

  const sections = useMemo(() => {
    const groups = [
      { key: 'recent', title: 'Recent' },
      { key: 'stocks', title: 'Stocks' },
      { key: 'actions', title: 'Actions' },
      { key: 'nav', title: 'Go to' }
    ]
    let idx = 0
    return groups
      .map((g) => {
        const items = actions.filter((a) => a.section === g.key).map((a) => ({ ...a, idx: idx++ }))
        return { ...g, items }
      })
      .filter((g) => g.items.length > 0)
  }, [actions])

  useEffect(() => {
    setActive(0)
  }, [query])

  const remember = (path) => {
    try {
      const next = [{ path }, ...readRecent().filter((r) => r.path !== path)].slice(0, 4)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      // private mode — recents simply won't persist
    }
  }

  const runAction = (action) => {
    if (!action) return
    if (action.kind === 'action') {
      if (action.actionId === 'open-trade') {
        if (onOpenTrade) onOpenTrade(null)
        else navigate('/markets')
      } else if (action.actionId === 'refresh-prices') {
        fetchStocks?.()
      }
      onClose()
    } else if (action.kind === 'nav') {
      remember(action.path)
      navigate(action.path)
      onClose()
    } else {
      navigate(`/markets?stock=${action.symbol}`)
      onClose()
    }
  }

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => {
        const n = Math.min(actions.length - 1, a + 1)
        document.getElementById(`palette-option-${n}`)?.scrollIntoView({ block: 'nearest' })
        return n
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => {
        const n = Math.max(0, a - 1)
        document.getElementById(`palette-option-${n}`)?.scrollIntoView({ block: 'nearest' })
        return n
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAction(actions[active])
    }
  }

  if (!isOpen) return null

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

  const optionKey = (action) =>
    action.kind === 'nav'
      ? `${action.section}-${action.path}`
      : action.kind === 'action'
        ? `action-${action.actionId}`
        : `${action.section}-${action.symbol}`
  const renderOption = (action, content) => {
    const idx = action.idx
    const isActive = idx === active
    return (
      <div
        key={optionKey(action)}
        id={`palette-option-${idx}`}
        role="option"
        aria-selected={isActive}
        onClick={() => runAction(action)}
        onMouseEnter={() => setActive(idx)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg transition cursor-pointer group ${
          isActive ? 'bg-white/[0.07]' : ''
        }`}
      >
        {content}
      </div>
    )
  }

  const sectionItems = (key) => sections.find((s) => s.key === key)?.items || []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search markets and pages"
        className="w-full max-w-2xl rounded-2xl border border-[var(--hairline)] bg-[var(--ink-900)] shadow-[var(--shadow-float)] overflow-hidden text-[var(--ivory)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-[var(--hairline)] px-4 py-3.5">
          <Search className="w-5 h-5 text-[var(--stone)] mr-3 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={`palette-option-${active}`}
            aria-label="Search stocks, sectors, and pages"
            placeholder="Search stocks, sectors, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="w-full bg-transparent text-sm text-[var(--ivory)] placeholder-[var(--stone-muted)] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-[var(--stone)] hover:text-[var(--ivory)] p-1 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block rounded border border-[var(--hairline)] bg-white/[0.05] px-2 py-0.5 text-[0.7rem] text-[var(--stone)]">
              ESC
            </kbd>
          )}
        </div>

        {/* Content List */}
        <div ref={listRef} id="palette-listbox" role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto p-2">
          {actions.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--stone)]">
              No matches for &quot;{query}&quot;. Try a symbol like AAPL.
            </p>
          )}

          {!query.trim() && sectionItems('recent').length > 0 && (
            <div className="py-2" role="group" aria-label="Recent">
              <p className="px-3 pb-1.5 text-[13px] text-[var(--stone)]">Recent</p>
              {sectionItems('recent').map((action) => {
                const Icon = action.icon
                return renderOption(
                  action,
                  <div className="flex items-center gap-2.5 text-xs font-medium text-[var(--stone)]">
                    <Icon className="w-4 h-4 text-[var(--brass)] shrink-0" aria-hidden="true" />
                    <span>{action.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stocks Section */}
          <div className="py-2" role="group" aria-label="Stocks">
            <p className="px-3 pb-1.5 text-[13px] text-[var(--stone)]">Stocks</p>
            {sectionItems('stocks').length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--stone)]">No stocks found matching &quot;{query}&quot;</p>
            ) : (
              sectionItems('stocks').map((stock) => {
                const isPositive = Number(stock.changePercent || 0) >= 0
                return renderOption(
                  stock,
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-[var(--hairline)] flex items-center justify-center text-xs font-bold text-[var(--ivory)] shrink-0">
                        {stock.symbol.slice(0, 3)}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-[var(--ivory)]">
                            {stock.symbol}
                          </span>
                          <span className="text-xs text-[var(--stone)] truncate">
                            {stock.name}
                          </span>
                        </div>
                        <span className="text-[0.7rem] text-[var(--stone-muted)]">
                          {stock.sector || 'Stock'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-[var(--ivory)]">
                          {fmtMoney(stock.price)}
                        </p>
                        <p className={`text-xs tabular-nums ${isPositive ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                          {fmtPct(stock.changePercent)}
                        </p>
                      </div>

                      <Button
                        variant="cell"
                        size="xs"
                        onClick={(e) => handleQuickTrade(e, stock)}
                        className="hidden sm:inline-flex"
                      >
                        <PlusCircle className="w-3 h-3" /> Trade
                      </Button>
                    </div>
                  </>
                )
              })
            )}
          </div>

          {/* Actions Section (D8): Open trade + Refresh prices */}
          {sectionItems('actions').length > 0 && (
            <div className="py-2" role="group" aria-label="Actions">
              <p className="px-3 pb-1.5 text-[13px] text-[var(--stone)]">Actions</p>
              {sectionItems('actions').map((action) => {
                const Icon = action.icon
                return renderOption(
                  action,
                  <div className="flex items-center gap-2.5 text-xs font-medium text-[var(--stone)]">
                    <Icon className="w-4 h-4 text-[var(--brass)] shrink-0" aria-hidden="true" />
                    <span>{action.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Navigation Section */}
          <div className="py-2" role="group" aria-label="Go to">
            <p className="px-3 pb-1.5 text-[13px] text-[var(--stone)]">Go to</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {sectionItems('nav').map((item) => {
                const Icon = item.icon
                return renderOption(
                  item,
                  <div className="flex items-center gap-2.5 text-xs font-medium text-[var(--stone)]">
                    <Icon className="w-4 h-4 text-[var(--brass)] shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-black/20 px-4 py-2 text-[0.7rem] text-[var(--stone-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[var(--hairline)] bg-white/[0.05] px-1.5 py-0.5 mr-1">
                ↑
              </kbd>
              <kbd className="rounded border border-[var(--hairline)] bg-white/[0.05] px-1.5 py-0.5 mr-1">
                ↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="rounded border border-[var(--hairline)] bg-white/[0.05] px-1.5 py-0.5 mr-1">
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
