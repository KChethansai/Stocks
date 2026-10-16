/**
 * MarketForge Motion System — three tiers.
 *
 * 1. Response: 180ms or less, ease-out, replies to a user action.
 * 2. Orchestrated: one entrance per page load, never per section.
 * 3. Data: a changed value flashes gain/loss for 400ms (no count-ups).
 *
 * Export names are preserved for existing callers migrating in later phases.
 * Comfort mode (uiStore motionMode === 'comfort' or OS reduced-motion) means
 * opacity-only: callers must branch on useReducedMotion / useMotionMode.
 */

// ── Durations (seconds) ──────────────────────────────────────────
export const DURATIONS = {
  // Response tier (≤0.18)
  hover: 0.18,
  ui: 0.18,
  // Orchestrated tier (single page-load entrance)
  eyebrow: 0.3,
  title: 0.5,
  body: 0.4,
  content: 0.3,
  card: 0.5,
  // Data tier
  flash: 0.4,
  // Legacy canvas key retained for importers; canvas loops are off in
  // comfort mode and gated by useReducedMotion.
  canvas: 1,
}

// ── Stagger (seconds) ────────────────────────────────────────────
// Only for the single orchestrated page-load entrance.
export const STAGGER = {
  titleWords: 0.04,
  bodyWords: 0.016,
  featureCards: 0.06,
  stats: 0.05,
  eyebrow: 0,
}

// ── Delay offsets (seconds) ──────────────────────────────────────
export const DELAYS = {
  eyebrowStart: 0.05,
  titleStart: 0.1,
  bodyStart: 0.2,
  ctaStart: 0.28,
  statsStart: 0.32,
  cardStart: 0.15,
}

// ── Easing curves ────────────────────────────────────────────────
export const EASING = {
  response: [0.25, 0.46, 0.45, 0.94],
  textReveal: [0.165, 0.84, 0.44, 1],
  contentReveal: [0.215, 0.61, 0.355, 1],
  decelerate: [0.16, 1, 0.3, 1],
  standard: [0.22, 0.61, 0.36, 1],
  wall: [0.25, 0.46, 0.45, 0.94],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
}

// ── Scroll thresholds ────────────────────────────────────────────
export const SCROLL = {
  sceneReveal: 0.2,
  sceneReset: 0,
}

// ── Motion variants (reusable with <motion.div variants={...}>) ──

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

export function fadeIn(duration = DURATIONS.content, delay = 0) {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

export function slideFrom(direction = 'left', duration = DURATIONS.body, delay = 0) {
  const x = direction === 'left' ? -24 : direction === 'right' ? 24 : 0
  const y = direction === 'up' ? 24 : direction === 'down' ? -24 : 0
  return {
    hidden: { opacity: 0, x, y },
    visible: { opacity: 1, x: 0, y: 0, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

export function scaleIn(duration = DURATIONS.card, delay = 0) {
  return {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration, delay, ease: EASING.contentReveal } },
  }
}

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

/* DATA_FLASH_MS deleted (D3): price flashes were removed from LiveValue —
   values swap silently with tabular-nums. */

// ── Comfort mode helpers ─────────────────────────────────────────

export function motionVariant(full, comfort) {
  return (isComfort) => (isComfort ? comfort : full)
}

export const INSTANT = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
}
