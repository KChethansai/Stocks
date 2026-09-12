import { useEffect, useRef, useState } from 'react'
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
import { gsap, canPin, refreshLandingTriggers } from '../../lib/landingGsap'
import { SpotlightCard } from '../kokonutui/SpotlightCard'
import { BorderBeam } from '../magicui/BorderBeam'
import { ShinyText } from '../reactbits/ShinyText'
import { PriceAreaChart, ChartValueLine, useOhlcSeries } from '../charts/market-charts'

const tickers = [
  { symbol: 'AAPL', price: 227.14, change: +1.42 },
  { symbol: 'NVDA', price: 942.81, change: +4.24 },
  { symbol: 'MSFT', price: 415.10, change: -0.60 },
  { symbol: 'GOOGL', price: 172.65, change: +0.87 },
  { symbol: 'AMZN', price: 198.32, change: -1.23 },
  { symbol: 'TSLA', price: 170.80, change: -2.95 },
]

export default function ControlScene() {
  const isComfort = useReducedMotion()
  const sectionRef = useRef(null)
  const pinRef = useRef(null)
  const [timeframe, setTimeframe] = useState('1D')
  const { prices } = useOhlcSeries('NVDA', timeframe)
  const entry = prices.length ? prices[0].price : null
  const current = prices.length ? prices[prices.length - 1].price : null

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
                          ${current != null ? current.toFixed(2) : '—'}
                          {entry != null && current != null ? (
                            <span className={`text-xs font-bold ${current >= entry ? 'text-positive' : 'text-negative'}`}>
                              {current >= entry ? '+' : ''}{(((current - entry) / entry) * 100).toFixed(2)}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex gap-1 bg-[var(--surface)] p-0.5 rounded border border-[var(--border)] font-mono text-[10px]" role="group" aria-label="Chart timeframe">
                        {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            aria-pressed={timeframe === tf}
                            className={`px-2 py-0.5 rounded ${tf === timeframe ? 'bg-[var(--surface-elevated)] text-text-primary font-medium' : 'text-text-secondary'}`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-h-[220px] border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden p-2">
                      <PriceAreaChart data={prices} height={220}>
                        {entry != null ? (
                          <ChartValueLine value={entry} label={`Entry $${entry.toFixed(2)}`} align="left" />
                        ) : null}
                        {current != null ? (
                          <ChartValueLine value={current} label={`$${current.toFixed(2)}`} solid />
                        ) : null}
                      </PriceAreaChart>
                    </div>

                    {/* Position row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
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
