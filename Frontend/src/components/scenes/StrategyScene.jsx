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
import { TrendingUp, Shield, Zap, Target } from 'lucide-react'

const strategies = [
  {
    icon: TrendingUp,
    name: 'Momentum Breakout',
    desc: 'Buy strength above VWAP with volume confirmation.',
    signal: 'BULLISH',
    winRate: '72%',
    trades: 24,
    color: '#2eafff',
  },
  {
    icon: Shield,
    name: 'Mean Reversion',
    desc: 'Fade overextended moves at Bollinger Band extremes.',
    signal: 'NEUTRAL',
    winRate: '64%',
    trades: 18,
    color: '#7ce6ff',
  },
  {
    icon: Target,
    name: 'Gap & Go',
    desc: 'Ride post-earnings gaps with trailing stops.',
    signal: 'BULLISH',
    winRate: '68%',
    trades: 12,
    color: '#7ed6a3',
  },
  {
    icon: Zap,
    name: 'Scalp Engine',
    desc: 'High-frequency entries on 1-min micro-structure.',
    signal: 'BEARISH',
    winRate: '58%',
    trades: 47,
    color: '#96cdde',
  },
]

// Signal strength visualization
function SignalBar({ strength, color }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-4 rounded-sm transition-colors"
          style={{
            backgroundColor: i < strength ? color : 'var(--border)',
            opacity: i < strength ? 0.9 : 0.3,
          }}
        />
      ))}
    </div>
  )
}

export default function StrategyScene() {
  const isComfort = useReducedMotion()

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
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
                Strategy
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-landing-display-light tracking-tight text-text-primary leading-[1.1] mb-4"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="Develop your edge."
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
              Sample approaches to try with virtual capital. Test each one
              against live prices, review every fill, and keep what works.
            </motion.p>
          </motion.div>

          {/* Strategy cards */}
          <motion.div
            className="grid sm:grid-cols-2 gap-5"
            variants={staggerContainer(STAGGER.featureCards, isComfort ? 0 : 0.15)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {strategies.map((s) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.name}
                  variants={scaleIn(isComfort ? 0 : DURATIONS.content, 0)}
                >
                  <SpotlightCard
                    spotlightColor={`${s.color}15`}
                    tiltIntensity={4}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 h-full group hover:border-white/15 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                          style={{ backgroundColor: `${s.color}15`, color: s.color }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold font-mono text-text-primary">{s.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${s.color}20`, color: s.color }}
                            >
                              {s.signal}
                            </span>
                            <SignalBar
                              strength={s.signal === 'BULLISH' ? 4 : s.signal === 'BEARISH' ? 2 : 3}
                              color={s.color}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-text-secondary mb-4 leading-relaxed">{s.desc}</p>

                    <div className="flex items-center gap-4 font-mono text-[10px] pt-3 border-t border-[var(--border)]">
                      <div>
                        <span className="text-text-muted">Win Rate </span>
                        <span className="text-text-primary font-bold">{s.winRate}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">Trades </span>
                        <span className="text-text-primary font-bold">{s.trades}</span>
                      </div>
                    </div>
                  </SpotlightCard>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
