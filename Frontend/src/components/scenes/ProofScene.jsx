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
import { CheckCircle2, Zap, BarChart3, Globe, Clock } from 'lucide-react'

const stats = [
  { icon: Globe, value: '30', label: 'US stocks', desc: 'Live Yahoo Finance quotes' },
  { icon: Zap, value: 'Instant', label: 'Order fills', desc: 'Simulated market orders' },
  { icon: BarChart3, value: '6', label: 'Chart ranges', desc: '1D through ALL' },
  { icon: Clock, value: '24/7', label: 'Platform access', desc: 'Practice on your schedule' },
]

const capabilities = [
  'Real-time Yahoo Finance market data feeds',
  'Instant order execution with partial fills',
  'Multi-timeframe candlestick and line charts',
  'Portfolio analytics with benchmark comparison',
  'Position tracking with unrealized P&L',
  'Secure authentication with HTTP-only cookies',
]

export default function ProofScene() {
  const isComfort = useReducedMotion()

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full pointer-events-none -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse, rgba(124,230,255,0.04) 0%, transparent 70%)' }} />

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
              className="mf-eyebrow inline-flex items-center gap-2 px-3.5 py-1 rounded-full w-fit mx-auto
                         bg-[var(--surface)]/90 border border-[var(--border)] backdrop-blur-md mb-6"
              variants={fadeUp(isComfort ? 0 : DURATIONS.eyebrow, 0, EASING.contentReveal)}
            >
              <span className="w-2 h-2 rounded-full bg-[#7ce6ff] animate-pulse" />
              <ShinyText className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                Proof
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-landing-display tracking-tight text-text-primary leading-[1.1] mb-4"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="Built for serious practice."
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
              Simulated fills, real quotes, and a full activity ledger —
              practice under conditions that feel like the real market.
            </motion.p>
          </motion.div>

          {/* Stats grid */}
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
            variants={staggerContainer(STAGGER.stats, isComfort ? 0 : 0.15)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.label}
                  variants={scaleIn(isComfort ? 0 : DURATIONS.content, 0)}
                >
                  <SpotlightCard
                    spotlightColor="rgba(124, 230, 255, 0.08)"
                    tiltIntensity={3}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 text-center h-full"
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-text-primary mb-1">{s.value}</div>
                    <div className="text-xs font-bold font-mono text-text-primary mb-0.5">{s.label}</div>
                    <div className="text-[10px] text-text-muted">{s.desc}</div>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Capabilities checklist */}
          <motion.div
            className="max-w-2xl mx-auto"
            variants={staggerContainer(STAGGER.featureCards, isComfort ? 0 : 0.25)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            <SpotlightCard
              spotlightColor="rgba(124, 230, 255, 0.08)"
              tiltIntensity={2}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-6"
            >
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-4">Platform Capabilities</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {capabilities.map((cap) => (
                  <motion.div
                    key={cap}
                    className="flex items-start gap-2.5"
                    variants={fadeUp(isComfort ? 0 : DURATIONS.content, 0, EASING.contentReveal)}
                  >
                    <CheckCircle2 className="w-4 h-4 text-positive shrink-0 mt-0.5" />
                    <span className="text-xs text-text-secondary leading-relaxed">{cap}</span>
                  </motion.div>
                ))}
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
