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
} from '../../lib/motion'
import { gsap, canPin, canScrub, refreshLandingTriggers } from '../../lib/landingGsap'
import { SpotlightCard } from '../kokonutui/SpotlightCard'
import { BorderBeam } from '../magicui/BorderBeam'
import { ShinyText } from '../reactbits/ShinyText'

const tickers = [
  { symbol: 'AAPL', price: 227.14, change: +1.42 },
  { symbol: 'NVDA', price: 942.81, change: +4.24 },
  { symbol: 'MSFT', price: 415.10, change: -0.60 },
  { symbol: 'GOOGL', price: 172.65, change: +0.87 },
  { symbol: 'AMZN', price: 198.32, change: -1.23 },
  { symbol: 'TSLA', price: 170.80, change: -2.95 },
]

// SVG line chart with scrubbed path drawing (cryptowl bridge-style:
// bezier path reveals as the scene scrolls through the pin).
function MiniChart({ pathRef }) {
  return (
    <svg className="w-full h-full" viewBox="0 0 400 140" fill="none" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ctrlGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ce6ff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7ce6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        ref={pathRef}
        d="M0,120 L20,115 L40,118 L60,95 L80,100 L100,80 L120,85 L140,60 L160,70 L180,45 L200,55 L220,35 L240,50 L260,25 L280,40 L300,20 L320,30 L340,15 L360,22 L380,10 L400,18"
        stroke="#7ce6ff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M0,120 L20,115 L40,118 L60,95 L80,100 L100,80 L120,85 L140,60 L160,70 L180,45 L200,55 L220,35 L240,50 L260,25 L280,40 L300,20 L320,30 L340,15 L360,22 L380,10 L400,18 L400,140 L0,140 Z"
        fill="url(#ctrlGrad)"
      />
      {/* Entry line */}
      <line x1="0" y1="90" x2="400" y2="90" stroke="#7ce6ff" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
      <text x="4" y="88" fill="#7ce6ff" fontSize="9" fontFamily="monospace" opacity="0.6">Entry $85.00</text>
      {/* Current price */}
      <circle cx="400" cy="18" r="4" fill="#7ce6ff" />
      <text x="360" y="12" fill="#7ce6ff" fontSize="9" fontFamily="monospace">$94.28</text>
    </svg>
  )
}

export default function ControlScene() {
  const isComfort = useReducedMotion()
  const sectionRef = useRef(null)
  const pinRef = useRef(null)
  const pathRef = useRef(null)

  // Pinned showcase (reference controlScene: start "top top",
  // end "+=calculated", pin + pinSpacing + anticipatePin: 1).
  // Desktop + fine pointer + full motion only; everyone else keeps the
  // Motion whileInView entrance below.
  useEffect(() => {
    if (!canPin() || !sectionRef.current || !pinRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(pinRef.current, {
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top+=80',
          end: '+=400',
          pin: pinRef.current,
          pinSpacing: true,
          anticipatePin: 1,
        },
      })
      // Scrubbed path drawing across the pin distance
      const path = pathRef.current
      if (path && canScrub()) {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            end: 'bottom 30%',
            scrub: true,
          },
        })
      }
    }, sectionRef)
    refreshLandingTriggers()
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative py-24 sm:py-32 overflow-hidden">
      {/* Atmospheric glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(124,230,255,0.05) 0%, transparent 70%)' }} />

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
                Workspace
              </ShinyText>
            </motion.div>

            <motion.h2
              className="font-landing-display-light tracking-tight text-text-primary leading-[1.1] mb-4"
              style={{ fontSize: 'var(--mf-font-display-lg)' }}
              variants={fadeUp(isComfort ? 0 : DURATIONS.title, 0, EASING.textReveal)}
            >
              <TextReveal
                text="One workspace for every trade."
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
              Live quotes, instant simulated fills, and position tracking in
              one place. Search 30 US stocks, place market orders, and watch
              your portfolio update in real time.
            </motion.p>
          </motion.div>

          {/* Workspace showcase (GSAP pin target) */}
          <div ref={pinRef}>
            <motion.div
              initial={isComfort ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 24 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: isComfort ? 0 : DURATIONS.card, ease: EASING.contentReveal }}
            >
              <SpotlightCard
                spotlightColor="rgba(124, 230, 255, 0.12)"
                tiltIntensity={4}
                className="rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden bg-[var(--surface)]/95"
              >
                <BorderBeam size={160} duration={10} colorFrom="#2eafff" colorTo="#7ed6a3" />

                {/* Title bar */}
                <div className="h-10 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--bg-primary)]/90 backdrop-blur-md">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-negative/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-positive/70" />
                  </div>
                  <div className="text-[10px] font-mono text-text-muted">workspace.marketforge.app</div>
                  <div className="w-10" />
                </div>

                {/* Workspace body */}
                <div className="flex flex-col lg:flex-row bg-[var(--bg-primary)]/80">
                  {/* Main chart */}
                  <div className="flex-1 p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="text-lg font-bold font-mono text-text-primary">NVDA</h3>
                        <div className="text-sm font-mono text-text-primary flex items-center gap-2">
                          $942.81
                          <span className="text-xs font-bold text-positive">+4.24%</span>
                        </div>
                      </div>
                      <div className="flex gap-1 bg-[var(--surface)] p-0.5 rounded border border-[var(--border)] font-mono text-[10px]">
                        {['1D', '1W', '1M', '3M'].map((tf) => (
                          <button key={tf} className={`px-2 py-0.5 rounded ${tf === '1D' ? 'bg-[var(--surface-elevated)] text-text-primary font-medium' : 'text-text-secondary'}`}>
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-h-[160px] border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
                      <MiniChart pathRef={pathRef} />
                    </div>

                    {/* Position row */}
                    <div className="grid grid-cols-4 gap-3 font-mono text-xs">
                      {[
                        { label: 'Shares', value: '50' },
                        { label: 'Avg Cost', value: '$850.00' },
                        { label: 'Market Value', value: '$47,140.50' },
                        { label: 'P&L', value: '+$4,640.50', accent: true },
                      ].map((item) => (
                        <div key={item.label} className="bg-[var(--surface)]/90 border border-[var(--border)] rounded-lg p-2.5">
                          <div className="text-[10px] text-text-muted uppercase">{item.label}</div>
                          <div className={`font-bold ${item.accent ? 'text-positive' : 'text-text-primary'}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sidebar: watchlist */}
                  <div className="lg:w-56 border-t lg:border-t-0 lg:border-l border-[var(--border)] p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-1">Watchlist</span>
                    {tickers.map((t) => (
                      <div key={t.symbol} className="flex justify-between items-center p-2 rounded-lg bg-[var(--surface)]/60 border border-[var(--border)] font-mono text-xs">
                        <span className="font-bold text-text-primary">{t.symbol}</span>
                        <div className="text-right">
                          <div className="text-text-primary">${t.price.toFixed(2)}</div>
                          <div className={`text-[10px] ${t.change >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {t.change >= 0 ? '+' : ''}{t.change}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
