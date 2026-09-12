import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, useScroll, useTransform } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../store/authStore'
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
import { gsap, canScrub, refreshLandingTriggers } from '../../lib/landingGsap'
import MarketCanvas from '../3d/MarketCanvas'
import { BorderBeam } from '../magicui/BorderBeam'
import { AnimatedGradientText } from '../magicui/AnimatedGradientText'
import { FlickeringGrid } from '../magicui/FlickeringGrid'
import { SpotlightCard } from '../kokonutui/SpotlightCard'
import { LiquidGlassButton } from '../kokonutui/LiquidGlassButton'
import { ShinyText } from '../reactbits/ShinyText'
import { Aurora } from '../reactbits/Aurora'
import { BasketButton } from '../landing/BasketButton'

const sampleTickers = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 227.14, change: +1.42, sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 942.81, change: +4.24, sector: 'Semiconductors' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.10, change: -0.60, sector: 'Software' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 170.80, change: -2.95, sector: 'Automotive' },
]

const stats = [
  { value: '$100K', label: 'Virtual starting capital' },
  { value: '30', label: 'US stocks to trade' },
  { value: '$0', label: 'Real money at risk', accent: true },
]

export default function HeroScene() {
  const { isAuthenticated } = useAuth()
  const isComfort = useReducedMotion()
  const sceneRef = useRef(null)
  const glowRef = useRef(null)
  const [activeTicker, setActiveTicker] = useState(sampleTickers[1])

  // Scroll Zoom Hero: content scales down + fades while background layers
  // parallax at different rates (Motion owns these nodes; GSAP owns glow).
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ['start start', 'end start'],
  })

  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const contentY = useTransform(scrollYProgress, [0, 0.7], [0, -60])
  const contentScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.94])
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const canvasY = useTransform(scrollYProgress, [0, 1], [0, 140])

  // Comfort mode: no scroll-linked transforms
  const scrollStyles = isComfort
    ? {}
    : { opacity: contentOpacity, y: contentY, scale: contentScale }

  // GSAP-scrubbed glow (separate node from Motion-owned layers — no conflicts)
  useEffect(() => {
    if (!canScrub() || !glowRef.current || !sceneRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(glowRef.current, {
        opacity: 0,
        scale: 1.4,
        ease: 'none',
        scrollTrigger: {
          trigger: sceneRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    }, sceneRef)
    refreshLandingTriggers()
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sceneRef}
      className="relative min-h-screen flex flex-col justify-center overflow-hidden"
    >
      {/* ── Background layers (parallax rates diverge on scroll) ── */}
      <motion.div className="absolute inset-0 z-0 mf-grid-bg opacity-30" style={isComfort ? {} : { y: gridY }} />
      <motion.div className="absolute inset-0 z-0 opacity-40" style={isComfort ? {} : { y: gridY }}>
        <FlickeringGrid color="#7ce6ff" squareSize={3} gridGap={8} flickerChance={0.12} maxOpacity={0.18} />
      </motion.div>
      <Aurora className="opacity-12" />
      <motion.div className="absolute inset-0 z-0 opacity-15" style={isComfort ? {} : { y: canvasY }}>
        <MarketCanvas />
      </motion.div>

      {/* ── Hero glow (GSAP-scrubbed) ── */}
      <div
        ref={glowRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(124, 230, 255, 0.08) 0%, transparent 70%)',
        }}
      />

      {/* ── Content wrapper ── */}
      <motion.div
        className="mf-scene relative z-10 pt-20 sm:pt-28 pb-20 flex-1 flex items-center"
        style={scrollStyles}
      >
        <div className="mf-scene-frame grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
          {/* ── Left: Copy ── */}
          <div className="flex flex-col gap-6 max-w-2xl">
            {/* Eyebrow */}
            <motion.div
              className="mf-eyebrow inline-flex items-center gap-2 px-3.5 py-1 rounded-full w-fit
                         bg-[var(--surface)]/90 border border-[var(--border)] shadow-md backdrop-blur-md"
              initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: isComfort ? 0 : DURATIONS.eyebrow,
                delay: isComfort ? 0 : DELAYS.eyebrowStart,
                ease: EASING.contentReveal,
              }}
            >
              <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
              <ShinyText className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                Paper trading · Real market data
              </ShinyText>
            </motion.div>

            {/* Title */}
            <h1 className="font-landing-display tracking-tight text-text-primary leading-[1.1]"
                style={{ fontSize: 'var(--mf-font-display-xl)' }}>
              <TextReveal
                text="Practice trading."
                duration={DURATIONS.title}
                stagger={STAGGER.titleWords}
                initialDelay={isComfort ? 0 : DELAYS.titleStart}
                className="block text-text-primary"
                blur={!isComfort}
                as="span"
              />
              <motion.span
                className="block text-text-secondary"
                initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: isComfort ? 0 : DURATIONS.body,
                  delay: isComfort ? 0 : DELAYS.titleStart + 0.12,
                  ease: EASING.contentReveal,
                }}
              >
                Understand markets.
              </motion.span>
              <motion.span
                className="block"
                initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: isComfort ? 0 : DURATIONS.title,
                  delay: isComfort ? 0 : DELAYS.titleStart + 0.24,
                  ease: EASING.textReveal,
                }}
              >
                <AnimatedGradientText from="#bdf7ff" via="#7ce6ff" to="#2eafff">
                  Build conviction.
                </AnimatedGradientText>
              </motion.span>
            </h1>

            {/* Body */}
            <motion.p
              className="text-text-secondary leading-relaxed max-w-xl"
              style={{ fontSize: 'var(--mf-font-body-md)' }}
              initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: isComfort ? 0 : DURATIONS.body,
                delay: isComfort ? 0 : DELAYS.bodyStart,
                ease: EASING.contentReveal,
              }}
            >
              Practice trading with real market data and $100,000 in virtual
              capital. Place orders, track positions, and learn how markets
              move — without risking a dollar.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-wrap items-center gap-4 pt-2"
              initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: isComfort ? 0 : DURATIONS.content,
                delay: isComfort ? 0 : DELAYS.ctaStart,
                ease: EASING.decelerate,
              }}
            >
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <BasketButton>
                  {isAuthenticated ? 'Open Dashboard' : 'Start Trading'}
                  <ArrowRight className="w-4 h-4" />
                </BasketButton>
              </Link>
              <Link to={isAuthenticated ? '/markets' : '/login'}>
                <LiquidGlassButton variant="primary" className="px-6 py-3 text-xs font-bold font-mono">
                  Explore Markets
                </LiquidGlassButton>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-3 gap-4 sm:gap-6 pt-8 border-t border-[var(--border)] mt-2 font-mono"
              variants={staggerContainer(STAGGER.stats, isComfort ? 0 : DELAYS.statsStart)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  className="p-3 rounded-xl bg-white/[0.02] border border-[var(--border)]"
                  variants={fadeUp(isComfort ? 0 : DURATIONS.content, 0, EASING.decelerate)}
                >
                  <div
                    className={`text-xl sm:text-2xl font-bold ${stat.accent ? 'text-positive' : 'text-text-primary'}`}
                  >
                    {stat.value}
                  </div>
                  <div className="text-xs text-text-muted">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Preview card (desktop only) ── */}
          <motion.div
            className="relative w-full h-[480px] sm:h-[540px] hidden lg:block"
            initial={isComfort ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: isComfort ? 0 : DURATIONS.card,
              delay: isComfort ? 0 : DELAYS.cardStart,
              ease: EASING.contentReveal,
            }}
          >
            <SpotlightCard
              spotlightColor="rgba(124, 230, 255, 0.15)"
              tiltIntensity={6}
              className="absolute inset-0 rounded-2xl border border-[var(--border)] shadow-2xl p-0 overflow-hidden flex flex-col bg-[var(--surface)]/95"
            >
              <BorderBeam size={200} duration={8} colorFrom="#2eafff" colorTo="#7ed6a3" />

              {/* Top bar */}
              <div className="h-11 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--bg-primary)]/90 backdrop-blur-md">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-negative/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-positive/70" />
                </div>
                <div className="text-[11px] font-mono text-text-muted">workspace.marketforge.app</div>
                <div className="w-10" />
              </div>

              {/* Workspace content */}
              <div className="flex-1 p-5 grid grid-cols-3 gap-5 bg-[var(--bg-primary)]/80">
                {/* Main chart area */}
                <div className="col-span-2 flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-lg font-bold font-mono text-text-primary">
                        {activeTicker.symbol}
                      </h3>
                      <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                        ${activeTicker.price.toFixed(2)}
                        <span className={`text-xs flex items-center font-bold ${activeTicker.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {activeTicker.change >= 0 ? '+' : ''}{activeTicker.change}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 bg-[var(--surface)] p-0.5 rounded border border-[var(--border)] font-mono text-[10px]">
                      <button className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] text-text-primary font-medium">1D</button>
                      <button className="px-2 py-0.5 rounded text-text-secondary">1W</button>
                      <button className="px-2 py-0.5 rounded text-text-secondary">1M</button>
                    </div>
                  </div>

                  {/* Chart representation */}
                  <div className="flex-1 border border-[var(--border)] rounded-xl bg-[var(--surface)] relative overflow-hidden p-4 flex items-end shadow-inner">
                    <svg className="w-full h-32 text-accent opacity-75" preserveAspectRatio="none" viewBox="0 0 100 30" aria-hidden="true">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,28 L8,24 L16,26 L24,14 L32,18 L40,10 L48,16 L56,6 L64,12 L72,4 L80,10 L88,2 L100,8"
                        fill="none"
                        stroke="currentColor"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                      <path
                        d="M0,28 L8,24 L16,26 L24,14 L32,18 L40,10 L48,16 L56,6 L64,12 L72,4 L80,10 L88,2 L100,8 L100,30 L0,30 Z"
                        fill="url(#chartGrad)"
                      />
                    </svg>
                  </div>

                  {/* Position info */}
                  <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                    {[
                      { label: 'Shares', value: '50' },
                      { label: 'Avg Cost', value: '$850.00' },
                      { label: 'Unrealized', value: '+$4,640.50', accent: true },
                    ].map((item, i) => (
                      <div key={i} className="bg-[var(--surface)]/90 border border-[var(--border)] rounded-lg p-2.5">
                        <div className="text-[10px] text-text-muted uppercase">{item.label}</div>
                        <div className={`font-bold ${item.accent ? 'text-positive' : 'text-text-primary'}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Side ticker */}
                <div className="col-span-1 flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                    Quick Watch
                  </span>
                  <div className="space-y-1.5 flex-1">
                    {sampleTickers.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => setActiveTicker(s)}
                        aria-pressed={activeTicker.symbol === s.symbol}
                        aria-label={`View ${s.symbol}`}
                        className={`w-full p-2.5 rounded-lg border transition cursor-pointer font-mono text-left ${
                          activeTicker.symbol === s.symbol
                            ? 'bg-[var(--surface)] border-accent/60 shadow-md shadow-accent/10'
                            : 'bg-[var(--surface)]/80 border-[var(--border)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <div className="flex justify-between text-xs font-bold text-text-primary">
                          <span>{s.symbol}</span>
                          <span>${s.price.toFixed(2)}</span>
                        </div>
                        <div className={`text-[10px] text-right mt-0.5 ${s.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {s.change >= 0 ? '+' : ''}{s.change}%
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
