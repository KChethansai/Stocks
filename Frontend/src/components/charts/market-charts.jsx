import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AreaChart, Area } from './area-chart'
import { CandlestickChart } from './candlestick-chart'
import { Candlestick } from './candlestick'
import { Grid } from './grid'
import { XAxis } from './x-axis'
import { YAxis } from './y-axis'
import { ChartTooltip } from './tooltip/chart-tooltip'
import { LinearGradient } from '@visx/gradient'
import { useChartStable } from './chart-context'
import { useTrade } from '../../store/tradeStore'
import { historyTtlMs } from '../../utils/historyCachePolicy'

// ── MarketForge chart system ─────────────────────────────────────
// Bklit UI chart primitives (bklit.com/r/area-chart.json,
// bklit.com/r/candlestick-chart.json — visx-based, ported to JSX),
// themed via --chart-* tokens and wired to the app's real OHLC path.

// Palette presets (explicit props beat theme vars for series colors)
// Raw hex: visx/SVG configs can't read CSS vars — tokens: --ivory, --gain, --loss.
export const CHART_THEMES = {
  landing: {
    stroke: '#ECE9E2',
    gradientFrom: 'rgba(201, 169, 110, 0.28)',
    gradientTo: 'rgba(201, 169, 110, 0)',
    up: '#4FB286',
    down: '#D9667A',
  },
  terminal: {
    stroke: '#ECE9E2',
    gradientFrom: 'rgba(201, 169, 110, 0.28)',
    gradientTo: 'rgba(201, 169, 110, 0)',
    up: '#4FB286',
    down: '#D9667A',
  },
}

// Marker consumed by Bklit's reference-area extractor (displayName-gated).
// Renders nothing itself; tints the matching y-axis tick label.
export function ReferenceArea() {
  return null
}
ReferenceArea.displayName = 'ReferenceArea'

// Horizontal annotation line + edge label, drawn from live scales.
// Horizontal annotation line + edge label, drawn from live scales.
// Default is the data-brass dashed benchmark treatment (D1).
export function ChartValueLine({ value, label, color = '#C9A96E', dashed = true, solid = false, align = 'right' }) {
  const { yScale, innerWidth, margin } = useChartStable()
  const y = yScale(value)
  if (y == null || !isFinite(y)) return null
  const yy = y + margin.top
  const atRight = align !== 'left'
  return (
    <g pointerEvents="none" aria-hidden="true">
      <line
        x1={margin.left}
        x2={margin.left + innerWidth}
        y1={yy}
        y2={yy}
        stroke={color}
        strokeWidth={solid ? 1.5 : 1}
        strokeDasharray={dashed && !solid ? '4 4' : undefined}
        opacity={solid ? 0.9 : 0.55}
      />
      {label ? (
        <text
          x={atRight ? margin.left + innerWidth - 4 : margin.left + 4}
          y={yy - 6}
          textAnchor={atRight ? 'end' : 'start'}
          fill={color}
          fontSize={10}
          fontFamily="'Geist Variable', 'Geist', system-ui, sans-serif"
          opacity={0.9}
        >
          {label}
        </text>
      ) : null}
    </g>
  )
}

// ── Price-domain rules (D1) ──────────────────────────────────────
// Range-driven tick precision: decimals derive from the visible span so
// adjacent axis labels always differ (step ≥$10 → whole dollars;
// $1 ≤ step <$10 → 1 decimal; step <$1 → cents). Tooltips/headers always
// show cents regardless — this is axis labels only.
export function priceAxisFormat(lo, hi) {
  const span = Math.max(Math.abs(hi - lo), 1e-9)
  const step = span / 5
  const decimals = step >= 10 ? 0 : step >= 1 ? 1 : 2
  return (v) => `$${Number(v).toFixed(decimals)}`
}

// Compressed-scale detection: when the visible range is under 0.5% of mid,
// the domain snaps to mid ± 0.5% and callers caption it
// ("Compressed scale — price moved <0.5% in view"). Zero is never forced
// into a price-line domain; bar/proportion charts keep their zero baseline
// via the yScaleDomainMax path in the shell.
export function priceDomain(values) {
  const nums = values.map(Number).filter((v) => Number.isFinite(v))
  if (!nums.length) return { lo: 0, hi: 100, compressed: false }
  let lo = Math.min(...nums)
  let hi = Math.max(...nums)
  let compressed = false
  const mid = (lo + hi) / 2
  if (mid > 0 && hi - lo < mid * 0.005) {
    lo = mid * 0.995
    hi = mid * 1.005
    compressed = true
  }
  const pad = Math.max((hi - lo) * 0.08, 0.02)
  return { lo: lo - pad, hi: hi + pad, compressed }
}

