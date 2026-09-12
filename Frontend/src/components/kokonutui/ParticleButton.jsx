import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'

// ── Particle Button ──────────────────────────────────────────────
// Source: kokonutUI Particle Button (https://kokonutui.com/docs/buttons/particle-button,
// install: npx shadcn@latest add @kokonutui/particle-button). Ported manually
// (shadcn Button base swapped for project token tones) with one fix:
// upstream handleClick never calls the consumer onClick — this port forwards
// and awaits it, so form submits and async trade handlers keep working.
//
// Motion contract: ZERO idle animation (no loops, no shimmer). A 6-particle
// burst fires once per click (0.6s, easeOut) plus a 100ms scale-95 press.
// Chosen over MagicUI ShinyButton (repeat: Infinity loop) and
// InteractiveHoverButton (theatrical text-swap) for fintech restraint.

const tones = {
  blue: {
    bg: '#3B82F6',
    fg: '#FFFFFF',
    ring: 'focus-visible:ring-[#3B82F6]/60',
    shadow: 'shadow-[0_2px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_4px_22px_rgba(59,130,246,0.45)]',
    hover: 'hover:brightness-110',
    particle: '#93C5FD'
  },
  cyan: {
    bg: 'rgba(12, 18, 27, 0.6)',
    fg: '#7ce6ff',
    ring: 'focus-visible:ring-[rgba(124,230,255,0.5)]',
    shadow: 'shadow-[0_2px_18px_rgba(0,0,0,0.4)] hover:shadow-[0_2px_24px_rgba(124,230,255,0.25)]',
    hover: '',
    border: 'border border-[rgba(124,230,255,0.3)] hover:border-[rgba(124,230,255,0.6)] backdrop-blur-md',
    particle: '#7ce6ff'
  },
  red: {
    bg: '#EF4444',
    fg: '#FFFFFF',
    ring: 'focus-visible:ring-[#EF4444]/60',
    shadow: 'shadow-[0_2px_14px_rgba(239,68,68,0.35)] hover:shadow-[0_4px_22px_rgba(239,68,68,0.45)]',
    hover: 'hover:brightness-110',
    particle: '#FCA5A5'
  },
  amber: {
    bg: '#F59E0B',
    fg: '#1A1005',
    ring: 'focus-visible:ring-[#F59E0B]/60',
    shadow: 'shadow-[0_2px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_22px_rgba(245,158,11,0.45)]',
    hover: 'hover:brightness-110',
    particle: '#FCD34D'
  }
}

function SuccessParticles({ origin, color }) {
  if (!origin) return null
  return (
    <AnimatePresence>
      {origin.vectors.map((v, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{ scale: [0, 1, 0], x: [0, v.x], y: [0, v.y] }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
          className="pointer-events-none fixed z-[200] h-1 w-1 rounded-full"
          style={{ left: origin.x, top: origin.y, backgroundColor: color }}
        />
      ))}
    </AnimatePresence>
  )
}

export function ParticleButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  tone = 'blue',
  burstDuration = 900,
  className,
  ...props
}) {
  const t = tones[tone] || tones.blue
  const [burst, setBurst] = useState(null)
  const buttonRef = useRef(null)
  const timer = useRef(null)

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const handleClick = async (e) => {
    if (disabled) return
    if (!reduceMotion) {
      const rect = buttonRef.current?.getBoundingClientRect()
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      // Particle vectors are generated here (event handler, not render) so
      // each click gets a fresh burst and render stays pure.
      const vectors = [...Array(6)].map((_, i) => ({
        x: (i % 2 ? 1 : -1) * (20 + Math.random() * 30),
        y: -20 - Math.random() * 30
      }))
      setBurst({ x: cx, y: cy, vectors })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setBurst(null), burstDuration)
    }
    await onClick?.(e)
  }

  return (
    <>
      {burst && (
        <SuccessParticles origin={burst} color={t.particle} />
      )}
      <button
        ref={buttonRef}
        type={type}
        onClick={handleClick}
        disabled={disabled}
        style={{ backgroundColor: t.bg, color: t.fg }}
        className={cn(
          'relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 font-mono text-xs font-semibold whitespace-nowrap',
          'transition-all duration-200 active:scale-[0.98]',
          t.shadow,
          t.hover,
          t.border,
          t.ring,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B]',
          'disabled:pointer-events-none disabled:opacity-40',
          className
        )}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </button>
    </>
  )
}
