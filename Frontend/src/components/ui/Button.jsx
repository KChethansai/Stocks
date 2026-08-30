import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const sizes = {
  xs: 'px-2.5 py-1 text-[11px] gap-1.5',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-xs gap-2',
  lg: 'px-6 py-3 text-sm gap-2'
}

const variants = {
  primary:
    'bg-gradient-to-b from-[#4D8EF8] to-[#2F6FE3] text-white shadow-[0_2px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_4px_22px_rgba(59,130,246,0.5)] hover:brightness-110',
  success:
    'bg-gradient-to-b from-[#2EDB9A] to-[#1FBF82] text-[#06090F] shadow-[0_2px_14px_rgba(46,207,142,0.35)] hover:shadow-[0_4px_22px_rgba(46,207,142,0.5)] hover:brightness-110',
  danger:
    'bg-gradient-to-b from-[#FF5E6D] to-[#EF4444] text-white shadow-[0_2px_14px_rgba(239,68,68,0.35)] hover:shadow-[0_4px_22px_rgba(239,68,68,0.5)] hover:brightness-110',
  secondary:
    'border border-white/10 bg-[#151820] text-[#F5F7FA] hover:bg-[#1c1b1d] hover:border-white/20 hover:text-white',
  ghost: 'text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-white/[0.06]',
  'outline-danger':
    'border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 hover:border-[#EF4444]/60',
  cell: 'bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white hover:border-[#3B82F6]',
  'cell-danger':
    'bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444] hover:text-white hover:border-[#EF4444]'
}

function buttonVariants({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'relative inline-flex items-center justify-center gap-2 font-mono font-semibold select-none rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] disabled:pointer-events-none disabled:opacity-40',
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
  ...props
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled || prefersReducedMotion() ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={cn('group', buttonVariants({ variant, size }), className)}
      {...props}
    >
      {['primary', 'success', 'danger'].includes(variant) && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
          <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/15 blur-sm transition-transform duration-500 ease-out group-hover:translate-x-[400%]" />
        </span>
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  )
}

export function Chip({ active = false, onClick, children, className, tone = 'neutral', ...props }) {
  const tones = {
    neutral:
      'border-white/10 bg-white/[0.04] text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-white/[0.08]',
    accent:
      'border-[#3B82F6]/40 bg-[#3B82F6]/15 text-[#3B82F6] hover:bg-[#3B82F6]/25 hover:text-[#60A5FA]',
    danger:
      'border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 text-[0.7rem] font-mono rounded-md border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60 disabled:opacity-40 disabled:pointer-events-none',
        active ? tones.accent : tones[tone] || tones.neutral,
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}