// Composable price area chart. `data`: [{ date: Date, [yKey]: number }].
export function PriceAreaChart({
  data,
  yKey = 'price',
  theme = CHART_THEMES.landing,
  height,
  aspectRatio = '2 / 1',
  showAxes = false,
  showTooltip = true,
  status,
  loadingLabel,
  formatY,
  className = '',
  children,
  animationDuration = 0,
}) {
  // Unique gradient id per instance — the Bklit primitives use useId() for
  // defs; a hardcoded id collides document-wide and every chart steals the
  // first instance's colors.
  const gradientId = `mf-area-fill-${useId().replace(/:/g, '')}`
  // Range-driven axis labels (D1): derived from the visible values so a flat
  // series never renders a column of identical "$23" labels.
  const extent = useMemo(() => {
    const vals = (data || []).map((d) => Number(d?.[yKey])).filter(Number.isFinite)
    if (!vals.length) return null
    return { lo: Math.min(...vals), hi: Math.max(...vals) }
  }, [data, yKey])
  return (
    <AreaChart
      data={data}
      className={className}
      aspectRatio={aspectRatio}
      animationDuration={animationDuration}
      style={height ? { height, aspectRatio: 'auto' } : undefined}
      status={status}
      loadingLabel={loadingLabel}
      margin={{ top: 12, right: showAxes ? 48 : 12, bottom: showAxes ? 28 : 8, left: showAxes ? 44 : 8 }}
    >
      <LinearGradient id={gradientId} from={theme.gradientFrom} to={theme.gradientTo} />
      <Grid vertical={false} />
      <Area dataKey={yKey} stroke={theme.stroke} strokeWidth={2} fill={`url(#${gradientId})`} fillOpacity={1} gradientToOpacity={0} />
      {showAxes ? (
        <>
          <XAxis />
          <YAxis orientation="right" formatValue={formatY ?? (extent ? priceAxisFormat(extent.lo, extent.hi) : (v) => `$${Number(v).toFixed(2)}`)} />
        </>
      ) : null}
      {showTooltip ? <ChartTooltip /> : null}
      {children}
    </AreaChart>
  )
}

// Composable OHLC candlestick chart. `data`: [{ date, open, high, low, close }].
export function MarketCandles({
  data,
  theme = CHART_THEMES.landing,
  height,
  aspectRatio = '2 / 1',
  className = '',
  children,
}) {
  const extent = useMemo(() => {
    const vals = (data || []).flatMap((d) => [Number(d?.low), Number(d?.high)]).filter(Number.isFinite)
    if (!vals.length) return null
    return { lo: Math.min(...vals), hi: Math.max(...vals) }
  }, [data])
  return (
    <CandlestickChart
      data={data}
      className={className}
      aspectRatio={aspectRatio}
      style={height ? { height, aspectRatio: 'auto' } : undefined}
      margin={{ top: 12, right: 56, bottom: 28, left: 8 }}
    >
      <Grid vertical={false} />
      <Candlestick positiveFill={theme.up} negativeFill={theme.down} />
      <XAxis />
      <YAxis orientation="right" formatValue={extent ? priceAxisFormat(extent.lo, extent.hi) : (v) => `$${Number(v).toFixed(2)}`} />
      <ChartTooltip />
      {children}
    </CandlestickChart>
  )
}

// Deterministic PRNG (mulberry32) for the offline sample fallback.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE_PRICE = { NVDA: 942, AAPL: 227, MSFT: 415, GOOGL: 173, AMZN: 198, TSLA: 171 }

