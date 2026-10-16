import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, EASING } from '../../lib/motion'
import { useAuth } from '../../store/authStore'

export default function ExitScene() {
  const { isAuthenticated } = useAuth()
  const isComfort = useReducedMotion()

  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div className="mf-scene relative z-10">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: isComfort ? 0 : DURATIONS.content, ease: EASING.contentReveal }}
        >
          <h2
            className="font-display leading-[1.05] tracking-[-0.02em] text-[var(--ivory)]"
            style={{ fontSize: 'clamp(1.75rem, 1.375rem + 2vw, 2.75rem)' }}
          >
            Learn trading with nothing at stake.
          </h2>
          <div className="mt-8">
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-block rounded-lg bg-[var(--ivory)] px-6 py-3 text-sm font-semibold text-[#0B0C0E] transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E]"
            >
              {isAuthenticated ? 'Open dashboard' : 'Open practice account'}
            </Link>
          </div>
          <p className="mx-auto mt-6 max-w-md text-[13px] leading-5 text-[var(--stone-muted)]">
            Simulated trading. Not investment advice. Quotes via Yahoo Finance and may be delayed.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
