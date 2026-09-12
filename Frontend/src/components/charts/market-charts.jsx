import { useEffect, useMemo, useState } from 'react'
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

// ── MarketForge chart system ─────────────────────────────────────
// Bklit UI chart primitives (bklit.com/r/area-chart.json,
// bklit.com/r/candlestick-chart.json — visx-based, ported to JSX),
// themed via --chart-* tokens and wired to the app's real OHLC path.

// Palette presets (explicit props beat theme vars for series colors)
export const CHART_THEMES = {
  landing: {
    stroke: '#7ce6ff',
    gradientFrom: 'rgba(124, 230, 255, 0.35)',
    gradientTo: 'rgba(124, 230, 255, 0)',
    up: '#7ed6a3',
    down: '#e87684',
  },
  terminal: {
    stroke: '#3b82f6',
    gradientFrom: 'rgba(59, 130, 246, 0.35)',
    gradientTo: 'rgba(59, 130, 246, 0)',
    up: '#22c55e',
    down: '#ef4444',
  },
}

// Marker consumed by Bklit's reference-area extractor (displayName-gated).
// Renders nothing itself; tints the matching y-axis tick label.
export function ReferenceArea() {
  return null
}
ReferenceArea.displayName = 'ReferenceArea'

// Horizontal annotation line + edge label, drawn from live scales.
export function ChartValueLine({ value, label, color = '#7ce6ff', dashed = true, solid = false, align = 'right' }) {
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
          fontFamily="monospace"
          opacity={0.9}
        >
          {label}
        </text>
      ) : null}
    </g>
  )
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
      <LinearGradient id="mf-area-fill" from={theme.gradientFrom} to={theme.gradientTo} />
      <Grid vertical={false} />
      <Area dataKey={yKey} stroke={theme.stroke} strokeWidth={2} fill="url(#mf-area-fill)" fillOpacity={1} gradientToOpacity={0} />
      {showAxes ? (
        <>
          <XAxis />
          <YAxis orientation="right" formatValue={formatY ?? ((v) => `$${Number(v).toFixed(0)}`)} />
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
      <YAxis orientation="right" formatValue={(v) => `$${Number(v).toFixed(0)}`} />
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
export function useOhlcSeries(symbol, range = 'ALL', points = 90) {
  const fetchHistory = useTrade((s) => s.fetchHistory)
  const [rows, setRows] = useState([])
  const [live, setLive] = useState(false)
  const key = String(range || 'ALL').toUpperCase()

  useEffect(() => {
    let on = true
    setRows([])
    setLive(false)
    ;(async () => {
      const fallback = () => {
        const n = FALLBACK_POINTS[key] ?? points
        setRows(seedOhlcSeries(symbol, n, key === '1D' ? 5 * 60000 : 86400000))
        setLive(false)
      }
      try {
        if (key === '1D') {
          const res = await fetchHistory(symbol, '1D')
          // Intraday cache holds ~6 days of 60m bars — slice to the last
          // trading day so 1D means 1D (same anchoring as Markets).
          const data = sliceRowsByRange(normalizeHistory(res?.data), '1D')
          if (data.length > 3) {
            if (on) {
              setRows(data)
              setLive(true)
            }
            return
          }
        } else {
          const res = await fetchHistory(symbol, 'ALL')
          const sliced = sliceRowsByRange(normalizeHistory(res?.data), key)
          if (sliced.length > 3) {
            if (on) {
              setRows(sliced)
              setLive(true)
            }
            return
          }
        }
        if (on) fallback()
      } catch {
        if (on) fallback()
      }
    })()
    return () => {
      on = false
    }
  }, [symbol, key, fetchHistory, points])

  const prices = useMemo(() => rows.map(({ date, price }) => ({ date, price })), [rows])
  return { rows, prices, live }
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