// Offline sample series — same OHLC shape as the live path, used ONLY when
// the backend is unreachable. Deterministic per symbol (not random decor).
// `stepMs` lets the 1D fallback use intraday spacing; everything else is daily.
export function seedOhlcSeries(symbol = 'NVDA', points = 90, stepMs = 86400000) {
  const rand = rng([...String(symbol)].reduce((a, c) => a + c.charCodeAt(0), 7))
  const base = BASE_PRICE[symbol] ?? 100
  const rows = []
  let price = base * (0.82 + rand() * 0.08)
  const now = Date.now()
  for (let i = points - 1; i >= 0; i--) {
    const drift = (rand() - 0.46) * base * 0.022
    const open = price
    const close = Math.max(base * 0.1, open + drift)
    const high = Math.max(open, close) * (1 + rand() * 0.008)
    const low = Math.min(open, close) * (1 - rand() * 0.008)
    rows.unshift({
      date: new Date(now - i * stepMs),
      open, high, low, close, price: close,
    })
    price = close
  }
  return rows
}

// Day-window per range, mirroring TerminalCharts.sliceHistoryByRange cutoffs
// (backend serves 2 real windows — daily ALL + 60m 1D — everything else is a
// client-side slice of the daily series, same mechanism as Markets).
const RANGE_DAYS = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': Infinity }
// Offline fallback lengths per range (daily spacing, except 1D intraday).
const FALLBACK_POINTS = { '1D': 78, '1W': 7, '1M': 30, '3M': 90, '6M': 126, '1Y': 252, 'ALL': 90 }

function sliceRowsByRange(rows, range) {
  const days = RANGE_DAYS[range] ?? Infinity
  if (days === Infinity || !rows.length) return rows
  const last = Math.max(...rows.map((d) => d.date.getTime()))
  const cutoff = last - days * 86400000
  return rows.filter((d) => d.date.getTime() >= cutoff)
}

