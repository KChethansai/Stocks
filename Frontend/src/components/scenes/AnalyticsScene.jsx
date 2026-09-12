import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { TextReveal } from '../../hooks/useTextReveal'
import {
  DURATIONS,
  STAGGER,
  DELAYS,
  EASING,
  fadeUp,
  staggerContainer,
  scaleIn,
} from '../../lib/motion'
import { SpotlightCard } from '../kokonutui/SpotlightCard'
import { ShinyText } from '../reactbits/ShinyText'
import { gsap, canScrub, refreshLandingTriggers } from '../../lib/landingGsap'
import { PriceAreaChart, useOhlcSeries } from '../charts/market-charts'
import { SectorAllocation, SECTOR_THEMES } from '../charts/sector-donut'
import { Area } from '../charts/area-chart'
import { useMemo } from 'react'

const metrics = [
  { label: 'Total Return', value: '+23.4%', sub: 'vs S&P 500 +12.1%', positive: true },
  { label: 'Win Rate', value: '68.2%', sub: '47 / 69 trades', positive: true },
  { label: 'Max Drawdown', value: '-8.7%', sub: 'Dec 15 — Jan 3', positive: false },
  { label: 'Sharpe Ratio', value: '1.84', sub: 'Risk-adjusted', positive: true },
]

// Cumulative-return comparison — two live series (NVDA vs S&P proxy),
// each normalized to 100 at first close; legend values computed from data.
function ComparisonChart() {
  const { prices: pf } = useOhlcSeries('NVDA', 'ALL')
  const { prices: sp } = useOhlcSeries('SPY', 'ALL')

  const { rows, pfPct, spPct } = useMemo(() => {
    const n = Math.min(pf.length, sp.length)
    if (n < 4) return { rows: [], pfPct: 0, spPct: 0 }
    const p0 = pf[pf.length - n].price
    const s0 = sp[sp.length - n].price
    const rows = []
    for (let i = 0; i < n; i++) {
      const a = pf[pf.length - n + i]
      const b = sp[sp.length - n + i]
      rows.push({ date: a.date, pf: (a.price / p0) * 100, sp: (b.price / s0) * 100 })
    }
    return {
      rows,
      pfPct: rows[n - 1].pf - 100,
      spPct: rows[n - 1].sp - 100,
    }
  }, [pf, sp])

  return (
    <div>
      <div className="flex items-center gap-5 mb-2 font-mono mf-meta">
        <span className="flex items-center gap-1.5 text-[#7ce6ff]">
          <span className="inline-block w-4 h-0.5 bg-[#7ce6ff]" />
          Portfolio {pfPct >= 0 ? '+' : ''}{pfPct.toFixed(1)}%
        </span>
        <span className="flex items-center gap-1.5 text-text-muted">
          <span className="inline-block w-4 border-t border-dashed border-[#84949e]" />
          S&P 500 {spPct >= 0 ? '+' : ''}{spPct.toFixed(1)}%
        </span>
      </div>
      <PriceAreaChart data={rows} yKey="pf" height={160} showAxes={false}>
        <Area
          dataKey="sp"
          stroke="#84949e"
          strokeWidth={1.5}
          fill="transparent"
          fillOpacity={0}
          dashArray="4 3"
          showHighlight={false}
        />
      </PriceAreaChart>
    </div>
  )
}

// Sector allocation donut — Bklit-port shared component (charts/sector-donut)
// on illustrative sample data; the card carries the Illustrative badge.
function SectorDonut() {
  const sectors = [
    { label: 'Tech', value: 35, display: '35%' },
    { label: 'Health', value: 22, display: '22%' },
    { label: 'Finance', value: 18, display: '18%' },
    { label: 'Energy', value: 15, display: '15%' },
    { label: 'Consumer', value: 10, display: '10%' },
  ]
  return (
    <SectorAllocation
      items={sectors}
      palette={SECTOR_THEMES.landing}
      size={160}
      totalDisplay="100%"
      totalLabel="Allocated"
    />
  )
}

