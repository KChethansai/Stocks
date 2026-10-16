import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useUiStore } from '../../store/uiStore'
import { EASING } from '../../lib/motion'

// ── Landing initial-load preloader ─────────────────────────────────────
// No fake progress, no minimum display: content appears as soon as fonts are
// ready (hard cap 1.5s so it never blocks interaction). Comfort / OS
// reduced-motion skips the sequence entirely.
//
// Contract with RootLayout: rendered inside <AnimatePresence>, landing
// content mounts only after onDone fires — so GSAP ScrollTrigger
// measurements in scenes always run against the final layout.

const MAX_MS = 1500

export default function LandingPreloader({ onDone }) {
  const motionMode = useUiStore((s) => s.motionMode)
  const doneRef = useRef(false)
  const reduceMotion =
    motionMode === 'comfort' ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const finish = () => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone?.()
      }
    }
    if (reduceMotion) {
      finish()
      return undefined
    }
    let finished = false
    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve()
    const capTimer = new Promise((r) => setTimeout(r, MAX_MS))
    Promise.race([fontsReady, capTimer]).then(() => {
      if (!finished) {
        finished = true
        finish()
      }
    })
    const cap = setTimeout(() => {
      finished = true
      finish()
    }, MAX_MS + 50)

    return () => {
      finished = true
      clearTimeout(cap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  if (reduceMotion) return null

  return (
    <motion.div
      key="landing-preloader"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-primary"
      style={{ backgroundColor: 'var(--bg-primary, #0B0C0E)' }}
      role="status"
      aria-label="Loading MarketForge"
      exit={{ opacity: 0, transition: { duration: 0.25, ease: EASING.decelerate } }}
    >
      {/* Wordmark fades in for 600ms or less on first cold visit */}
      <motion.div
        className="text-xl font-bold tracking-[0.35em] uppercase"
        style={{ color: 'var(--ivory)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.5, ease: EASING.decelerate } }}
      >
        MarketForge
      </motion.div>
    </motion.div>
  )
}
