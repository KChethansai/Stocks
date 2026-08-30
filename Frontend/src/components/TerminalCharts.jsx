/* eslint-disable react-refresh/only-export-components */
import { useId, useMemo, useState, useRef, useEffect } from 'react'
import { formatCurrency } from '../utils/marketAnalytics'

const CHART_WIDTH = 720
const CHART_PADDING = {
  top: 22,
  right: 18,
  bottom: 36,
  left: 58
}

const FINANCIAL_COLORS = {
  positive: 'var(--chart-profit)',
  negative: 'var(--chart-loss)',
  blue: 'var(--chart-primary)',
  neutral: 'var(--text-muted)'
}

const ALLOCATION_COLORS = [
  '#38bdf8',
  '#22c55e',
  '#f59e0b',
  '#a78bfa',
  '#f43f5e',
  '#14b8a6',
  '#eab308',
  '#fb7185'
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getChartBounds = (width, height) => ({
  x1: CHART_PADDING.left,
  x2: width - CHART_PADDING.right,
  y1: CHART_PADDING.top,
  y2: height - CHART_PADDING.bottom
})

const formatAxisValue = (value, prefix = '$') => {
  const number = Number(value || 0)
  const sign = number < 0 ? '-' : ''
  const absolute = Math.abs(number)

  if (absolute >= 1_000_000) return `${sign}${prefix}${(absolute / 1_000_000).toFixed(1)}M`
  if (absolute >= 1_000) return `${sign}${prefix}${(absolute / 1_000).toFixed(1)}K`
  if (absolute >= 100) return `${sign}${prefix}${absolute.toFixed(0)}`
  return `${sign}${prefix}${absolute.toFixed(2)}`
}

const formatPointValue = (value, prefix = '$') => {
  const number = Number(value || 0)
  const sign = number < 0 ? '-' : ''
  return `${sign}${prefix}${Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const formatLabel = (label, index, total) => {
  if (label === undefined || label === null) return `Point ${index + 1}`
  const value = String(label)
  const trailing = value.match(/^T-(\d+)$/)
  if (trailing) {
    const days = Number(trailing[1])
    const date = new Date()
    date.setDate(date.getDate() - (days - 1))
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (/^\d{1,2}:00$/.test(value)) return value.padStart(5, '0')
  if (/^\d+$/.test(value) && total > 12) return `#${value}`
  return value
}

const getScale = (data, key, width, height) => {
  const bounds = getChartBounds(width, height)
  const values = data.map((item) => Number(item[key] || 0))
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const rawRange = rawMax - rawMin
  const padding = rawRange === 0 ? Math.max(Math.abs(rawMax) * 0.08, 1) : rawRange * 0.12
  const min = rawMin - padding
  const max = rawMax + padding
  const range = max - min || 1

  return {
    ...bounds,
    min,
    max,
    x: (index) => bounds.x1 + (index / Math.max(1, data.length - 1)) * (bounds.x2 - bounds.x1),
    y: (value) => bounds.y2 - ((Number(value || 0) - min) / range) * (bounds.y2 - bounds.y1)
  }
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

const buildArea = (path, points, scale) => {
  if (!path || !points.length) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${path} L ${last.x.toFixed(2)} ${scale.y2.toFixed(2)} L ${first.x.toFixed(2)} ${scale.y2.toFixed(2)} Z`
}

const getTicks = (min, max, count = 5) =>
  Array.from({ length: count }, (_, index) => min + ((max - min) / Math.max(1, count - 1)) * index)

const getXTicks = (data) => {
  if (data.length <= 1) return [0]
  const tickCount = Math.min(5, data.length)
  return Array.from({ length: tickCount }, (_, index) =>
    Math.round((index / Math.max(1, tickCount - 1)) * (data.length - 1))
  ).filter((value, index, values) => values.indexOf(value) === index)
}

// ─── Candle scale: Y-bounds derived from high/low across all candles ──────────
const getCandleScale = (data, width, height) => {
  const bounds = getChartBounds(width, height)
  const highs = data.map(d => Number(d.high || 0))
  const lows  = data.map(d => Number(d.low  || 0))
  const rawMax = Math.max(...highs)
  const rawMin = Math.min(...lows)
  const rawRange = rawMax - rawMin
  const padding = rawRange === 0 ? Math.max(Math.abs(rawMax) * 0.08, 1) : rawRange * 0.10
  const min = rawMin - padding
  const max = rawMax + padding
  const range = max - min || 1

  const candleCount = data.length
  const plotWidth = bounds.x2 - bounds.x1
  const candleWidth = Math.max(3, Math.min(18, (plotWidth / candleCount) * 0.65))

  return {
    ...bounds,
    min, max,
    candleWidth,
    x: (index) => bounds.x1 + ((index + 0.5) / candleCount) * plotWidth,
    y: (value) => bounds.y2 - ((Number(value || 0) - min) / range) * (bounds.y2 - bounds.y1)
  }
}

export function TimeRangeSelector({ activeRange, onRangeChange }) {
  const ranges = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL']

  return (
    <div className="terminal-range" aria-label="Chart time range">
      {ranges.map((range) => (
        <button
          key={range}
          className={activeRange === range ? 'is-active' : ''}
          onClick={() => onRangeChange(range)}
          type="button"
        >
          {range}
        </button>
      ))}
    </div>
  )
}

// ─── Generate deterministic OHLC candle data from a stock object ──────────────
// Used as fallback when real backend history is loading or unavailable.
// Anchored to the real current price so the final candle matches reality.
export function generateCandleData(stockOrPrice, range = '1M') {
  let price = 150
  let changePercent = 0
  let symbol = 'SIM'

  if (typeof stockOrPrice === 'number' || typeof stockOrPrice === 'string') {
    price = Number(stockOrPrice) || 150
  } else if (stockOrPrice && typeof stockOrPrice === 'object') {
    price = Number(stockOrPrice.price || stockOrPrice.currentPrice || 150)
    changePercent = Number(stockOrPrice.changePercent || 0)
    symbol = stockOrPrice.symbol || 'SIM'
  }

  const seed = symbol
    ? symbol.charCodeAt(0) * 31 + (symbol.charCodeAt(1) || 7)
    : 42

  const rangeMap = {
    '1D':  { candles: 24,  vol: 0.004, drift: changePercent / 100 / 24  },
    '1W':  { candles: 7,   vol: 0.010, drift: changePercent / 100 / 7   },
    '1M':  { candles: 30,  vol: 0.015, drift: changePercent / 100 / 30  },
    '3M':  { candles: 60,  vol: 0.012, drift: changePercent / 100 / 60  },
    '6M':  { candles: 90,  vol: 0.010, drift: changePercent / 100 / 90  },
    '1Y':  { candles: 120, vol: 0.008, drift: changePercent / 100 / 120 },
    'ALL': { candles: 150, vol: 0.007, drift: changePercent / 100 / 150 },
  }

  const cfg = rangeMap[range] || rangeMap['1M']

  let rng = seed
  const pseudoRandom = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    return ((rng >>> 0) / 0xffffffff)
  }

  const candles = []
  // Work backwards from current price so the last candle always matches reality
  let currentClose = price

  for (let i = cfg.candles - 1; i >= 0; i--) {
    const open = currentClose
    const bodyPct = (pseudoRandom() - 0.5) * cfg.vol * 2
    const close = open * (1 + bodyPct + cfg.drift)
    const wickUp = pseudoRandom() * cfg.vol * open
    const wickDown = pseudoRandom() * cfg.vol * open
    const high = Math.max(open, close) + wickUp
    const low = Math.min(open, close) - wickDown

    const date = new Date()
    if (range === '1D') date.setHours(date.getHours() - i)
    else date.setDate(date.getDate() - i)

    candles.push({
      open:    Number(open.toFixed(2)),
      close:   Number(close.toFixed(2)),
      high:    Number(high.toFixed(2)),
      low:     Number(low.toFixed(2)),
      label:   range === '1D'
        ? `${date.getHours()}:00`
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bullish: close >= open
    })

    currentClose = close
  }

  return candles
}

// ─── Slice raw backend OHLC history by range ─────────────────────────────────
export function sliceHistoryByRange(rawData = [], range = '1M') {
  if (!rawData.length) return []

  const now = new Date()
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
  const cutoff = days === Infinity ? new Date(0) : new Date(now - days * 24 * 60 * 60 * 1000)

  return rawData
    .filter(d => new Date(d.timestamp) >= cutoff)
    .map(d => ({
      open:    Number(d.open),
      close:   Number(d.close),
      high:    Number(d.high),
      low:     Number(d.low),
      label:   new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      bullish: d.close >= d.open
    }))
}

// ─── Candlestick Chart ────────────────────────────────────────────────────────
export function CandleChart({
  data = [],
  height = 280,
  label = 'Candlestick'
}) {
  const generatedId = useId().replace(/:/g, '')
  const [hoverIndex, setHoverIndex] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const svgRef = useRef(null)
  const isDragging = useRef(false)
  const lastMouseX = useRef(0)

  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault()
      const zoomStep = 0.15
      if (event.deltaY < 0) setZoom(v => Math.min(4, v + zoomStep))
      else if (event.deltaY > 0) setZoom(v => Math.max(1, v - zoomStep))
    }
    const svg = svgRef.current
    if (svg) svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => { if (svg) svg.removeEventListener('wheel', handleWheel) }
  }, [])

  const width = CHART_WIDTH

  const visibleData = useMemo(() => {
    const safeZoom = Math.max(1, zoom)
    const count = Math.max(4, Math.round(data.length / safeZoom))
    const endIdx = Math.min(data.length, data.length - panOffset)
    const startIdx = Math.max(0, endIdx - count)
    return data.slice(startIdx, endIdx)
  }, [data, zoom, panOffset])

  const chartModel = useMemo(() => {
    if (!visibleData.length) return null
    const scale = getCandleScale(visibleData, width, height)
    const yTicks = getTicks(scale.min, scale.max)
    const xTickIndices = getXTicks(visibleData)
    return { scale, yTicks, xTickIndices }
  }, [visibleData, width, height])

  const hovered = hoverIndex !== null ? visibleData[hoverIndex] : null

  const handlePointerDown = (e) => {
    isDragging.current = true
    lastMouseX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (isDragging.current) {
      const deltaX = e.clientX - lastMouseX.current
      lastMouseX.current = e.clientX
      const panStep = Math.round((deltaX / width) * visibleData.length)
      if (panStep !== 0) {
        setPanOffset(prev => {
          const maxPan = data.length - visibleData.length
          return clamp(prev - panStep, 0, maxPan)
        })
      }
    } else if (chartModel) {
      const rect = e.currentTarget.getBoundingClientRect()
      const plotLeft = rect.width * (CHART_PADDING.left / width)
      const plotW = rect.width * ((width - CHART_PADDING.left - CHART_PADDING.right) / width)
      const ratio = clamp((e.clientX - rect.left - plotLeft) / plotW, 0, 1)
      setHoverIndex(clamp(Math.round(ratio * (visibleData.length - 1)), 0, visibleData.length - 1))
    }
  }

  const handlePointerUp = (e) => {
    isDragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="terminal-chart-shell">
      <div className="terminal-chart-tools">
        <span>{label}</span>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom(v => Math.min(4, v + 0.5))}
            style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
            Zoom +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom(v => Math.max(1, v - 0.5))}
            style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
            Zoom -
          </button>
        </div>
      </div>

      {/* OHLC hover bar */}
      {hovered ? (
        <div style={{
          display: 'flex', gap: '1.2rem', padding: '0.4rem 0.75rem',
          fontSize: '0.68rem', color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)',
          flexWrap: 'wrap'
        }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{hovered.label}</span>
          <span>O: <strong style={{ color: 'var(--text-primary)' }}>${hovered.open.toFixed(2)}</strong></span>
          <span>H: <strong style={{ color: 'var(--chart-profit)' }}>${hovered.high.toFixed(2)}</strong></span>
          <span>L: <strong style={{ color: 'var(--chart-loss)' }}>${hovered.low.toFixed(2)}</strong></span>
          <span>C: <strong style={{ color: hovered.bullish ? 'var(--chart-profit)' : 'var(--chart-loss)' }}>${hovered.close.toFixed(2)}</strong></span>
          <span style={{ color: hovered.bullish ? 'var(--chart-profit)' : 'var(--chart-loss)', fontWeight: 700 }}>
            {hovered.bullish ? '▲' : '▼'} {Math.abs(((hovered.close - hovered.open) / hovered.open) * 100).toFixed(2)}%
          </span>
        </div>
      ) : (
        <div style={{ height: '1.9rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }} />
      )}

      <svg
        ref={svgRef}
        className="terminal-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label} candlestick chart`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { isDragging.current = false; setHoverIndex(null) }}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <filter id={`glow-c-${generatedId}`}>
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {chartModel ? (
          <g>
            <rect
              x={chartModel.scale.x1} y={chartModel.scale.y1}
              width={chartModel.scale.x2 - chartModel.scale.x1}
              height={chartModel.scale.y2 - chartModel.scale.y1}
              className="terminal-plot-area"
            />

            {/* Y-axis grid + labels */}
            {chartModel.yTicks.map((tick) => {
              const y = chartModel.scale.y(tick)
              return (
                <g key={tick}>
                  <line x1={chartModel.scale.x1} x2={chartModel.scale.x2} y1={y} y2={y} className="terminal-grid-line" />
                  <text x={CHART_PADDING.left - 10} y={y + 4} className="terminal-axis-label" textAnchor="end">
                    {formatAxisValue(tick)}
                  </text>
                </g>
              )
            })}

            {/* X-axis labels */}
            {chartModel.xTickIndices.map((index) => {
              if (!visibleData[index]) return null
              const x = chartModel.scale.x(index)
              return (
                <text key={index} x={x} y={height - 12} className="terminal-axis-label terminal-axis-label-x" textAnchor="middle">
                  {visibleData[index].label}
                </text>
              )
            })}

            {/* Candle bodies + wicks */}
            {visibleData.map((candle, index) => {
              const x = chartModel.scale.x(index)
              const cw = chartModel.scale.candleWidth
              const openY  = chartModel.scale.y(candle.open)
              const closeY = chartModel.scale.y(candle.close)
              const highY  = chartModel.scale.y(candle.high)
              const lowY   = chartModel.scale.y(candle.low)
              const bullish = candle.bullish
              const color = bullish ? 'var(--chart-profit)' : 'var(--chart-loss)'
              const bodyTop = Math.min(openY, closeY)
              const bodyHeight = Math.max(1, Math.abs(closeY - openY))
              const isHovered = hoverIndex === index

              return (
                <g key={index} filter={isHovered ? `url(#glow-c-${generatedId})` : undefined}>
                  {/* Wick */}
                  <line x1={x} x2={x} y1={highY} y2={lowY}
                    stroke={color} strokeWidth={isHovered ? 1.5 : 1} strokeOpacity={0.85}
                  />
                  {/* Body */}
                  <rect
                    x={x - cw / 2} y={bodyTop}
                    width={cw} height={bodyHeight}
                    fill={bullish ? color : 'none'}
                    stroke={color}
                    strokeWidth={bullish ? 0 : 1.2}
                    fillOpacity={bullish ? (isHovered ? 1 : 0.85) : 0}
                    rx={1}
                  />
                  {/* Hover crosshair column highlight */}
                  {isHovered && (
                    <rect
                      x={x - cw / 2 - 2} y={highY - 2}
                      width={cw + 4} height={lowY - highY + 4}
                      fill="rgba(255,255,255,0.04)"
                      stroke={color} strokeWidth={1} strokeDasharray="2 2"
                      rx={2}
                    />
                  )}
                </g>
              )
            })}

            {/* Hover crosshair vertical line */}
            {hoverIndex !== null && (
              <line
                x1={chartModel.scale.x(hoverIndex)} x2={chartModel.scale.x(hoverIndex)}
                y1={chartModel.scale.y1} y2={chartModel.scale.y2}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3"
              />
            )}
          </g>
        ) : (
          <g>
            <rect x={CHART_PADDING.left} y={CHART_PADDING.top}
              width={width - CHART_PADDING.left - CHART_PADDING.right}
              height={height - CHART_PADDING.top - CHART_PADDING.bottom}
              className="terminal-plot-area"
            />
            <text x={width / 2} y={height / 2} className="terminal-empty-chart" textAnchor="middle">
              No chart data available
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}


export function TerminalLineChart({
  data = [],
  dataKey = 'value',
  height = 260,
  tone = 'positive',
  color: propColor,
  label = 'Value',
  valuePrefix = '$'
}) {
  const generatedId = useId().replace(/:/g, '')
  const [hoverIndex, setHoverIndex] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState(0)
  const svgRef = useRef(null)

  const isDragging = useRef(false)
  const lastMouseX = useRef(0)

  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault()
      
      const zoomStep = 0.15
      if (event.deltaY < 0) {
        setZoom((value) => Math.min(4, value + zoomStep))
      } else if (event.deltaY > 0) {
        setZoom((value) => Math.max(1, value - zoomStep))
      }
    }

    const svg = svgRef.current
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      if (svg) {
        svg.removeEventListener('wheel', handleWheel)
      }
    }
  }, [])

  const width = CHART_WIDTH
  const visibleData = useMemo(() => {
    const safeZoom = Math.max(1, zoom)
    const count = Math.max(4, Math.round(data.length / safeZoom))
    const startIdx = Math.max(0, data.length - count - panOffset)
    const endIdx = Math.min(data.length, startIdx + count)
    // ensure pan doesn't go out of bounds
    const actualStartIdx = Math.max(0, endIdx - count)
    return data.slice(actualStartIdx, endIdx)
  }, [data, zoom, panOffset])

  const chartModel = useMemo(() => {
    if (!visibleData.length) return null
    const scale = getScale(visibleData, dataKey, width, height)
    const points = visibleData.map((item, index) => ({
      x: scale.x(index),
      y: scale.y(item[dataKey]),
      value: Number(item[dataKey] || 0),
      item
    }))
    const path = buildSmoothPath(points)
    const yTicks = getTicks(scale.min, scale.max)
    const xTicks = getXTicks(visibleData)

    return {
      scale,
      points,
      path,
      area: buildArea(path, points, scale),
      yTicks,
      xTicks
    }
  }, [dataKey, height, visibleData, width])

  const color = propColor || FINANCIAL_COLORS[tone] || FINANCIAL_COLORS.positive
  const hoverPoint = hoverIndex === null ? null : visibleData[hoverIndex]
  const hoverCoordinates = chartModel && hoverIndex !== null ? chartModel.points[hoverIndex] : null
  const tooltipWidth = 178
  const tooltipHeight = 70
  const tooltipX = hoverCoordinates
    ? clamp(hoverCoordinates.x + 14, CHART_PADDING.left, width - tooltipWidth - 10)
    : 0
  const tooltipY = hoverCoordinates
    ? clamp(hoverCoordinates.y - tooltipHeight - 10, 8, height - tooltipHeight - 8)
    : 0

  const updateHover = (clientX, target) => {
    if (!visibleData.length) return
    const rect = target.getBoundingClientRect()
    const plotLeft = rect.width * (CHART_PADDING.left / width)
    const plotWidth = rect.width * ((width - CHART_PADDING.left - CHART_PADDING.right) / width)
    const ratio = clamp((clientX - rect.left - plotLeft) / plotWidth, 0, 1)
    const nextIndex = Math.round(ratio * (visibleData.length - 1))
    setHoverIndex(clamp(nextIndex, 0, visibleData.length - 1))
  }

  const handlePointerDown = (event) => {
    isDragging.current = true
    lastMouseX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (isDragging.current) {
      const deltaX = event.clientX - lastMouseX.current
      lastMouseX.current = event.clientX
      // Adjust panOffset based on movement
      const panStep = Math.round((deltaX / width) * visibleData.length)
      if (panStep !== 0) {
        setPanOffset((prev) => {
          const maxPan = data.length - visibleData.length
          return clamp(prev + panStep, 0, maxPan)
        })
      }
    } else {
      updateHover(event.clientX, event.currentTarget)
    }
  }

  const handlePointerUp = (event) => {
    isDragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="terminal-chart-shell">
      <div className="terminal-chart-tools">
        <span>{label}</span>
        <div>
          <button
            aria-label="Zoom in chart"
            type="button"
            onClick={() => setZoom((value) => Math.min(4, value + 0.5))}
          >
            Zoom +
          </button>
          <button
            aria-label="Zoom out chart"
            type="button"
            onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          >
            Zoom -
          </button>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="terminal-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label} chart`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          isDragging.current = false
          setHoverIndex(null)
        }}
        style={{ touchAction: 'none' }} // Disable browser panning on touch
      >
        <defs>
          <linearGradient id={`area-${generatedId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="48%" stopColor={color} stopOpacity="0.10" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={`glow-${generatedId}`}>
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {chartModel ? (
          <g>
            <rect
              x={chartModel.scale.x1}
              y={chartModel.scale.y1}
              width={chartModel.scale.x2 - chartModel.scale.x1}
              height={chartModel.scale.y2 - chartModel.scale.y1}
              className="terminal-plot-area"
            />
            {chartModel.yTicks.map((tick) => {
              const y = chartModel.scale.y(tick)
              return (
                <g key={tick}>
                  <line
                    x1={chartModel.scale.x1}
                    x2={chartModel.scale.x2}
                    y1={y}
                    y2={y}
                    className="terminal-grid-line"
                  />
                  <text x={CHART_PADDING.left - 10} y={y + 4} className="terminal-axis-label" textAnchor="end">
                    {formatAxisValue(tick, valuePrefix)}
                  </text>
                </g>
              )
            })}
            {chartModel.xTicks.map((index) => {
              const x = chartModel.scale.x(index)
              return (
                <g key={index}>
                  <line
                    x1={x}
                    x2={x}
                    y1={chartModel.scale.y1}
                    y2={chartModel.scale.y2}
                    className="terminal-grid-line terminal-grid-line-vertical"
                  />
                  <text
                    x={x}
                    y={height - 12}
                    className="terminal-axis-label terminal-axis-label-x"
                    textAnchor={index === 0 ? 'start' : index === visibleData.length - 1 ? 'end' : 'middle'}
                  >
                    {formatLabel(visibleData[index]?.label, index, visibleData.length)}
                  </text>
                </g>
              )
            })}
            {chartModel.scale.min < 0 && chartModel.scale.max > 0 ? (
              <line
                x1={chartModel.scale.x1}
                x2={chartModel.scale.x2}
                y1={chartModel.scale.y(0)}
                y2={chartModel.scale.y(0)}
                className="terminal-zero-line"
              />
            ) : null}
            <path d={chartModel.area} fill={`url(#area-${generatedId})`} />
            <path
              d={chartModel.path}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.6"
              filter={`url(#glow-${generatedId})`}
              className="terminal-line-path"
            />
            {hoverPoint && hoverCoordinates ? (
              <>
                <line
                  x1={hoverCoordinates.x}
                  x2={hoverCoordinates.x}
                  y1={chartModel.scale.y1}
                  y2={chartModel.scale.y2}
                  className="terminal-hover-line"
                />
                <circle
                  cx={hoverCoordinates.x}
                  cy={hoverCoordinates.y}
                  r="4.5"
                  fill={color}
                  className="terminal-hover-dot"
                />
                <foreignObject x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight}>
                  <div className="terminal-tooltip">
                    <strong>{formatLabel(hoverPoint.label, hoverIndex, visibleData.length)}</strong>
                    <span>{formatPointValue(hoverPoint[dataKey], valuePrefix)}</span>
                  </div>
                </foreignObject>
              </>
            ) : null}
          </g>
        ) : (
          <g>
            <rect
              x={CHART_PADDING.left}
              y={CHART_PADDING.top}
              width={width - CHART_PADDING.left - CHART_PADDING.right}
              height={height - CHART_PADDING.top - CHART_PADDING.bottom}
              className="terminal-plot-area"
            />
            <text x={width / 2} y={height / 2} className="terminal-empty-chart" textAnchor="middle">
              No chart data available
            </text>
          </g>
        )}
      </svg>
    </div>
  )
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

export function AllocationBars({ data = [] }) {
  if (!data.length) return <p className="terminal-muted">No allocation data.</p>

  return (
    <div className="allocation-bars">
      {[...data]
        .sort((a, b) => b.percent - a.percent)
        .map((item, index) => {
          const color = ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
          const percent = clamp(Number(item.percent || 0), 0, 100)

          return (
            <div key={item.label} className="allocation-row" style={{ '--allocation-color': color }}>
              <div>
                <strong>
                  <i aria-hidden="true" />
                  {item.label}
                </strong>
                <span>{formatCurrency(item.value)}</span>
              </div>
              <div className="allocation-track">
                <span style={{ width: `${percent}%` }} />
              </div>
              <em>{Number(item.percent || 0).toFixed(1)}%</em>
            </div>
          )
        })}
    </div>
  )
}
