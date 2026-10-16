import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Accessible dialog: focus trap, Escape, focus restore, aria-modal.
 * Sheets are right-anchored dialogs (side="right"). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  ariaLabel,
  children,
  side = 'center',
  className
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)
  const prevFocus = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement
      setMounted(true)
      // Single focuser for the dialog: prefer an explicit [data-autofocus]
      // target (e.g. a search field) so container focus can never steal it on
      // a later tick — a rAF panel-focus racing a sync input-focus produced
      // WebKit-only keyboard dead-ends (Oct 2026). Fall back to the panel.
      requestAnimationFrame(() => {
        const panel = panelRef.current
        const target = panel?.querySelector?.('[data-autofocus]') ?? panel
        target?.focus?.()
      })
    } else {
      setMounted(false)
      prevFocus.current?.focus?.()
    }
  }, [open ])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = panelRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const enabled = [...items].filter((el) => !el.disabled && el.offsetParent !== null)
        if (!enabled.length) return
        const first = enabled[0]
        const last = enabled[enabled.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const isSheet = side === 'right'

  return createPortal(
    <AnimatePresence>
      {open && mounted && (
        <div className="fixed inset-0 z-50" role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion() ? 0 : 0.15 }}
            className="absolute inset-0 bg-black/70"
            onClick={() => onClose?.()}
            aria-hidden="true"
          />
          <div
            className={cn(
              'pointer-events-none absolute inset-0 flex',
              isSheet ? 'justify-end' : 'items-center justify-center p-4'
            )}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title ? undefined : ariaLabel}
              aria-labelledby={title ? titleId : undefined}
              aria-describedby={description ? descId : undefined}
              tabIndex={-1}
              initial={reduceMotion() ? { opacity: 0 } : isSheet ? { opacity: 0, x: 48 } : { opacity: 0, scale: 0.97 }}
              animate={isSheet ? { opacity: 1, x: 0 } : { opacity: 1, scale: 1 }}
              exit={reduceMotion() ? { opacity: 0 } : isSheet ? { opacity: 0, x: 48 } : { opacity: 0, scale: 0.97 }}
              transition={{ duration: reduceMotion() ? 0 : 0.18, ease: 'easeOut' }}
              className={cn(
                'pointer-events-auto flex flex-col bg-[var(--ink-800)] text-[var(--ivory)] shadow-[var(--shadow-float)] focus:outline-none',
                isSheet
                  ? 'h-full w-full max-w-md rounded-l-xl border-l border-[var(--hairline)] max-sm:mt-auto max-sm:h-[92vh] max-sm:max-w-none max-sm:rounded-l-none max-sm:rounded-t-xl max-sm:border-l-0 max-sm:border-t'
                  : 'max-h-[90vh] w-full max-w-md rounded-xl border border-[var(--hairline)]',
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {(title || description) && (
                <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] p-5">
                  <div>
                    {title && (
                      <h2 id={titleId} className="text-base font-semibold">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id={descId} className="mt-1 text-[13px] text-[var(--stone)]">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onClose?.()}
                    aria-label="Close dialog"
                    className="rounded-md p-1.5 text-[var(--stone)] transition-colors hover:bg-white/[0.06] hover:text-[var(--ivory)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* Small accessible tooltip (hover + focus, Escape dismisses). */
export function Tooltip({ label, children, className }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--hairline)] bg-[var(--ink-800)] px-2.5 py-1.5 text-xs text-[var(--ivory)] shadow-[var(--shadow-float)]"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
