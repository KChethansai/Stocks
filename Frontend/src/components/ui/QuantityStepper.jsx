import { motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function StepButton({ disabled, onClick, label, children, stepHint }) {
  return (
    <motion.button
      type="button"
      aria-label={stepHint ? `${label} (Shift for ${stepHint})` : label}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled || prefersReducedMotion() ? {} : { scale: 0.85 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex h-10 w-9 items-center justify-center text-[var(--stone)] transition-colors duration-150 hover:text-[var(--ivory)] hover:bg-[var(--brass)]/10 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
    >
      {children}
    </motion.button>
  )
}

/* Quantity stepper. Shift+click (or Shift+Arrow) steps by 10. Max should come
 * from buying power / shares owned at the call site. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = Infinity,
  step = 1,
  largeStep = 10,
  disabled = false,
  className,
  compact = false
}) {
  const clamp = (n) => {
    if (!Number.isFinite(n)) return min
    return Math.min(max, Math.max(min, n))
  }
  const bump = (dir, large) => onChange(clamp(Number(value) + dir * (large ? largeStep : step)))
  return (
    <div
      className={cn(
        'flex items-center overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--ink-950)] transition-colors duration-150 focus-within:border-[var(--brass)]/60 focus-within:ring-1 focus-within:ring-[var(--brass)]/30 group',
        compact && 'max-w-[10rem]',
        className
      )}
    >
      <StepButton
        label="Decrease quantity"
        stepHint={largeStep}
        disabled={disabled || value <= min}
        onClick={(e) => bump(-1, e.shiftKey)}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </StepButton>
      <div className="h-8 w-px bg-[var(--hairline)]" />
      <input
        type="number"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          // Allow clearing the field mid-typing; clamp on blur instead.
          if (e.target.value === '') {
            onChange('')
            return
          }
          const parsed = Number(e.target.value)
          onChange(Number.isFinite(parsed) ? parsed : min)
        }}
        onBlur={(e) => {
          if (e.target.value === '') onChange(min)
          else onChange(clamp(Number(e.target.value)))
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            bump(1, e.shiftKey)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            bump(-1, e.shiftKey)
          }
        }}
        disabled={disabled}
        className="w-full min-w-0 flex-1 bg-transparent text-center text-sm font-semibold text-[var(--ivory)] tabular-nums focus:outline-none disabled:opacity-40"
        aria-label="Quantity"
      />
      <div className="h-8 w-px bg-[var(--hairline)]" />
      <StepButton
        label="Increase quantity"
        stepHint={largeStep}
        disabled={disabled || value >= max}
        onClick={(e) => bump(1, e.shiftKey)}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </StepButton>
    </div>
  )
}
