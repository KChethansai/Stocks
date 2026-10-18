import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Listbox with full keyboard support: arrows/Home/End, typeahead, Escape,
 * focus-selected-on-open and focus-restore-on-close. */
export function Select({ value, onChange, options, placeholder = 'Select…', className, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const typeahead = useRef({ text: '', at: 0 })
  const listId = useId()
  const reduced = prefersReducedMotion()
  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
      requestAnimationFrame(() => {
        listRef.current?.querySelector('[aria-selected="true"]')?.focus()
      })
    } else {
      setActiveIndex(-1)
    }
  }, [open, selectedIndex])

  useEffect(() => {
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const choose = (idx) => {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onListKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (e.key === 'Tab') {
      // Close on Tab so focus never escapes with the listbox mounted.
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => {
        const n = Math.min(options.length - 1, i + 1)
        listRef.current?.children[n]?.firstChild?.focus()
        return n
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => {
        const n = Math.max(0, i - 1)
        listRef.current?.children[n]?.firstChild?.focus()
        return n
      })
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setActiveIndex(0)
      listRef.current?.children[0]?.firstChild?.focus()
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      const n = options.length - 1
      setActiveIndex(n)
      listRef.current?.children[n]?.firstChild?.focus()
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(activeIndex)
      return
    }
    if (e.key.length === 1) {
      const now = e.timeStamp
      const t = typeahead.current
      t.text = now - t.at > 500 ? e.key : t.text + e.key
      t.at = now
      const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(t.text.toLowerCase()))
      if (idx >= 0) {
        setActiveIndex(idx)
        listRef.current?.children[idx]?.firstChild?.focus()
      }
    }
  }

  return (
    // `className` lands on the ROOT, not just the trigger. The trigger alone is
    // an inline-flex box, so a `flex-1 min-w-0` intended to make the control
    // fill its flex parent was inert: the root sized to the label instead, and
    // width hints like `w-44` never applied. The trigger keeps `w-full` so it
    // fills the root, and the root carries the caller's layout classes.
    <div className={cn('relative min-w-0', className)} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'w-full inline-flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--ink-950)] px-2.5 py-1.5 text-[11px] text-[var(--ivory)] transition-colors duration-150 hover:border-[var(--hairline-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] cursor-pointer',
          open && 'border-[var(--brass)]/60'
        )}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5 text-[var(--stone-muted)]" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--ink-800)] p-1 shadow-[var(--shadow-float)]"
          >
            {options.map((o, idx) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  tabIndex={-1}
                  onClick={() => choose(idx)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'w-full px-2.5 py-1.5 text-left text-[11px] rounded-md transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]',
                    o.value === value
                      ? 'bg-[var(--accent-subtle)] text-[var(--brass)]'
                      : idx === activeIndex
                        ? 'bg-white/[0.06] text-[var(--ivory)]'
                        : 'text-[var(--stone)] hover:bg-white/[0.06] hover:text-[var(--ivory)]'
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