// Live-first OHLC hook: backend history via tradeStore, seeded fallback offline.
// Every range yields a genuinely different window: 1D uses the 60m intraday
// series, all other ranges are day-window slices of the daily series.
// D10 data-behavior contract:
// - States: loading | verified | insufficient | error | sample | stale.
//   `verified` means genuine history was fetched for this symbol|range — it
//   does NOT claim live market delivery. Seed rows are reachable ONLY in
//   `sample` (offline), never silently.
// - Race-safe: a monotonic per-hook sequence drops superseded resolutions, so
//   a slow response for symbol A never renders under symbol B's header.
// - Symbol change clears to skeleton; same-symbol range change keeps prior
//   rows dimmed (pending) until the new window lands, then swaps atomically.
// - Hidden-tab: no fetch while hidden (one-shot visibility listener defers
//   the initial fetch until visible). Superseded responses are dropped by
//   the per-hook sequence guard; completed responses populate the shared
//   cache. A separate TTL-gated listener refetches once on visible when the
//   entry expired (no polling).
// - Backward compatible: { rows, prices, live } are still returned
//   (`live` is an alias for state === 'verified').
// `keepPrevious` switches the symbol-change behavior to dimmed-keep. No
// in-scope consumer uses it yet (authenticated terminals use TerminalCharts
// directly); it is kept as a tested hook option for that future migration.
export function useOhlcSeries(symbol, range = 'ALL', points = 90, opts = {}) {
  const { keepPrevious = false } = opts
  const fetchHistory = useTrade((s) => s.fetchHistory)
  const [rows, setRows] = useState([])
  const [state, setState] = useState('loading')
  const [seriesAsOf, setSeriesAsOf] = useState(0)
  const [seriesStale, setSeriesStale] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const seqRef = useRef(0)
  const key = String(range || 'ALL').toUpperCase()

  const retry = useCallback(() => setRetryNonce((n) => n + 1), [])
  // Row-count ref (review finding): the effect closure's `rows` goes stale
  // across symbol switches (`rows` is intentionally excluded from deps), so
  // the failure path reads this ref instead of the closure.
  const rowsRef = useRef([])
  const setTrackedRows = (next) => {
    rowsRef.current = next
    setRows(next)
  }
  // Freshness mirror for the revalidation listener (avoids state deps).
  const seriesAsOfRef = useRef(0)
  const setTrackedAsOf = (ts) => {
    seriesAsOfRef.current = ts
    setSeriesAsOf(ts)
  }

  // Visible revalidation: a hidden->visible transition refetches once
  // when the entry outlived its TTL — otherwise the cached rows stand.
  // Range TTLs mirror the store through the shared historyCachePolicy.
  const ttlMs = historyTtlMs(key)
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // Skip while a fetch for this key is already running — rapid tab
      // toggles must not fan out duplicate requests.
      const loadingMap = useTrade.getState().historyLoading || {}
      if (loadingMap[`${symbol}|${key}`]) return
      if (Date.now() - (seriesAsOfRef.current || 0) > ttlMs) retry()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [symbol, key, ttlMs, retry])

  useEffect(() => {
    const seq = ++seqRef.current
    const ctrl = new AbortController()
    let visibleListener = null
    let on = true

    // Symbol switches clear to skeleton (landing default); same-symbol range
    // changes keep prior rows dimmed under a pending overlay.
    setError('')
    setSeriesStale(false)
    const hadRows = rowsRef.current.length > 3
    if (!keepPrevious || !hadRows) {
      setTrackedRows([])
      setPending(false)
      setState('loading')
    } else {
      setPending(true)
    }

    const run = async () => {
      const fallbackSample = () => {
        if (seq !== seqRef.current || !on) return
        const n = FALLBACK_POINTS[key] ?? points
        setTrackedRows(seedOhlcSeries(symbol, n, key === '1D' ? 5 * 60000 : 86400000))
        setTrackedAsOf(0)
        setSeriesStale(false)
        setPending(false)
        setState('sample')
      }
      let res
      let data = []
      try {
        if (key === '1D') {
          res = await fetchHistory(symbol, '1D', { signal: ctrl.signal })
          // Intraday cache holds ~6 days of 60m bars — slice to the last
          // trading day so 1D means 1D (same anchoring as Markets).
          data = sliceRowsByRange(normalizeHistory(res?.data), '1D')
        } else {
          res = await fetchHistory(symbol, 'ALL', { signal: ctrl.signal })
          data = sliceRowsByRange(normalizeHistory(res?.data), key)
        }
      } catch {
        if (seq !== seqRef.current || !on) return
        // Aborted by tab-hide: stay in loading, the visible listener refetches.
        if (ctrl.signal.aborted) return
        // A throw is NOT proof of offline (500s, malformed payloads throw
        // too) — sample only when the browser reports offline; otherwise
        // fall through to the error/stale handling below with res unset.
      }
      if (seq !== seqRef.current || !on) return
      if (ctrl.signal.aborted) return
      if (res?.aborted) return
      if (!res) {
        // Thrown request while online: error (or stale when prior rows exist).
        setError('Historical data temporarily unavailable')
        if (rowsRef.current.length > 3) {
          setSeriesStale(true)
          setPending(false)
          setState('stale')
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          fallbackSample()
        } else {
          setTrackedRows([])
          setPending(false)
          setState('error')
        }
        return
      }
      if (res?.success && data.length > 3) {
        setTrackedRows(data)
        setTrackedAsOf(Number(res.fetchedAt) || Date.now())
        setSeriesStale(false)
        setPending(false)
        setState('verified')
        return
      }
      if (res?.success) {
        // Genuine but too thin to chart — never pad with seed rows.
        setTrackedRows(data)
        setTrackedAsOf(Number(res.fetchedAt) || Date.now())
        setPending(false)
        setState('insufficient')
        return
      }
      // Failed: keep prior rows as stale when we have them (ref count,
      // not the closure — see rowsRef above).
      setError(res?.message || 'Historical data temporarily unavailable')
      if (rowsRef.current.length > 3) {
        setSeriesStale(true)
        setPending(false)
        setState('stale')
      } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        fallbackSample()
      } else {
        setTrackedRows([])
        setPending(false)
        setState('error')
      }
    }

    // Hidden-tab pause: never fetch while hidden; fetch once on visible.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      visibleListener = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', visibleListener)
          run()
        }
      }
      document.addEventListener('visibilitychange', visibleListener)
    } else {
      run()
    }
    return () => {
      on = false
      seqRef.current += 1
      ctrl.abort()
      if (visibleListener && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibleListener)
      }
    }
    // rows intentionally excluded: switching data must not refetch
    // (the effect reads row counts via rowsRef).
  }, [symbol, key, fetchHistory, points, keepPrevious, retryNonce])

  const prices = useMemo(() => rows.map(({ date, price }) => ({ date, price })), [rows])
  const live = state === 'verified'
  return { rows, prices, live, state, seriesAsOf, seriesStale, error, pending, retry }
}

function normalizeHistory(list) {
  return (list || [])
    .map((d) => ({
      date: new Date(d.timestamp ?? d.date),
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
    }))
    .filter((d) => d.date.toString() !== 'Invalid Date' && isFinite(d.close))
    .map((d) => ({ ...d, price: d.close }))
}
