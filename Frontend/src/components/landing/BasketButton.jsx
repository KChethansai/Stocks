import { useRef, useState } from 'react'
import { motion } from 'motion/react'

// Landing CTA with an add-to-basket micro-interaction (registry item
// @motion/button-add-to-basket was unavailable, so this is a local
// implementation in the cryptowl cyan system): idle -> press spring ->
// brief "added" check flash, hover sheen sweep + trailing-arrow nudge.
// Navigation (via wrapping Link) proceeds immediately; the flash is delight,
// never a gate.
export function BasketButton({
  children,
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  ...props
}) {
  const [added, setAdded] = useState(false)
  const timer = useRef(null)

  const handleClick = (e) => {
    if (disabled) return
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 900)
    onClick?.(e)
  }

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className={`group relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-[rgba(150,205,222,0.3)] bg-[rgba(12,18,27,0.6)] px-7 py-3 font-mono text-[0.9375rem] font-bold text-white shadow-[0_2px_18px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-200 hover:border-[rgba(124,230,255,0.6)] hover:shadow-[0_2px_24px_rgba(124,230,255,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(124,230,255,0.42)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090d] disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...props}
    >
      {/* Sheen sweep on hover (hover-only, 200ms — no idle loop) */}
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/20 blur-sm transition-transform duration-200 ease-out group-hover:translate-x-[400%]" />
      </span>
      {/* Basket status dot */}
      <span className="relative z-10 flex items-center gap-2">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
            added ? 'bg-[#7ce6ff] text-[#03060b]' : 'bg-white/15 text-white'
          }`}
          aria-hidden="true"
        >
          {added ? (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6.5 4.8 9 10 3" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 4h9l-1 5.5h-7L1.5 4Z" />
              <path d="M4 4V3a2 2 0 0 1 4 0v1" />
            </svg>
          )}
        </span>
        <span className="inline-flex items-center gap-2 [&>svg]:shrink-0 [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:group-hover:translate-x-0.5">
          {children}
        </span>
      </span>
    </motion.button>
  )
}
