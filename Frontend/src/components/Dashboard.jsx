import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { Link } from 'react-router'
import axios from 'axios'
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react'
import { useAuth } from '../store/authStore'
import { useTrade } from '../store/tradeStore'
import { TerminalLineChart } from './TerminalCharts'
import {
  formatCurrency,
  summarizePortfolio
} from '../utils/marketAnalytics'
import { SpotlightCard } from './kokonutui/SpotlightCard'
import { LiveValue } from './LiveValue'
import { ShinyText } from './reactbits/ShinyText'
import { SegmentedControl } from './ui/SegmentedControl'
import Reveal from './ui/Reveal'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

// ── The height budget ───────────────────────────────────────────────────
// <main> hands the dashboard a content box of (viewport − 56px topbar −
// shell padding) = 680px at 1366x768, 812px at 1440x900. From lg up the root
// column fills exactly that box and distributes it:
//
//     pt-4                                      16
//     portfolio summary            shrink-0    63
//     gap                                       12
//     panel row                   flex-1  483 / 615
//     gap                                       12
//     market movers strip          shrink-0    94
//                                             ────
//                                             680 / 812
//
// Only the panel row flexes. Everything else is shrink-0 at its natural
// height, so surplus can never accumulate as a void and the strip under the
// panels can never drop past the fold. Inside the row the chart is sized in
// CSS and the rail from one measurement, so each is exactly as tall as the
// space it was given:
//
//     chart panel   = rowH  (flex-1)
//       card padding 16 top + 16 bottom              32
//       heading + range control + margin              34
//       chart plot (.mf-chart-frame, flex-1)  417 / 549
//     secondary rail = the rows it needs, never more than rowH
//
// BELOW lg the root is content-sized (`min-h-full`, no `h-full`) and the rail
// carries no inline height at all. That is not cosmetic: with the root pinned
// and the rail given a pixel height, the row's flex box stays at its
// allocation while its stacked children are taller, so the rail paints
// underneath the Market Movers strip (which is `position: relative`) — measured
// at 60px of overlap at 390x844 / 768x900 / 900x700, at every watchlist size.
// Letting the page grow instead is both the correct mobile behaviour and the
// only way that case cannot happen.
const ROW_MIN_H = 34        // one watchlist/signal row, floor
// Ceiling on a row's height. This is the only knob that decides how much
// surplus the rail gives back to the page. At 64 the rail hugged a 6-row list
// into 489px of a 615px row and left a ~126px void beside the chart — the same
// lopsided-column look this composition exists to remove. At 88 a 6-row list
// fills its row exactly at 1440x900 (85px rows) while a 3-row list still stops
// well short rather than inflating into an oversized empty card.
const ROW_MAX_H = 88
const ROW_CAP = 20          // past this the rail pages instead of growing
const NARROW_CAP = 12       // stacked preview size; the page scrolls past it
const SIGNAL_SYMBOL_CAP = 8 // the /ml-api/predict batch endpoint's own hard cap
const RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

const DIRECTION_META = {
  UP: { label: 'Bullish', Icon: ArrowUpRight, className: 'cc-pred-up' },
  DOWN: { label: 'Bearish', Icon: ArrowDownRight, className: 'cc-pred-down' },
  NEUTRAL: { label: 'Neutral', Icon: Minus, className: 'cc-pred-neutral' }
}

// ── useMediaQuery ───────────────────────────────────────────────────────
// The one breakpoint that decides whether the rail has a height budget at all.
// Below it the layout is stacked and the page scrolls, so an inline pixel
// height on the rail would be meaningless at best and overlapping at worst.
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// ── useMeasuredHeight ───────────────────────────────────────────────────
// One ResizeObserver, used once, for the row. The chart deliberately does
// NOT use it. Its plot must fill a box that is already the right height, and
// a percentage chain that reaches the plot has to have a definite height at
// every link or it dead-ends and the SVG collapses to its content height
// (measured: a 530px frame reporting 154px to the SVG with no rule at all).
// So the frame is sized in CSS (`.mf-chart-frame`) and the plot told to fill
// it — box and plot resolve in one layout pass, with no JS number that could
// arrive a frame late. Feeding the chart a JS-measured number instead arrives
// a frame late, and that frame is a real, measurable 11px of overflow
// mid-resize and 241px on a hard downsize.
function useMeasuredHeight() {
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const apply = () => {
      const next = Math.round(el.clientHeight)
      // 1px hysteresis: guards against fractional-height resize loops.
      if (next > 0) setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    }
    apply()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply)
      return () => window.removeEventListener('resize', apply)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, height]
}

