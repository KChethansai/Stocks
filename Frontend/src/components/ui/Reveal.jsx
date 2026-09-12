import { motion } from 'motion/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DURATIONS, INSTANT, fadeUp } from '../../lib/motion'

// Restrained mount reveal shared by authenticated pages: single fade-up
// using the landing motion language (contentReveal, 0.34s). Comfort /
// reduced-motion renders instantly with no transform.
export default function Reveal({ children, delay = 0, className, as }) {
  const isComfort = useReducedMotion()
  const variants = isComfort ? INSTANT : fadeUp(DURATIONS.content, delay)
  const Tag = as === 'aside' ? motion.aside : as === 'section' ? motion.section : motion.div
  return (
    <Tag className={className} initial="hidden" animate="visible" variants={variants}>
      {children}
    </Tag>
  )
}
