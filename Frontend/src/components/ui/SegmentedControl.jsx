import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Exclusive option group with radiogroup semantics (ranges, sides, filters).
 * For view-switching navigation use tabs elsewhere; this control selects one
 * value from a set. Arrow keys move between options. */
export function SegmentedControl({
  value,
  onChange,
  options,
  className,
  size = 'md',
  ariaLabel,
  fullWidth = false
}) {
  const uid = useId()
  const reduced = prefersReducedMotion()

  const move = (dir) => {
    const idx = options.findIndex((o) => o.value === value)
    const nextIdx = (idx + dir + options.length) % options.length
    const next = options[nextIdx]
    if (!next) return
    onChange(next.value)
    // Roving focus follows selection so AT focus matches aria-checked.
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-seg-index="${nextIdx}"]`)
        ?.focus()
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-lg border border-[var(--hairline)] bg-[var(--ink-800)] p-0.5',
        fullWidth && 'w-full',
        className
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {options.map((opt, optIdx) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-seg-index={optIdx}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center justify-center rounded-md transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]',
              size === 'sm' ? 'px-2.5 py-1 text-[10px] gap-1' : 'px-3 py-1 text-xs gap-1.5',
              fullWidth && 'flex-1',
              active
                ? opt.activeClass || 'text-[var(--ivory)] font-semibold'
                : 'text-[var(--stone)] hover:text-[var(--ivory)]'
            )}
          >
            {active && (
              <motion.span
                layoutId={`${uid}-pill`}
                className={cn('absolute inset-0 rounded-md', opt.pillClass || 'bg-white/10')}
                transition={reduced ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
