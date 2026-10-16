/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { PriceAreaChart, MarketCandles, CHART_THEMES } from './charts/market-charts'

const FINANCIAL_COLORS = {
  positive: 'var(--chart-profit)',
  negative: 'var(--chart-loss)',
  blue: 'var(--chart-primary)',
  neutral: 'var(--text-muted)'
}


const buildSmoothPath = (points) => {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`

    const previous = points[index - 1]
    const next = points[index + 1] || point
    const beforePrevious = points[index - 2] || previous
    const smoothing = 0.18
    const cp1x = previous.x + (point.x - beforePrevious.x) * smoothing
    const cp1y = previous.y + (point.y - beforePrevious.y) * smoothing
    const cp2x = point.x - (next.x - previous.x) * smoothing
    const cp2y = point.y - (next.y - previous.y) * smoothing

    return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(
      2
    )}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')
}


// ─── Slice raw backend OHLC history by range ─────────────────────────────────
export function sliceHistoryByRange(rawData = [], range = '1M') {
  if (!rawData.length) return []

  const cutoffs = {
    '1D':  1,
    '1W':  7,
    '1M':  30,
    '3M':  90,
    '6M':  180,
    '1Y':  365,
    'ALL': Infinity,
  }

  const days = cutoffs[range] ?? 30
  // Anchor the window to the latest available bar (not wall-clock now) so
  // weekends/before-open don't silently drop the most recent data.
  const lastTs = Math.max(...rawData.map(d => new Date(d.timestamp).getTime()))
  const cutoff = days === Infinity ? new Date(0) : new Date(lastTs - days * 24 * 60 * 60 * 1000)

  return rawData
    .filter(d => new Date(d.timestamp) >= cutoff)
    .map(d => ({
      // Preserve the time key: Bklit-backed normalizers (normalizeOhlcRows /
      // normalizeSeriesRows) require timestamp ?? date — dropping it renders
      // every chart empty against live data (audit fix, Sep 2026).
      timestamp: d.timestamp,
      date: new Date(d.timestamp),
      open:    Number(d.open),
      close:   Number(d.close),
      high:    Number(d.high),
      low:     Number(d.low),
      value:   Number(d.close),
      label:   range === '1D'
        ? new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bullish: d.close >= d.open
    }))
}

// ─── Chart states ─────────────────────────────────────────────────────
// The vendored core only knows loading vs ready, so loading/empty/failed/
// stale/insufficient/sample are resolved HERE at the adapter layer and
// rendered as distinct accessible states around the chart. Never pass
// 'ready' with zero plottable points; never render 'loading' for empty data.
export const CHART_MIN_POINTS = 2

function ChartMessage({ label, title, body, actionLabel, onAction, height }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-4 text-center"
      style={{ height }}
      role={actionLabel ? 'alert' : 'status'}
      aria-label={label ? `${label}: ${title}` : title}
    >
      <p className="text-xs font-medium text-[var(--stone)]">{title}</p>
      {body && <p className="max-w-xs text-xs text-[var(--stone-muted)]">{body}</p>}
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 rounded-lg border border-[var(--hairline)] bg-[var(--ink-900)] px-3 py-1.5 text-xs font-medium text-[var(--ivory)] transition-colors hover:border-[var(--hairline-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

function ChartBadge({ children }) {
  return (
    <span className="absolute right-2 top-2 z-10 rounded-md border border-[var(--hairline)] bg-[var(--ink-900)]/90 px-2 py-0.5 text-[11px] font-medium text-[var(--stone)]">
      {children}
    </span>
  )
}

function resolveStatus(explicit, rows) {
  if (explicit) return explicit
  if (!rows.length) return 'empty'
  if (rows.length < CHART_MIN_POINTS) return 'insufficient'
  return 'ready'
}

// ─── Candlestick Chart (Bklit-backed) ───────────────────────────────────
// Same props as before; renders Bklit's candlestick system in terminal theme.
export function CandleChart({
  data = [],
  height = 280,
  label = 'Candlestick',
  status: statusProp,
  onRetry
}) {
  const rows = useMemo(() => normalizeOhlcRows(data), [data])
  const status = resolveStatus(statusProp, rows)
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--stone)]" style={{ height }} role="status" aria-label={`${label}: loading`}>
        Loading market data…
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <ChartMessage
        label={label}
        height={height}
        title="Chart unavailable"
        body="Historical data could not be loaded. Prices above still show the latest quote."
        actionLabel="Retry"
        onAction={onRetry}
      />
    )
  }
  if (status === 'empty' || status === 'insufficient') {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--stone-muted)]" style={{ height }} role="img" aria-label={`${label}: no data`}>
        {status === 'empty' ? 'No chart data available' : 'Not enough points to draw this range'}
      </div>
    )
  }
  return (
    <div className="relative">
      {status === 'stale' && <ChartBadge>Stale</ChartBadge>}
      {status === 'sample' && <ChartBadge>Sample</ChartBadge>}
      <MarketCandles data={rows} theme={CHART_THEMES.terminal} height={height} />
    </div>
  )
}

// ─── Line Chart (Bklit-backed) ──────────────────────────────────────────
// Same props as before (data, dataKey, height, tone, color, label,
// valuePrefix, yAxisLabel, showGrid); zoom/pan model replaced by Bklit's
// hover crosshair + tooltip + brush interaction.
export function TerminalLineChart({
  data = [],
  dataKey = 'value',
  height = 260,
  tone = 'positive',
  color: propColor,
  label = 'Value',
  valuePrefix = '$',
  showGrid = true,
  status: statusProp,
  onRetry
}) {
  const rows = useMemo(() => normalizeSeriesRows(data, dataKey), [data, dataKey])
  const status = resolveStatus(statusProp, rows)
  const stroke = propColor || FINANCIAL_COLORS[tone] || FINANCIAL_COLORS.positive
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--stone)]" style={{ height }} role="status" aria-label={`${label}: loading`}>
        Loading market data…
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <ChartMessage
        label={label}
        height={height}
        title="Chart unavailable"
        body="Performance data could not be loaded. Figures above use the latest portfolio snapshot."
        actionLabel="Retry"
        onAction={onRetry}
      />
    )
  }
  if (status === 'empty' || status === 'insufficient') {
    return (
      <div className="flex items-center justify-center text-xs text-[var(--stone-muted)]" style={{ height }} role="img" aria-label={`${label}: no data`}>
        {status === 'empty' ? 'No chart data available' : 'Not enough points to draw this range'}
      </div>
    )
  }
  return (
    <div className="relative">
      {status === 'stale' && <ChartBadge>Stale</ChartBadge>}
      {status === 'sample' && <ChartBadge>Sample</ChartBadge>}
      <PriceAreaChart
        data={rows}
        yKey="v"
        theme={{ ...CHART_THEMES.terminal, stroke }}
        height={height}
        showAxes={showGrid !== false}
        formatY={(v) => `${valuePrefix}${Number(v).toFixed(0)}`}
        status="ready"
        loadingLabel="Loading market data"
      />
    </div>
  )
}

// ─── Bklit row normalizers (defensive across backend shapes) ────────────
function toValidDate(value) {
  const t = new Date(value)
  return Number.isNaN(t.getTime()) ? null : t
}

function normalizeSeriesRows(data, dataKey = 'value') {
  if (!Array.isArray(data)) return []
  const rows = []
  for (const d of data) {
    if (d == null) continue
    const date = toValidDate(d.timestamp ?? d.date)
    const v = Number(d[dataKey] ?? d.close ?? d.value)
    if (date && isFinite(v)) rows.push({ date, v })
  }
  return rows
}

function normalizeOhlcRows(data) {
  if (!Array.isArray(data)) return []
  const rows = []
  for (const d of data) {
    if (d == null) continue
    const date = toValidDate(d.timestamp ?? d.date)
    const open = Number(d.open)
    const high = Number(d.high)
    const low = Number(d.low)
    const close = Number(d.close)
    if (date && [open, high, low, close].every(isFinite)) {
      rows.push({ date, open, high, low, close })
    }
  }
  return rows
}

export function Sparkline({ data = [], positive = true, color: propColor }) {
  const model = useMemo(() => {
    if (!data.length) return null
    const values = data.map((item) => Number(item.value ?? item ?? 0))
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const padding = rawMax === rawMin ? Math.max(Math.abs(rawMax) * 0.08, 1) : (rawMax - rawMin) * 0.12
    const min = rawMin - padding
    const max = rawMax + padding
    const points = values.map((val, index) => ({
      x: 4 + (index / Math.max(1, values.length - 1)) * 172,
      y: 50 - ((Number(val || 0) - min) / (max - min || 1)) * 46
    }))
    return {
      points,
      path: buildSmoothPath(points)
    }
  }, [data])
  const color = propColor || (positive ? 'var(--chart-profit)' : 'var(--chart-loss)')

  return (
    <svg className="sparkline" viewBox="0 0 180 54" aria-hidden="true">
      {model ? (
        <path
          d={model.path}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      ) : null}
    </svg>
  )
}


