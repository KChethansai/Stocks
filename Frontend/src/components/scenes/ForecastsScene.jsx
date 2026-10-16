import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, EASING } from '../../lib/motion'

const ROWS = [
  {
    term: 'Direction',
    def: 'Whether the model expects the stock to move up, down, or sideways over the horizon.',
  },
  {
    term: 'Confidence',
    def: 'A raw model score from 0 to 100. It is not a measured success rate — the measured rate comes from resolved forecasts below it.',
  },
  {
    term: 'Horizon',
    def: 'How far ahead the forecast looks: 1 day or 5 days. Shorter horizons resolve sooner and are audited first.',
  },
  {
    term: 'Logged accuracy',
    def: 'Every forecast is stored with its model version. When the horizon passes, the outcome resolves against real closes and the hit rate updates.',
  },
]

export default function ForecastsScene() {
  const isComfort = useReducedMotion()

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="mf-scene">
        <div className="mf-scene-frame">
          <motion.div
            className="mx-auto mb-12 max-w-2xl text-center"
            initial={isComfort ? { opacity: 1 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: isComfort ? 0 : DURATIONS.content, ease: EASING.contentReveal }}
          >
            <h2
              className="font-display leading-[1.05] tracking-[-0.02em] text-[var(--ivory)]"
              style={{ fontSize: 'clamp(1.75rem, 1.375rem + 2vw, 2.75rem)' }}
            >
              Forecasts you can audit
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--stone)]">
              The app publishes a direction and confidence for each stock, then scores itself
              against what actually happened. Full accuracy history lives in your account.
            </p>
          </motion.div>

          <dl className="grid gap-4 sm:grid-cols-2">
            {ROWS.map((r) => (
              <div
                key={r.term}
                className="rounded-xl border border-[var(--hairline)] bg-[var(--ink-900)] p-5"
              >
                <dt className="text-sm font-semibold text-[var(--ivory)]">{r.term}</dt>
                <dd className="mt-2 text-[13px] leading-5 text-[var(--stone)]">{r.def}</dd>
              </div>
            ))}
          </dl>

          <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-5 text-[var(--stone-muted)]">
            Forecast accuracy is measured per account from resolved predictions — sign in to see
            yours, with the model version behind every number.{' '}
            <Link
              to="/register"
              className="font-medium text-[var(--stone)] underline decoration-[var(--hairline-hover)] underline-offset-4 transition hover:text-[var(--ivory)]"
            >
              Open a practice account
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
