// ── Sector allocation donut ──────────────────────────────────────────
// Ported from Bklit UI pie-chart (bklit.com/r/pie-chart.json — visx-based,
// composable PieChart + PieSlice + PieCenter), the same library family as the
// project's ported area/candlestick charts. Slimmed for this codebase:
// fixed-size (no ParentSize), single context, plain-text center (no
// @number-flow dependency), palette via explicit props (same rationale as
// CHART_THEMES in market-charts.jsx), calm mode for reduced-motion.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Group } from '@visx/group'
import { arc as arcGenerator } from '@visx/shape'
import { pie as d3Pie } from 'd3-shape'
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'motion/react'
import { EASING } from '../../lib/motion'

// Categorical palettes — cyan for landing, blue for the authenticated
// workspace (per the A3 accent split). Order matches existing usage:
// primary, positive, secondary, muted, faint.
export const SECTOR_THEMES = {
  landing: ['#7ce6ff', '#7ed6a3', '#2eafff', '#96cdde', '#84949e'],
  terminal: ['#3B82F6', '#22C55E', '#60A5FA', '#9CA3AF', '#8A93A6'],
}

function arcPath(innerRadius, outerRadius, startAngle, endAngle, cornerRadius, padAngle) {
  return (
    arcGenerator({
      innerRadius,
      outerRadius,
      cornerRadius,
      padAngle,
    })({ startAngle, endAngle }) || ''
  )
}

function sliceOffset(startAngle, endAngle, distance) {
  const mid = (startAngle + endAngle) / 2
  return { x: Math.sin(mid) * distance, y: -Math.cos(mid) * distance }
}

const DonutContext = createContext(null)
function useDonut() {
  const ctx = useContext(DonutContext)
  if (!ctx) throw new Error('Donut components must be used within <DonutChart>.')
  return ctx
}

function isCenter(child) {
  return (
    child?.type?.displayName === 'DonutCenter' || child?.type?.name === 'DonutCenter'
  )
}

export function DonutChart({
  data,
  size = 160,
  innerRadius,
  padAngle = 0.025,
  cornerRadius = 3,
  hoverOffset = 6,
  palette = SECTOR_THEMES.terminal,
  calm = false,
  className = '',
  label = 'Sector allocation donut chart',
  children,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const totalValue = useMemo(
    () => data.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
    [data]
  )

  const arcs = useMemo(() => {
    const gen = d3Pie()
      .value((d) => Number(d.value) || 0)
      .startAngle(-Math.PI / 2)
      .endAngle((3 * Math.PI) / 2)
      .padAngle(padAngle)
      .sort(null)
    return gen(data).map((a, index) => ({
      data: a.data,
      index,
      startAngle: a.startAngle,
      endAngle: a.endAngle,
      padAngle: a.padAngle,
    }))
  }, [data, padAngle])

  const getColor = (index) =>
    data[index]?.color || palette[index % palette.length]

  const outerRadius = size / 2 - hoverOffset
  const inner = innerRadius ?? Math.round(size * 0.33)

  const centerKids = []
  const svgKids = []
  ;(Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child && typeof child === 'object' && isCenter(child)) centerKids.push(child)
    else if (child != null) svgKids.push(child)
  })

  const value = useMemo(
    () => ({
      data,
      arcs,
      totalValue,
      outerRadius,
      innerRadius: inner,
      cornerRadius,
      hoverOffset,
      hoveredIndex,
      setHoveredIndex,
      getColor,
      calm,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, arcs, totalValue, outerRadius, inner, cornerRadius, hoverOffset, hoveredIndex, calm]
  )

  return (
    <DonutContext.Provider value={value}>
      {/* CSS-grid stacking layers HTML center over SVG (Bklit avoids
          foreignObject for Safari); svg is the labelled image. */}
      <div
        className={`grid ${className}`}
        style={{
          gridTemplateColumns: '1fr',
          gridTemplateRows: '1fr',
          width: size,
          height: size,
        }}
      >
        <svg
          role="img"
          aria-label={label}
          width={size}
          height={size}
          style={{ gridArea: '1 / 1' }}
        >
          <Group left={size / 2} top={size / 2}>
            {data.map((_, index) => (
              <DonutSlice key={data[index]?.label ?? index} index={index} />
            ))}
            {svgKids}
          </Group>
        </svg>
        {centerKids.length > 0 && (
          <div
            className="pointer-events-none flex items-center justify-center"
            style={{ gridArea: '1 / 1' }}
          >
            {centerKids}
          </div>
        )}
      </div>
    </DonutContext.Provider>
  )
}
DonutChart.displayName = 'DonutChart'

