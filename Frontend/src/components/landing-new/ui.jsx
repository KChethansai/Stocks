// Shared shell for the new landing page: section frame, eyebrow, honest
// "Illustrative" caption, and one restrained reveal (opacity/y≤16px/220ms,
// once; static under comfort or OS reduced-motion).
import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export function LReveal({ children, className = '', delay = 0 }) {
  const comfort =
    useReducedMotion() ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  if (comfort) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.22, delay: Math.min(delay, 0.24), ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function Eyebrow({ children }) {
  return (
    <p className="mf-label text-[var(--brass)] text-xs font-bold tracking-[0.14em] uppercase">
      {children}
    </p>
  )
}

export function SectionHead({ eyebrow, title, lede }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mf-landing-display mt-3 text-3xl sm:text-4xl font-black tracking-tight text-[var(--ivory)]">
        {title}
      </h2>
      {lede && <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-[var(--stone)]">{lede}</p>}
    </div>
  )
}

// Marks a panel as an illustrative mock (never live account/quote data).
export function Illustrative({ children, className = '', caption = 'Illustrative demo — not live account or quote data.' }) {
  return (
    <div className={className}>
      {children}
      <p className="mf-meta mt-2">{caption}</p>
    </div>
  )
}

export function Section({ id, children, wide = false, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-24 border-t border-white/5 ${className}`}>
      <div className={`${wide ? 'max-w-6xl' : 'max-w-5xl'} mx-auto px-5 sm:px-8 py-14 sm:py-20`}>
        {children}
      </div>
    </section>
  )
}
