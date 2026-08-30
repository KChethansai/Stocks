import { motion } from 'motion/react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function StepButton({ disabled, onClick, label, children }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled || prefersReducedMotion() ? {} : { scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      className="flex h-10 w-9 items-center justify-center text-[#9CA3AF] transition-colors duration-200 hover:text-[#F5F7FA] hover:bg-[#3B82F6]/10 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
    >
      {children}
    </motion.button>
  )
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = Infinity,
  disabled = false,
  className,
  compact = false
}) {
  const clamp = (n) => {
    if (!Number.isFinite(n)) return min
    return Math.min(max, Math.max(min, n))
  }

  return (
    <div
      className={cn(
        'flex items-center overflow-hidden rounded-xl border border-white/10 bg-[#09090B] transition-all duration-200 focus-within:border-[#3B82F6]/60 focus-within:ring-1 focus-within:ring-[#3B82F6]/30 group',
        compact && 'max-w-[10rem]',
        className
      )}
    >
      <StepButton
        label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(Number(value) - 1))}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </StepButton>
      <div className="h-8 w-px bg-white/10" />
      <input
        type="number"
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))}
        disabled={disabled}
        className="w-full min-w-0 flex-1 bg-transparent text-center text-sm font-semibold font-mono text-[#F5F7FA] focus:outline-none disabled:opacity-40"
        aria-label="Quantity"
      />
      <div className="h-8 w-px bg-white/10" />
      <StepButton
        label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(Number(value) + 1))}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </StepButton>
    </div>
  )
}