export default function AnalyticsScene() {
  const isComfort = useReducedMotion()
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)

  // Scrubbed chart fade-in (reference analyticsScene: "top 92%" -> "top 62%")
  useEffect(() => {
    if (!canScrub() || !canvasRef.current || !sectionRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        canvasRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 92%',
            end: 'top 62%',
            scrub: true,
          },
        }
      )
    }, sectionRef)
    refreshLandingTriggers()
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full pointer-events-none -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(124,230,255,0.04) 0%, transparent 70%)' }} />

      <div className="mf-scene">
        <div className="mf-scene-frame">
          {/* Eyebrow + heading */}
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            variants={staggerContainer(STAGGER.featureCards, isComfort ? 0 : 0.1)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.div
              className="mf-eyebrow w-fit mx-auto mb-6"
              variants={fadeUp(isComfort ? 0 : DURATIONS.eyebrow, 0, EASING.contentReveal)}
            >
              <ShinyText className="text-xs font-mono uppercase font-bold">
                Analytics
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-landing-display-light tracking-tight text-text-primary leading-[1.1] mb-4"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="Measure what matters."
                duration={DURATIONS.title}
                stagger={STAGGER.titleWords}
                initialDelay={isComfort ? 0 : DELAYS.titleStart}
                className="text-text-primary"
                blur={!isComfort}
                as="span"
              />
            </motion.h2>

            <motion.p
              className="text-text-secondary leading-relaxed"
              style={{ fontSize: 'var(--mf-font-body-md)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.body, 0, EASING.contentReveal)}
            >
              See how your portfolio performs against the S&amp;P 500. Track
              returns, win rate, drawdowns, and sector exposure as you trade.
            </motion.p>
          </motion.div>

          {/* Metrics row (static marketing copy — not live account data) */}
          <div
            className="mb-2 flex justify-end"
            title="Static illustrative values, not your live account data"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Illustrative
            </span>
          </div>
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            variants={staggerContainer(STAGGER.stats, isComfort ? 0 : 0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {metrics.map((m) => (
              <motion.div
                key={m.label}
                className="bg-[var(--surface)]/80 border border-[var(--border)] rounded-xl p-4 font-mono"
                variants={scaleIn(isComfort ? 0 : DURATIONS.content, 0)}
              >
                <div className="mf-label mb-1">{m.label}</div>
                <div className={`text-xl font-bold ${m.positive ? 'text-positive' : 'text-negative'}`}>{m.value}</div>
                <div className="mf-meta mt-1">{m.sub}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Chart + Donut (GSAP scrub target) */}
          <motion.div
            ref={canvasRef}
            className="grid lg:grid-cols-5 gap-6"
            variants={staggerContainer(STAGGER.featureCards, isComfort ? 0 : 0.3)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {/* Performance chart */}
            <motion.div
              className="lg:col-span-3"
              variants={fadeUp(isComfort ? 0 : DURATIONS.body, 0, EASING.contentReveal)}
            >
              <SpotlightCard
                spotlightColor="rgba(124, 230, 255, 0.1)"
                tiltIntensity={3}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 h-full"
              >
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-3">
                  Cumulative Return · 12 Months
                </div>
                <div className="h-[200px]">
                  <ComparisonChart />
                </div>
              </SpotlightCard>
            </motion.div>

            {/* Sector allocation */}
            <motion.div
              className="lg:col-span-2"
              variants={fadeUp(isComfort ? 0 : DURATIONS.body, 0, EASING.contentReveal)}
            >
              <SpotlightCard
                spotlightColor="rgba(124, 230, 255, 0.1)"
                tiltIntensity={3}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 h-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    Sector Allocation
                  </div>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider text-text-muted"
                    title="Static illustrative values, not your live account data"
                  >
                    Illustrative
                  </span>
                </div>
                <SectorDonut />
              </SpotlightCard>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
