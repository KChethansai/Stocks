/**
 * MarketForge Motion System
 *
 * Centralized source of truth for animation durations, stagger values,
 * easing curves, and motion variants. Based on CryptOwl interaction
 * patterns adapted for MarketForge's visual identity.
 *
 * All timing values derived from CryptOwl reference:
 *   Eyebrow:  0.42s (power2.out)
 *   Title:    0.78s (power3.out)
 *   Body:     0.54s (power2.out)
 *   Content:  0.34s (power2.out)
 *   Word stagger: 0.048s / 0.016s
 *   Trigger: top 78%
 *
 * Easing mapped from GSAP to cubic-bezier (Motion has no power* easings):
 *   power3.out (quart.out) -> [0.165, 0.84, 0.44, 1]
 *   power2.out (cubic.out) -> [0.215, 0.61, 0.355, 1]
 *   power1.out (quad.out)   -> [0.25, 0.46, 0.45, 0.94]
 */

// ── Durations (seconds) ──────────────────────────────────────────
export const DURATIONS = {
  eyebrow: 0.42,
  title: 0.78,
  body: 0.54,
  content: 0.34,
  card: 0.78,
  hover: 0.18,
  ui: 0.22,
  canvas: 1,
}

// ── Stagger (seconds) ────────────────────────────────────────────
export const STAGGER = {
  titleWords: 0.048,
  bodyWords: 0.016,
  featureCards: 0.08,
  stats: 0.06,
  eyebrow: 0,
}

// ── Delay offsets (seconds) ──────────────────────────────────────
export const DELAYS = {
  eyebrowStart: 0.1,
  titleStart: 0.18,
  bodyStart: 0.42,
  ctaStart: 0.54,
  statsStart: 0.6,
  cardStart: 0.3,
}

// ── Easing curves ────────────────────────────────────────────────
// Motion/Framer Motion accepts cubic-bezier arrays [x1, y1, x2, y2]
// Exact GSAP equivalents from the CryptOwl reference (see header).
export const EASING = {
  textReveal: [0.165, 0.84, 0.44, 1], // power3.out
  contentReveal: [0.215, 0.61, 0.355, 1], // power2.out
  decelerate: [0.16, 1, 0.3, 1], // --ease-decelerate (exact)
  standard: [0.22, 0.61, 0.36, 1], // --ease-standard (exact)
  wall: [0.25, 0.46, 0.45, 0.94], // power1.out (structural)
  spring: { type: 'spring', stiffness: 300, damping: 30 },
}

// ── Scroll thresholds ────────────────────────────────────────────
export const SCROLL = {
  sceneReveal: 0.2,
  sceneReset: 0,
}

// ── Motion variants (reusable with <motion.div variants={...}>) ──

/**
 * Fade-up: opacity 0 → 1, y offset → 0
 */
export function fadeUp(duration, delay = 0, easing = EASING.contentReveal) {
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: easing },
    },
  }
}

/**
 * Scale-fade: opacity + scale for cards/panels
 */
export function scaleFade(duration, delay = 0) {
  return {
    hidden: { opacity: 0, scale: 0.96, y: 16 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration, delay, ease: EASING.contentReveal },
    },
  }
}

/**
 * Word-by-word reveal: for use with mapped word spans
 */
export function wordReveal(duration = DURATIONS.title, stagger = STAGGER.titleWords) {
  return {
    hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration,
        delay: i * stagger,
        ease: EASING.textReveal,
      },
    }),
  }
}

/**
 * Stagger container: orchestrates child stagger
 */
export function staggerContainer(stagger = STAGGER.featureCards, delay = 0) {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  }
}

/**
 * Simple fade: opacity only, no transform
 */
export function fadeIn(duration = DURATIONS.content, delay = 0) {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

/**
 * Slide from left/right
 */
export function slideFrom(direction = 'left', duration = DURATIONS.body, delay = 0) {
  const x = direction === 'left' ? -24 : direction === 'right' ? 24 : 0
  const y = direction === 'up' ? 24 : direction === 'down' ? -24 : 0
  return {
    hidden: { opacity: 0, x, y },
    visible: { opacity: 1, x: 0, y: 0, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

/**
 * Scale in: grows from smaller
 */
export function scaleIn(duration = DURATIONS.card, delay = 0) {
  return {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

/**
 * Scene reveal: combined orchestration for entire scene entrance
 */
export function sceneReveal() {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  }
}

// ── Comfort mode helpers ─────────────────────────────────────────

export function motionVariant(full, comfort) {
  return (isComfort) => (isComfort ? comfort : full)
}

export const INSTANT = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
}
