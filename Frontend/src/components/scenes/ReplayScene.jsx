import { useState } from 'react'
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
} from '../../lib/motion'
import { SpotlightCard } from '../kokonutui/SpotlightCard'
import { BorderBeam } from '../magicui/BorderBeam'
import { ShinyText } from '../reactbits/ShinyText'
import { Play, RotateCcw } from 'lucide-react'

const timelinePoints = [
  { date: 'Jan 3', event: 'Entry', price: '$85.00', pnl: null },
  { date: 'Jan 15', event: 'Add', price: '$88.20', pnl: null },
  { date: 'Feb 2', event: 'Peak', price: '$96.40', pnl: '+13.4%' },
  { date: 'Feb 18', event: 'Trim', price: '$91.10', pnl: '+7.2%' },
  { date: 'Mar 1', event: 'Exit', price: '$94.28', pnl: '+10.9%' },
]

// Before/after chart comparison
function BeforeAfterChart({ phase }) {
  const progress = phase === 'before' ? 0.4 : 1
  const points = [
    [0, 80], [10, 75], [20, 78], [30, 55], [40, 60],
    [50, 42], [60, 48], [70, 30], [80, 35], [90, 20], [100, 25],
  ]
  const visibleCount = Math.ceil(points.length * progress)
  const visible = points.slice(0, visibleCount)
  const pathD = visible.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')

  return (
    <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`replayGrad-${phase}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={phase === 'before' ? '#6B7280' : '#7ce6ff'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={phase === 'before' ? '#6B7280' : '#7ce6ff'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathD} stroke={phase === 'before' ? '#6B7280' : '#7ce6ff'} strokeWidth="2" strokeLinejoin="round" />
      <path d={`${pathD} L${visible[visible.length - 1][0]},100 L0,100 Z`}
        fill={`url(#replayGrad-${phase})`} />
      {visible.length > 0 && (
        <circle cx={visible[visible.length - 1][0]} cy={visible[visible.length - 1][1]}
          r="3" fill={phase === 'before' ? '#6B7280' : '#7ce6ff'} />
      )}
    </svg>
  )
}

export default function ReplayScene() {
  const isComfort = useReducedMotion()
  const [activeIdx, setActiveIdx] = useState(2)

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,230,255,0.05) 0%, transparent 70%)' }} />

      <div className="mf-scene">
        <div className="mf-scene-frame">
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
                Trade history
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-landing-display-light tracking-tight text-text-primary leading-[1.1] mb-4"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="Rewind the tape."
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
              Every order lands in your activity ledger with its full price
              history. Scroll the timeline to see how each position played out.
            </motion.p>
          </motion.div>

          {/* Replay card */}
          <motion.div
            initial={isComfort ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 24 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: isComfort ? 0 : DURATIONS.card, ease: EASING.contentReveal }}
          >
            <SpotlightCard
              spotlightColor="rgba(124, 230, 255, 0.12)"
              tiltIntensity={3}
              className="rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden bg-[var(--surface)]/95"
            >
              <BorderBeam size={120} duration={12} colorFrom="#2eafff" colorTo="#7ed6a3" />

              {/* Title bar */}
              <div className="h-10 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--bg-primary)]/90 backdrop-blur-md">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-negative/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-positive/70" />
                </div>
                <div className="text-[10px] font-mono text-text-muted">replay · NVDA · Jan–Mar 2025</div>
                <div className="w-10" />
              </div>

              <div className="p-5 bg-[var(--bg-primary)]/80">
                {/* Before / After comparison */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  {['before', 'after'].map((phase) => (
                    <div key={phase} className="border border-[var(--border)] rounded-xl bg-[var(--surface)]/60 p-3">
                      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
                        {phase === 'before' ? 'Entry Zone' : 'Full Journey'}
                      </div>
                      <div className="h-[100px]">
                        <BeforeAfterChart phase={phase} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline scrubber */}
                <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)]/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Timeline</span>
                    <div className="flex gap-1.5">
                      <button aria-label="Restart timeline" className="w-7 h-7 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-text-secondary hover:text-text-primary transition">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button aria-label="Play timeline" className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent">
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scrubber track */}
                  <div className="relative h-1.5 bg-[var(--surface)] rounded-full mb-4">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-accent rounded-full"
                      animate={{ width: `${(activeIdx / (timelinePoints.length - 1)) * 100}%` }}
                      transition={{ duration: isComfort ? 0 : 0.3 }}
                    />
                    {timelinePoints.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        aria-label={`View ${p.date}, ${p.event}`}
                        aria-pressed={i === activeIdx}
                        className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all cursor-pointer ${
                          i <= activeIdx
                            ? 'bg-accent border-accent shadow-md shadow-accent/30'
                            : 'bg-[var(--surface)] border-[var(--border)]'
                        }`}
                        style={{ left: `${(i / (timelinePoints.length - 1)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    ))}
                  </div>

                  {/* Timeline labels */}
                  <div className="flex justify-between font-mono text-[10px]">
                    {timelinePoints.map((p, i) => (
                      <div key={i} className={`text-center transition-colors ${i <= activeIdx ? 'text-text-primary' : 'text-text-muted'}`}>
                        <div className="font-bold">{p.date}</div>
                        <div className="text-text-muted">{p.event}</div>
                        {p.pnl && <div className="text-positive font-bold">{p.pnl}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