export function DonutSlice({ index }) {
  const {
    arcs,
    outerRadius,
    innerRadius,
    cornerRadius,
    hoverOffset,
    hoveredIndex,
    setHoveredIndex,
    getColor,
    calm,
  } = useDonut()

  const arcData = arcs[index]
  const startAngle = arcData?.startAngle ?? 0
  const endAngle = arcData?.endAngle ?? 0
  const padAngle = arcData?.padAngle ?? 0

  // All hooks run unconditionally — arcData only gates rendering below.
  const progress = useMotionValue(calm ? 1 : 0)
  const [entered, setEntered] = useState(calm)

  useEffect(() => {
    if (calm) return
    const controls = animate(progress, 1, {
      duration: 0.7,
      delay: 0.1 + index * 0.08,
      ease: EASING.contentReveal,
    })
    return () => controls.stop()
  }, [progress, index, calm])

  useMotionValueEvent(progress, 'change', (v) => {
    if (v >= 1) setEntered(true)
  })

  const sweepPath = useTransform(progress, (m) =>
    arcPath(
      innerRadius,
      outerRadius,
      startAngle,
      startAngle + (endAngle - startAngle) * m,
      cornerRadius,
      padAngle
    )
  )

  if (!arcData) return null
  const color = getColor(index)
  const isHovered = hoveredIndex === index
  const isFaded = hoveredIndex !== null && !isHovered
  const offset = sliceOffset(startAngle, endAngle, hoverOffset)
  const fullPath = arcPath(
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle
  )

  return (
    <g style={{ cursor: 'pointer' }}>
      <path
        d={fullPath}
        fill="transparent"
        tabIndex={0}
        role="button"
        aria-label={`${arcData.data.label}`}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
        onFocus={() => setHoveredIndex(index)}
        onBlur={() => setHoveredIndex(null)}
      />
      <motion.path
        d={entered ? fullPath : sweepPath}
        fill={color}
        opacity={isFaded ? 0.35 : 1}
        pointerEvents="none"
        animate={{ x: isHovered ? offset.x : 0, y: isHovered ? offset.y : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          filter: isHovered ? `drop-shadow(0 0 10px ${color})` : 'none',
        }}
      />
    </g>
  )
}
DonutSlice.displayName = 'DonutSlice'

export function DonutCenter({
  defaultLabel = 'Total',
  defaultValue = '',
  children,
  className = '',
}) {
  const { data, totalValue, innerRadius, hoveredIndex } = useDonut()
  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null
  const centerSize = innerRadius * 2 - 16
  if (innerRadius <= 0) return null

  // Custom render wins on hover (Bklit pattern); default shows the total.
  const body =
    children && hovered ? (
      children({
        value: hovered.value,
        label: hovered.label,
        display: hovered.display,
        isHovered: true,
        data: hovered,
      })
    ) : (
      <>
        <div className="font-mono font-bold text-text-primary leading-none text-[15px]">
          {defaultValue || totalValue.toLocaleString()}
        </div>
        <div className="mf-label mt-1">
          {defaultLabel}
        </div>
      </>
    )

  // Announce hovered slice to screen readers via aria-live.
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${className}`}
      style={{ width: centerSize, height: centerSize }}
      aria-live="polite"
    >
      {body}
    </div>
  )
}
DonutCenter.displayName = 'DonutCenter'

// ── Project wrapper: donut + legend ────────────────────────────────
// `items`: [{ label, value, display, color? }] where `display` is the
// preformatted figure shown in legend + center (e.g. "42.5%").
// `totalDisplay`: center figure when nothing hovered (e.g. "$12,340").
export function SectorAllocation({
  items,
  palette = SECTOR_THEMES.terminal,
  size = 150,
  totalDisplay = '',
  totalLabel = 'Total',
  legendLimit = 5,
  emptyLabel = 'No positions yet — allocation appears after your first trade.',
  calm: calmProp,
  // 'row': legend beside the donut (wide cards). 'column': legend below,
  // full-width with no truncation (narrow cards / long sector names).
  layout = 'row',
  className = '',
}) {
  // No plumbing needed at call sites: fall back to the OS setting so
  // reduced-motion users get static slices everywhere.
  const calm =
    calmProp ??
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  if (!items || items.length === 0) {
    return <p className="font-mono text-xs text-text-muted">{emptyLabel}</p>
  }
  const shown = items.slice(0, legendLimit)
  const column = layout === 'column'
  return (
    <div className={`flex ${column ? 'flex-col gap-4' : 'flex-row items-center gap-5'} ${className}`}>
      <DonutChart
        data={shown}
        size={size}
        palette={palette}
        calm={calm}
        className="shrink-0"
      >
        <DonutCenter defaultLabel={totalLabel} defaultValue={totalDisplay}>
          {({ display, label }) => (
            <>
              <div className="font-mono font-bold text-text-primary leading-none text-[15px]">
                {display}
              </div>
              <div className="mf-label mt-1 truncate max-w-full px-1">
                {label}
              </div>
            </>
          )}
        </DonutCenter>
      </DonutChart>
      <div className={`font-mono text-xs min-w-0 ${column ? 'w-full space-y-2' : 'flex-1 space-y-1.5'}`}>
        {shown.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color || palette[i % palette.length] }}
            />
            <span className="text-text-secondary truncate" title={s.label}>{s.label}</span>
            <span className="text-text-primary font-bold ml-auto pl-2">
              {s.display}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
