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

const metrics = [
  { label: 'Total Return', value: '+23.4%', sub: 'vs S&P 500 +12.1%', positive: true },
  { label: 'Win Rate', value: '68.2%', sub: '47 / 69 trades', positive: true },
  { label: 'Max Drawdown', value: '-8.7%', sub: 'Dec 15 — Jan 3', positive: false },
  { label: 'Sharpe Ratio', value: '1.84', sub: 'Risk-adjusted', positive: true },
]

// SVG performance chart — cumulative return over time
function PerformanceChart() {
  return (
    <svg className="w-full h-full" viewBox="0 0 500 160" fill="none" preserveAspectRatio="none" role="img" aria-label="Portfolio cumulative return versus S and P 500 over 12 months">
      <defs>
        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7280" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6B7280" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Benchmark (S&P) */}
      <path
        d="M0,130 L30,125 L60,128 L90,118 L120,120 L150,110 L180,115 L210,105 L240,108 L270,98 L300,100 L330,92 L360,95 L390,88 L420,90 L450,85 L480,87 L500,82"
        stroke="#6B7280"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        opacity="0.5"
      />
      <path
        d="M0,130 L30,125 L60,128 L90,118 L120,120 L150,110 L180,115 L210,105 L240,108 L270,98 L300,100 L330,92 L360,95 L390,88 L420,90 L450,85 L480,87 L500,82 L500,160 L0,160 Z"
        fill="url(#benchGrad)"
      />
      {/* Portfolio */}
      <path
        d="M0,130 L30,122 L60,125 L90,105 L120,110 L150,90 L180,95 L210,75 L240,80 L270,55 L300,60 L330,42 L360,48 L390,30 L420,35 L450,22 L480,28 L500,15"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M0,130 L30,122 L60,125 L90,105 L120,110 L150,90 L180,95 L210,75 L240,80 L270,55 L300,60 L330,42 L360,48 L390,30 L420,35 L450,22 L480,28 L500,15 L500,160 L0,160 Z"
        fill="url(#perfGrad)"
      />
      {/* Legend */}
      <line x1="12" y1="12" x2="28" y2="12" stroke="#3B82F6" strokeWidth="2" />
      <text x="32" y="15" fill="#3B82F6" fontSize="9" fontFamily="monospace">Portfolio +23.4%</text>
      <line x1="160" y1="12" x2="176" y2="12" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="180" y="15" fill="#6B7280" fontSize="9" fontFamily="monospace">S&P 500 +12.1%</text>
    </svg>
  )
}

// Sector allocation donut — simple SVG
function SectorDonut() {
  const sectors = [
    { pct: 35, color: '#3B82F6', label: 'Tech' },
    { pct: 22, color: '#22C55E', label: 'Health' },
    { pct: 18, color: '#60A5FA', label: 'Finance' },
    { pct: 15, color: '#F59E0B', label: 'Energy' },
    { pct: 10, color: '#9CA3AF', label: 'Consumer' },
  ]
  let cum = 0
  const r = 38, cx = 50, cy = 50, stroke = 12
  const circ = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0" role="img" aria-label="Sector allocation donut chart">
        {sectors.map((s) => {
          const dash = (s.pct / 100) * circ
          const offset = circ - (cum / 100) * circ
          cum += s.pct
          return (
            <circle key={s.label} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              opacity="0.85"
            />
          )
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="bold" fontFamily="monospace">23.4%</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--text-muted)" fontSize="6" fontFamily="monospace">RETURN</text>
      </svg>
      <div className="space-y-1.5 font-mono text-[10px]">
        {sectors.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-text-secondary">{s.label}</span>
            <span className="text-text-primary font-bold ml-auto">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsScene() {
  const isComfort = useReducedMotion()

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full pointer-events-none -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, transparent 70%)' }} />

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
              className="mf-eyebrow inline-flex items-center gap-2 px-3.5 py-1 rounded-full w-fit mx-auto
                         bg-[var(--surface)]/90 border border-[var(--border)] backdrop-blur-md mb-6"
              variants={fadeUp(isComfort ? 0 : DURATIONS.eyebrow, 0, EASING.contentReveal)}
            >
              <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
              <ShinyText className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                Analytics
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-sans tracking-tight text-text-primary leading-[1.1] mb-4"
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

          {/* Metrics row */}
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
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{m.label}</div>
                <div className={`text-xl font-bold ${m.positive ? 'text-positive' : 'text-negative'}`}>{m.value}</div>
                <div className="text-[10px] text-text-muted mt-1">{m.sub}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Chart + Donut */}
          <motion.div
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
                spotlightColor="rgba(59, 130, 246, 0.1)"
                tiltIntensity={3}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 h-full"
              >
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-3">
                  Cumulative Return · 12 Months
                </div>
                <div className="h-[180px]">
                  <PerformanceChart />
                </div>
              </SpotlightCard>
            </motion.div>

            {/* Sector allocation */}
            <motion.div
              className="lg:col-span-2"
              variants={fadeUp(isComfort ? 0 : DURATIONS.body, 0, EASING.contentReveal)}
            >
              <SpotlightCard
                spotlightColor="rgba(59, 130, 246, 0.1)"
                tiltIntensity={3}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-5 h-full"
              >
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-4">
                  Sector Allocation
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