// ── Tabs ────────────────────────────────────────────────────────────────
// WAI-ARIA tabs: roving tabindex, arrow/Home/End, aria-controls wiring.
// Shared by the secondary panel and the Market Movers strip so there is one
// tab implementation on the screen.
function Tabs({ tabs, value, onChange, ariaLabel, className = '' }) {
  const buttons = useRef({})
  const index = tabs.findIndex((t) => t.value === value)

  const onKeyDown = (e) => {
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    onChange(tabs[next].value)
    buttons.current[tabs[next].value]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-4 ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => { buttons.current[tab.value] = el }}
            type="button"
            role="tab"
            id={tab.id}
            aria-selected={active}
            aria-controls={tab.controls}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={`text-xs font-mono pb-1 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] rounded-sm ${
              active
                ? 'text-[var(--brass)] border-b-2 border-[var(--brass)] font-semibold'
                : 'text-[var(--stone)] border-b-2 border-transparent hover:text-[var(--ivory)]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Rows ────────────────────────────────────────────────────────────────
// One line per instrument: symbol, truncated name, price, change. Every row
// is a real destination, so it is a real <Link> — keyboard and middle-click
// work without the role="link" + onKeyDown shim the old rows needed.
function QuoteRow({ stock }) {
  const isPos = Number(stock.changePercent) >= 0
  return (
    <Link
      to={`/markets?stock=${stock.symbol}`}
      className="grid grid-cols-12 gap-2 items-center px-2 -mx-2 flex-1 rounded-lg hover:bg-[#181B1F] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] group"
    >
      <span className="col-span-6 flex items-baseline gap-2 min-w-0">
        <span className="font-mono text-xs font-bold text-[var(--ivory)] group-hover:text-[var(--brass)] transition shrink-0">
          {stock.symbol}
        </span>
        {/* `truncate` silently drops the tail of a long company name, so the
            full value rides along in `title` — otherwise "Bank of America Cor…"
            is genuinely unrecoverable rather than merely abbreviated. */}
        <span className="mf-meta truncate" title={stock.name}>
          {stock.name}
        </span>
      </span>
      <span className="col-span-3 text-right font-mono text-xs font-medium text-[var(--ivory)]">
        ${Number(stock.price).toFixed(2)}
      </span>
      <span
        className={`col-span-3 text-right font-mono text-xs font-semibold ${
          isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
        }`}
      >
        {isPos ? '+' : ''}
        {Number(stock.changePercent).toFixed(2)}%
      </span>
    </Link>
  )
}

function SignalRow({ signal }) {
  const meta = DIRECTION_META[signal.direction] || DIRECTION_META.NEUTRAL
  const Icon = meta.Icon
  return (
    <Link
      to={`/markets?stock=${signal.symbol}`}
      className="flex items-center gap-3 px-2 -mx-2 flex-1 rounded-lg hover:bg-[#181B1F] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] group"
    >
      {/* Same box and type as the signal rows that shipped in
          AiInsightWidget — 36px, text-xs. Nothing here shrank. */}
      <span className="w-9 h-9 shrink-0 rounded-lg bg-[#111316] border border-white/8 flex items-center justify-center font-mono text-xs font-bold text-[var(--stone)]">
        {signal.symbol.slice(0, 3)}
      </span>
      <span className="flex-1 min-w-0 text-xs font-semibold text-[var(--ivory)] group-hover:text-[var(--brass)] transition truncate">
        {signal.symbol}
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md mf-badge font-mono ${meta.className}`}>
        <Icon className="w-3 h-3" />
        {meta.label}
      </span>
    </Link>
  )
}

