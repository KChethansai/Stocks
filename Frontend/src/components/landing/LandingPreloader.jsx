import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useUiStore } from '../../store/uiStore'
import { EASING } from '../../lib/motion'

// ── Landing initial-load preloader ─────────────────────────────────────
// Source: Motion.dev AnimatePresence exit pattern
// (motion.dev/docs/react-animate-presence — "Any motion components within
// the exiting component will fire animations defined on their exit props
// before the component is removed from the DOM"), combined with the
// curtains clip-wipe reveal (motion.dev/examples/react-curtains-clip-wipe).
// Chosen over 21st.dev registry preloaders: zero new dependencies (uses
// the motion/react already in this codebase) and exit-sequencing is exactly
// what AnimatePresence mode="wait" documents; the 21st direct component
// fetch 404s and its layout-preloader entry has a known no-code-on-install
// report (serafimcloud/21st#229).
//
// Contract with RootLayout: rendered inside <AnimatePresence mode="wait">,
// landing content mounts only after onDone fires — so GSAP ScrollTrigger
// measurements in scenes always run against the final layout, never while
// this overlay covers the viewport.
//
// Timing: minimum display (no flash) + real readiness (fonts loaded), with
// a hard cap so it never blocks interaction. Comfort / OS reduced-motion
// skips the sequence entirely (calls onDone immediately, renders null).

const MIN_MS = 850
const MAX_MS = 2600

export default function LandingPreloader({ onDone }) {
  const motionMode = useUiStore((s) => s.motionMode)
  const [progress, setProgress] = useState(0)
  const doneRef = useRef(false)
  const reduceMotion =
    motionMode === 'comfort' ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (reduceMotion) {
      onDone?.()
      return undefined
    }
    const start = performance.now()
    let raf = 0
    let finished = false
    let handoffTimer = 0

    const finish = () => {
      if (finished) return
      finished = true
      cancelAnimationFrame(raf)
      setProgress(100)
      // Let the counter hit 100 for one beat, then hand off to the exit.
      handoffTimer = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          onDone?.()
        }
      }, 220)
    }

    // Ease the counter toward 90 while waiting on real readiness.
    const tick = () => {
      const t = performance.now() - start
      setProgress((p) => Math.min(90, p + Math.max(0.4, (90 - p) * 0.04)))
      if (t < MAX_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve()
    const minTimer = new Promise((r) => setTimeout(r, MIN_MS))
    const capTimer = new Promise((r) => setTimeout(r, MAX_MS))
    // Resolve on (fonts + minimum) or hard cap, whichever first.
    Promise.race([Promise.all([fontsReady, minTimer]), capTimer]).then(finish)
    const cap = setTimeout(finish, MAX_MS + 50)

    return () => {
      finished = true
      cancelAnimationFrame(raf)
      clearTimeout(cap)
      clearTimeout(handoffTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  if (reduceMotion) return null

  return (
    <motion.div
      key="landing-preloader"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-primary"
      style={{ backgroundColor: 'var(--bg-primary, #07090d)' }}
      role="status"
      aria-label="Loading MarketForge"
      exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.55, ease: EASING.decelerate } }}
    >
      {/* Wordmark with letter stagger (landing display easing) */}
      <div className="overflow-hidden" aria-hidden="true">
        <motion.div
          className="font-mono text-xl font-bold tracking-[0.35em] uppercase"
          style={{ color: '#7ce6ff' }}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.045, delayChildren: 0.1 } },
          }}
        >
          {'MarketForge'.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              variants={{
                hidden: { opacity: 0, y: 14 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASING.textReveal } },
              }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>
      </div>

      <motion.div
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em]"
        style={{ color: '#84949e' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.4, duration: 0.4 } }}
        aria-hidden="true"
      >
        Paper trading · Real market data
      </motion.div>

      {/* Progress rail + counter */}
      <div className="mt-8 w-48" aria-hidden="true">
        <div
          className="h-px w-full overflow-hidden rounded"
          style={{ backgroundColor: 'rgba(124, 230, 255, 0.15)' }}
        >
          <div
            className="h-full rounded"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #2eafff, #7ce6ff)',
              transition: 'width 120ms linear',
            }}
          />
        </div>
        <div className="mt-2 text-right font-mono text-[10px] tabular-nums" style={{ color: '#96cdde' }}>
          {Math.round(progress)}%
        </div>
      </div>
    </motion.div>
  )
}
