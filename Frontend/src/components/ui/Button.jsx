import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/* Flat button system. Primary = ivory fill / ink text. Secondary = hairline.
 * Success/danger retained as compat names for trade surfaces only.
 * Focus ring is always brass. Sizes keep the existing xs–lg API. */

const sizes = {
  xs: 'px-2.5 py-1 text-[11px] gap-1.5 min-h-[28px]',
  sm: 'px-3 py-1.5 text-xs gap-1.5 min-h-[32px]',
  md: 'px-4 py-2 text-xs gap-2 min-h-[40px]',
  lg: 'px-6 py-3 text-sm gap-2 min-h-[44px]'
}

const variants = {
  primary: 'bg-[var(--ivory)] text-[#0B0C0E] font-semibold hover:brightness-95',
  success: 'bg-[var(--gain)] text-[#0B0C0E] font-semibold hover:brightness-95',
  danger: 'bg-[var(--loss)] text-[#0B0C0E] font-semibold hover:brightness-95',
  secondary:
    'border border-[var(--hairline)] bg-[var(--ink-900)] text-[var(--ivory)] hover:border-[var(--hairline-hover)] hover:bg-[var(--ink-800)]',
  ghost: 'text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-white/[0.06]',
  'outline-danger':
    'border border-[var(--loss)]/30 text-[var(--loss)] hover:bg-[var(--loss)]/10 hover:border-[var(--loss)]/60',
  cell: 'bg-[var(--accent-subtle)] border border-[var(--brass)]/20 text-[var(--brass)] hover:bg-[var(--brass)]/25',
  'cell-danger':
    'bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)] hover:bg-[var(--loss)]/20'
}

function buttonVariants({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'relative inline-flex items-center justify-center gap-2 font-semibold select-none rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0C0E] disabled:pointer-events-none disabled:opacity-40',
    sizes[size] || sizes.md,
    variants[variant] || variants.primary,
    className
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  onClick,
  disabled = false,
  type = 'button',
  ref,
  ...props
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      ref={ref}
      whileTap={disabled || prefersReducedMotion() ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  )
}

export function Chip({ active = false, onClick, children, className, tone = 'neutral', ...props }) {
  const tones = {
    neutral:
      'border-[var(--hairline)] bg-white/[0.04] text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-white/[0.08]',
    accent:
      'border-[var(--brass)]/40 bg-[var(--accent-subtle)] text-[var(--brass)] hover:bg-[var(--brass)]/25',
    danger:
      'border-[var(--loss)]/30 bg-[var(--loss)]/10 text-[var(--loss)] hover:bg-[var(--loss)]/20'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 text-[0.7rem] rounded-md border transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] disabled:opacity-40 disabled:pointer-events-none',
        active ? tones.accent : tones[tone] || tones.neutral,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
