import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Select({ value, onChange, options, placeholder = 'Select…', className, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const reduced = prefersReducedMotion()
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0b0e14] px-2.5 py-1.5 font-mono text-[11px] text-[#E8EEF7] transition-all duration-200 hover:border-[#3B82F6]/50 hover:bg-[#111318] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60 cursor-pointer',
          open && 'border-[#3B82F6]/60',
          className
        )}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5 text-[#8B97A8]" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={ariaLabel}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-lg border border-white/10 bg-[#151820] p-1 shadow-2xl shadow-black/50"
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'w-full px-2.5 py-1.5 text-left font-mono text-[11px] rounded-md transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/60',
                    o.value === value
                      ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                      : 'text-[#9CA3AF] hover:bg-white/[0.06] hover:text-[#F5F7FA]'
                  )}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}