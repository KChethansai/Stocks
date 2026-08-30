import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#151820] p-0.5',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex items-center justify-center rounded-md font-mono transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60',
              size === 'sm' ? 'px-2.5 py-1 text-[10px] gap-1' : 'px-3 py-1 text-xs gap-1.5',
              fullWidth && 'flex-1',
              active
                ? opt.activeClass || 'text-[#F5F7FA] font-semibold'
                : 'text-[#9CA3AF] hover:text-[#F5F7FA]'
            )}
          >
            {active && (
              <motion.span
                layoutId={`${uid}-pill`}
                className={cn('absolute inset-0 rounded-md', opt.pillClass || 'bg-white/10')}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', bounce: 0.18, duration: 0.45 }
                }
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