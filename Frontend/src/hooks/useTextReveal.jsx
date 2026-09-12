import { useMemo } from 'react'
import { motion } from 'motion/react'
import { DURATIONS, STAGGER, EASING } from '../lib/motion'
import { useReducedMotion } from './useReducedMotion'

/**
 * Splits text into animated word spans with staggered reveal.
 * React-rendered (no DOM mutation), respects reduced motion.
 *
 * Mirrors the reference headline structure: words are `inline-block`
 * spans separated by REAL space text nodes inside a normal-flow
 * container — no flex, no gap. Wrap behaves like ordinary paragraph
 * text; deliberate line grouping comes only from block-level boxes
 * in the parent markup (never one-break-per-word).
 *
 * @param {string} text - The text to split and animate
 * @param {object} opts
 * @param {number} [opts.duration] - Animation duration per word
 * @param {number} [opts.stagger] - Delay between words
 * @param {number} [opts.initialDelay] - Delay before first word
 * @param {string} [opts.className] - CSS class for the wrapper
 * @param {string} [opts.as] - Wrapper element type (default: 'span')
 * @returns {JSX.Element}
 */
export function TextReveal({
  text,
  duration = DURATIONS.title,
  stagger = STAGGER.titleWords,
  initialDelay = 0,
  className = '',
  as: Tag = 'span',
  blur = true,
}) {
  const isComfort = useReducedMotion()
  const words = useMemo(() => text.split(' '), [text])

  if (isComfort) {
    return <Tag className={className}>{text}</Tag>
  }

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i}>
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, y: 8, filter: blur ? 'blur(4px)' : 'blur(0px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, amount: SCROLL_THRESHOLD }}
            transition={{
              duration,
              delay: initialDelay + i * stagger,
              ease: EASING.textReveal,
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  )
}

const SCROLL_THRESHOLD = 0.2
