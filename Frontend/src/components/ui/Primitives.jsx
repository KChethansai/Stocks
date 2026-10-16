import { cloneElement, isValidElement } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

/* Empty state: always names the next action. */
export function EmptyState({ title, body, actionLabel, onAction, icon: Icon, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12 text-center', className)}>
      {Icon && <Icon className="mb-1 h-6 w-6 text-[var(--stone-muted)]" aria-hidden="true" />}
      <p className="text-sm font-medium text-[var(--ivory)]">{title}</p>
      {body && <p className="max-w-sm text-[13px] leading-5 text-[var(--stone)]">{body}</p>}
      {actionLabel && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

/* Field: label above input with hint and error slots. Wires
 * aria-describedby onto its child input automatically. */
export function Field({ label, hint, error, htmlFor, children, className }) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined
  // Only stamp an id onto an actual form control. Stamping the wrapper div
  // (the icon+input container call sites pass) duplicates the input's own id
  // and breaks the label association (getElementById returns the div).
  const isFormControl =
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type)
  const child = isValidElement(children)
    ? cloneElement(children, {
        ...(isFormControl ? { id: children.props.id || htmlFor } : {}),
        'aria-describedby':
          [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid']
      })
    : children
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--stone)]">
          {label}
        </label>
      )}
      {child}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--stone-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--loss)]">
          {error}
        </p>
      )}
    </div>
  )
}

/* Separator hairline. */
export function Separator({ className }) {
  return <div role="separator" aria-orientation="horizontal" className={cn('h-px w-full bg-[var(--hairline)]', className)} />
}