// ── Empty / loading ─────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex flex-col justify-center gap-2 px-2 flex-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[14px] rounded-md bg-white/5 animate-pulse" />
      ))}
    </div>
  )
}

function EmptyNote({ children }) {
  return <p className="mf-empty flex-1 flex items-center justify-center px-2">{children}</p>
}

// ── Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser } = useAuth()
  const {
    stocks,
    portfolio,
    transactions,
    fetchStocks,
    fetchPortfolio,
    fetchTransactions,
    fetchPortfolioPerformance,
    startPolling,
    stopPolling
  } = useTrade()

  const [range, setRange] = useState('1M')
  const [moverTab, setMoverTab] = useState('gainers') // 'gainers' | 'losers' | 'active'
  const [panelTab, setPanelTab] = useState('watchlist') // 'watchlist' | 'signals'
  const [watchPage, setWatchPage] = useState(0)
  const [signalPage, setSignalPage] = useState(0)
  const [portfolioHistory, setPortfolioHistory] = useState([])
  const [predictions, setPredictions] = useState([])
  const [signalsLoading, setSignalsLoading] = useState(true)
  // "The quotes request has come back" — tracked here rather than read off the
  // store's `loading` flag, which is SHARED: fetchPortfolio() and
  // fetchTransactions() set it true and clear it the moment *they* finish, so
  // it reads false while a slower fetchStocks() is still in flight. Measured:
  // with the quotes request delayed 3s, `loading` was already false at 1.2s and
  // the rail was asserting an empty watchlist the whole time.
  const [stocksSettled, setStocksSettled] = useState(false)

  const isWide = useMediaQuery('(min-width: 1024px)')
  const [rowRef, rowH] = useMeasuredHeight()

  useEffect(() => {
    let alive = true
    setStocksSettled(false)
    Promise.resolve(fetchStocks()).finally(() => {
      if (alive) setStocksSettled(true)
    })
    fetchPortfolio()
    fetchTransactions()
    startPolling()
    return () => {
      alive = false
      stopPolling()
    }
  }, [fetchStocks, fetchPortfolio, fetchTransactions, startPolling, stopPolling])

  // Get user greeting according to time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  // Summarize current portfolio metrics. The FULL transactions array is
  // what realizes cost basis and P&L — never a page or a subset.
  const analytics = useMemo(
    () => summarizePortfolio(portfolio, transactions, stocks),
    [portfolio, transactions, stocks]
  )

  // Real portfolio equity curve for the selected range (server-computed)
  useEffect(() => {
    let cancelled = false
    fetchPortfolioPerformance(range).then((res) => {
      if (!cancelled) setPortfolioHistory(res.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [range, fetchPortfolioPerformance])

  // Watchlist items. Every tracked symbol is kept: the rail paginates over
  // whatever it is given instead of silently dropping the tail.
  const watchlistStocks = useMemo(() => {
    const symbols = currentUser?.watchlist || []
    if (symbols.length === 0) return stocks.slice(0, 6)
    return symbols.map((sym) => stocks.find((s) => s.symbol === sym)).filter(Boolean)
  }, [currentUser?.watchlist, stocks])

  // Market movers
  const movers = useMemo(() => {
    return {
      gainers: [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
      losers: [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3),
      active: [...stocks].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 3)
    }
  }, [stocks])

  // Symbols for forecasts: the whole watchlist first (up to six), then top
  // gainers, deduplicated. The request is sized to the endpoint's own limit —
  // MlAPI.js slices `symbols` to 8 — so asking for more than that is the
  // difference between a rail that can fill its row and one that cannot.
  const insightSymbols = useMemo(() => {
    const fromWatch = (currentUser?.watchlist || []).slice(0, 6)
    const fromMovers = movers.gainers.slice(0, 4).map((s) => s.symbol)
    return [...new Set([...fromWatch, ...fromMovers])].slice(0, SIGNAL_SYMBOL_CAP)
  }, [currentUser?.watchlist, movers.gainers])

  const insightKey = insightSymbols.join(',')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setSignalsLoading(true)
      try {
        const qs = insightKey ? `?symbols=${insightKey}` : ''
        const { data } = await axios.get(`${API_BASE}/ml-api/predict${qs}`, {
          withCredentials: true
        })
        if (!cancelled) setPredictions(data.predictions || [])
      } catch {
        if (!cancelled) setPredictions([])
      } finally {
        if (!cancelled) setSignalsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [insightKey])

  // Directional calls only, ranked by confidence: bullish first, then bearish,
  // then the neutral calls the model also returns. The model still returns its
  // per-signal agreement counts; they are simply not surfaced (same rule, same
  // reason, as PredictionWidgets.jsx). No ML value is read, derived or changed
  // here. NEUTRAL is kept rather than dropped: it is a real forecast with a
  // real direction, and dropping it silently halved the number of rows this tab
  // could ever show.
  const rankedSignals = useMemo(() => {
    const byConfidence = [...predictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    return [
      ...byConfidence.filter((p) => p.direction === 'UP'),
      ...byConfidence.filter((p) => p.direction === 'DOWN'),
      ...byConfidence.filter((p) => !p.direction || p.direction === 'NEUTRAL')
    ]
  }, [predictions])

  // ── Height split, from the one row measurement ────────────────────────
  // Rail chrome: padding 32 + heading 24 + margin 12 + tablist 45.
  // Deliberately a slight OVER-estimate (~10px): over-reserving costs at most
  // one row of density, while under-reserving would push the last row past
  // the card. `railH` is additionally clamped to `rowH` below, so the rail
  // can never claim more height than the row it sits in.
  const RAIL_CHROME = 105
  const RAIL_PAGER = 28     // pager block, only reserved when it renders

  // Capacity is derived from the conservative basis (pager always reserved) so
  // it never depends on its own result; the rendered height then uses the real
  // pager height, which is why a short list gets the space back.
  const capacityBasis = Math.max(0, rowH - RAIL_CHROME - RAIL_PAGER)
  const measuredCapacity = Math.max(1, Math.min(ROW_CAP, Math.floor(capacityBasis / ROW_MIN_H)))
  const capacity = isWide ? measuredCapacity : NARROW_CAP

  const railItems = panelTab === 'watchlist' ? watchlistStocks : rankedSignals

  // Loading is a real state for the watchlist too: on a cold load `stocks` is
  // empty, so the symbol→quote join yields nothing and the list would
  // otherwise assert "Nothing tracked yet" for the whole request — telling a
  // user with a 7-symbol watchlist that they track nothing, and sending them
  // to /markets. Skeleton first; the empty state only once the request has
  // actually resolved.
  const railLoading =
    panelTab === 'signals' ? signalsLoading : !stocksSettled && railItems.length === 0

  const shown = railLoading ? 0 : Math.min(railItems.length, capacity)
  const railPages = Math.max(1, Math.ceil(railItems.length / capacity))
  const page = Math.min(panelTab === 'watchlist' ? watchPage : signalPage, railPages - 1)
  const setPage = panelTab === 'watchlist' ? setWatchPage : setSignalPage
  const visible = railItems.slice(page * capacity, page * capacity + capacity)

  // Rows share whatever is left: a dense list stays at the compact floor and
  // fills the rail exactly, a short list gets roomier rows rather than a
  // stretched card. Never both, never neither. Floor, not round, so a page
  // can never exceed the space it was measured against. The 64px ceiling is
  // what stops a very short list from being faked out into filling the row:
  // the honest answer to "3 rows in a 615px row" is a 297px card, not a
  // 615px card holding three rows.
  const unit = shown > 0
    ? Math.max(ROW_MIN_H, Math.min(ROW_MAX_H, Math.floor((rowH - RAIL_CHROME) / shown)))
    : ROW_MIN_H

  // The rail hugs its data. Stretching a 3-row list into a 615px card is the
  // oversized-empty-card failure; a short rail that ends where its data ends
  // is honest, and the surplus stays with the chart.
  const bodyH = railLoading
    ? Math.max(0, rowH - RAIL_CHROME)
    : Math.min(shown * unit, Math.max(0, rowH - RAIL_CHROME))
  const railH = Math.min(
    bodyH + RAIL_CHROME + (railPages > 1 ? RAIL_PAGER : 0),
    rowH
  )

  // No inline height at all below lg, and none until the row has been measured
  // once — so the very first paint is content-sized, never zero-height.
  const railStyle = isWide && rowH > 0 ? { height: railH } : undefined

  const panelTabs = [
    { value: 'watchlist', label: 'Watchlist', id: 'dash-tab-watchlist', controls: 'dash-panel-rail' },
    { value: 'signals', label: 'Signals', id: 'dash-tab-signals', controls: 'dash-panel-rail' }
  ]
  const moverTabs = [
    { value: 'gainers', label: 'Top Gainers', id: 'dash-tab-gainers', controls: 'dash-panel-movers' },
    { value: 'losers', label: 'Top Losers', id: 'dash-tab-losers', controls: 'dash-panel-movers' },
    { value: 'active', label: 'Most Active', id: 'dash-tab-active', controls: 'dash-panel-movers' }
  ]

  const totalPnL = analytics.totalPnL
  const totalPnLPercent = analytics.totalPnLPercent
  const todayPnL = analytics.todayPnL
  const isTotalPos = totalPnL >= 0
  const isTodayPos = todayPnL >= 0

  return (
    /* From lg up this turns the dashboard from "an 856px page" into "whatever
       the shell gave us": flex-1 on the panel row is what makes the fit exact
       at every height, because surplus goes to the chart and never to a void.
       Below lg the root is content-sized so the page scrolls the way a page
       should — and so the rail, which has no height budget when the panels are
       stacked, cannot end up painted underneath the Market Movers strip.
       Nothing is clipped: when the floors below cannot be met the column simply
       grows past the viewport and <main> scrolls, which is the right behaviour
       on mobile, short windows and zoomed-in views. */
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3 px-4 pt-4 lg:h-full lg:min-h-0 lg:px-7 animate-fade-in">

      {/* ── 1. Portfolio summary — compact, shrink-0 ───────────────── */}
      <Reveal className="flex shrink-0 flex-wrap items-center justify-between gap-x-8 gap-y-2 rounded-2xl border border-white/8 bg-[#111316]/95 px-5 py-3">
        <div className="min-w-0">
          <p className="mf-eyebrow">
            <ShinyText>Your Portfolio</ShinyText>
          </p>
          <p className="mf-meta mt-0.5 truncate">
            {greeting}{currentUser?.username ? `, ${currentUser.username}` : ''}
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <span className="text-3xl font-bold font-mono text-[var(--ivory)] tracking-tight whitespace-nowrap">
            <LiveValue value={Number(analytics.portfolioValue || 0)} format={(v) => `$${v.toFixed(2)}`} />
          </span>
          <div
            className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-md font-semibold whitespace-nowrap ${
              isTotalPos
                ? 'text-[var(--gain)] bg-[rgba(79,178,134,.12)] border border-[var(--gain)]/20'
                : 'text-[var(--loss)] bg-[rgba(217,102,122,.12)] border border-[var(--loss)]/20'
            }`}
          >
            {isTotalPos ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {isTotalPos ? '+' : ''}
              {totalPnLPercent.toFixed(2)}% ({isTotalPos ? '+' : ''}
              {formatCurrency(totalPnL)})
            </span>
          </div>
        </div>

        {/* Gridless inline metrics */}
        <div className="flex shrink-0 items-center gap-7">
          <div className="flex flex-col gap-0.5">
            <span className="text-text-muted text-xs font-mono">Today&apos;s P&amp;L</span>
            <span
              className={`font-mono text-sm font-semibold ${
                isTodayPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
              }`}
            >
              {isTodayPos ? '+' : ''}
              {formatCurrency(todayPnL)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-muted text-xs font-mono">Cash</span>
            <span className="text-[var(--ivory)] font-mono text-sm font-semibold">
              {formatCurrency(analytics.cashBalance || 0)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-text-muted text-xs font-mono">Invested</span>
            <span className="text-[var(--ivory)] font-mono text-sm font-semibold">
              {formatCurrency(analytics.investedAmount || 0)}
            </span>
          </div>
        </div>
      </Reveal>

      {/* ── 2. Panel row — flex-1 from lg up. Chart primary, rail beside it. */}
      <div ref={rowRef} data-testid="mf-panel-row" className="flex min-h-[280px] flex-1 items-stretch gap-3 flex-col lg:flex-row">

        {/* Performance — the primary panel. The plain wrapper carries the
            geometry hook; Reveal does not forward props, and it also lets the
            panel be a flex child without its height living on an animated
            element. */}
        <div className="flex min-w-0 flex-1" data-testid="mf-chart-panel">
        <Reveal className="flex min-w-0 w-full flex-col rounded-2xl border border-white/8 bg-[#111316]/95 p-4 shadow-xl">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-4">
              <h3 className="mf-h2">Performance</h3>
              <div className="flex items-center gap-3 text-xs text-[var(--stone)] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--brass)]" />
                  Portfolio
                </span>
              </div>
            </div>

            <SegmentedControl
              value={range}
              onChange={setRange}
              ariaLabel="Dashboard range"
              size="sm"
              options={RANGES.map((r) => ({ value: r, label: r }))}
            />
          </div>

          {/* The frame is sized in CSS (.mf-chart-frame) and the plot is told
              to fill it, so box and plot resolve in ONE layout pass. The CSS
              reaches the plot through a flex child rather than by matching a
              class inside TerminalLineChart, because a percentage chain that
              dead-ends at one link does not fail loudly — it renders an 18px
              sliver in a 530px frame and looks correct only while the chart
              has no data. min-height is the guard rail: below it the panel
              stops shrinking and <main> scrolls instead. */}
          <div className="mf-chart-frame flex-1" data-testid="mf-chart-frame">
            <TerminalLineChart
              data={portfolioHistory}
              label="Portfolio value"
              color="#C9A96E"
              height="100%"
              showGrid={true}
            />
          </div>
        </Reveal>
        </div>

        {/* Secondary rail — Watchlist / Signals, ONE view at a time.
            Reveal does not forward style, so the height lives on a plain
            wrapper: that keeps the rail an explicit height instead of a
            stretched one. */}
        <div style={railStyle} className="flex w-full shrink-0 lg:w-[352px]" data-testid="mf-rail">
        <Reveal
          as="aside"
          className="flex w-full flex-1 flex-col rounded-2xl border border-white/8 bg-[#111316]/95 p-4"
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <h3 className="mf-h2">Watchlist &amp; Signals</h3>
            <Link
              to={panelTab === 'watchlist' ? '/watchlist' : '/accuracy'}
              className="text-xs text-[var(--brass)] hover:underline flex items-center gap-1 font-mono whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] rounded-sm"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <Tabs
            tabs={panelTabs}
            value={panelTab}
            onChange={setPanelTab}
            ariaLabel="Watchlist and signals view"
            className="mt-3 shrink-0 border-b border-white/8"
          />

          <div
            role="tabpanel"
            id="dash-panel-rail"
            aria-labelledby={panelTab === 'watchlist' ? 'dash-tab-watchlist' : 'dash-tab-signals'}
            className="flex min-h-0 flex-1 flex-col pt-1"
            >
              <div
                className="flex min-h-0 flex-1 flex-col divide-y divide-white/5"
                // Wide only, for the same reason `railStyle` is (line ~465):
                // below lg the panel row is `flex-col`, so `rowH` is the whole
                // stacked column — chart + gap + rail. Dividing that by the row
                // count to size the rail makes the rail's height an input to its
                // own measurement: every ResizeObserver tick grew the list, and
                // it settled far above the ROW_MIN_H floor the constant exists to
                // enforce. Below lg the list is content-sized and the page
                // scrolls, which is the correct behaviour there anyway.
                style={isWide && shown > 0 ? { height: shown * unit } : undefined}
              >
              {railLoading ? (
                <RowSkeleton />
              ) : railItems.length === 0 ? (
                <EmptyNote>
                  {panelTab === 'watchlist' ? (
                    <>
                      Nothing tracked yet —{' '}
                      <Link to="/markets" className="text-[var(--brass)] hover:underline">
                        browse the market
                      </Link>{' '}
                      to start one.
                    </>
                  ) : (
                    'No forecasts yet — sync market data and retry.'
                  )}
                </EmptyNote>
              ) : panelTab === 'watchlist' ? (
                visible.map((stock) => <QuoteRow key={stock.symbol} stock={stock} />)
              ) : (
                visible.map((signal) => <SignalRow key={signal.symbol} signal={signal} />)
              )}
            </div>

            {/* Explicit pagination. Never a scroller: the rail shows one
                page and the controls say where the rest are. */}
            {railPages > 1 ? (
              <div className="flex shrink-0 items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  aria-label={`Previous page of ${panelTab}`}
                  className="rounded-md border border-[var(--hairline)] p-1 text-[var(--stone)] hover:text-[var(--ivory)] hover:border-[var(--hairline-hover)] disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-text-muted text-xs font-mono">{page + 1} / {railPages}</span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(railPages - 1, page + 1))}
                  disabled={page === railPages - 1}
                  aria-label={`Next page of ${panelTab}`}
                  className="rounded-md border border-[var(--hairline)] p-1 text-[var(--stone)] hover:text-[var(--ivory)] hover:border-[var(--hairline-hover)] disabled:opacity-35 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </Reveal>
        </div>
      </div>

      {/* ── 3. Market Movers — compact strip, shrink-0, beneath the panels.
           Two rows on purpose: heading + tabs, then the tiles on a grid.

           The previous version put the three tiles in a `flex-1` row beside
           the heading. A flex item with `flex-basis: 0` never wraps, so the
           tiles could not move to their own line — they absorbed whatever the
           heading left and shrank below their own min-content (their inner
           spans are `shrink-0`, so the symbol, price and change spill out of
           the tile), and `SpotlightCard`'s hard-coded `overflow-hidden` cut
           them. Measured at a 1024x768 viewport with the sidebar expanded
           (<main> = 764px): the third tile was 95px wide and 47px of its
           content sat past the card's clip edge. A grid with a declared
           column count cannot do that: tracks are as wide as the container
           says, and below `sm` there are only two of them. The heading row
           is `flex-wrap` so the three tabs drop to a second line rather than
           pushing the card's own content off the right edge at 390px. */}
      <Reveal className="shrink-0">
        <SpotlightCard
          spotlightColor="rgba(201, 169, 110, 0.15)"
          enableTilt={false}
          className="rounded-2xl border border-white/8 bg-[#111316]/95 px-4 py-3"
          data-testid="mf-movers"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 mb-2">
            <h3 className="mf-h2 shrink-0">Market Movers</h3>
            <Tabs tabs={moverTabs} value={moverTab} onChange={setMoverTab} ariaLabel="Market movers" />
          </div>

          <div
            role="tabpanel"
            id="dash-panel-movers"
            aria-labelledby={`dash-tab-${moverTab}`}
            className="grid grid-cols-2 gap-2 lg:grid-cols-3"
          >
            {movers[moverTab].length === 0 ? (
              <p className="mf-meta col-span-full">Waiting for quotes…</p>
            ) : (
              movers[moverTab].map((stock) => {
                const isPos = Number(stock.changePercent) >= 0
                return (
                  <Link
                    key={stock.symbol}
                    to={`/markets?stock=${stock.symbol}`}
                    className="flex min-w-0 flex-col items-start gap-0.5 rounded-lg border border-white/5 bg-[#181B1F]/90 px-3 py-2 hover:border-[var(--brass)]/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <span className="font-mono text-xs font-bold text-[var(--ivory)] shrink-0">
                      {stock.symbol}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      {/* The price is the primary financial value here, so it is
                          never removed at any width. An earlier version hid it
                          below `sm` because the one-line tile clipped; the tile
                          now wraps to two lines below `sm` instead, which keeps
                          the number on screen without hiding anything. */}
                      <span className="font-mono text-xs text-[var(--ivory)]">
                        ${Number(stock.price).toFixed(2)}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isPos ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {Number(stock.changePercent).toFixed(2)}%
                      </span>
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </SpotlightCard>
      </Reveal>
    </div>
  )
}