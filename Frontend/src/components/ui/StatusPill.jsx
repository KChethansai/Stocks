import { cn } from '../../lib/utils'

const tones = {
  up: 'text-[var(--gain)] border-[var(--gain)]/35 bg-[var(--gain)]/10',
  down: 'text-[var(--loss)] border-[var(--loss)]/35 bg-[var(--loss)]/10',
  neutral: 'text-[var(--stone)] border-[var(--hairline)] bg-[var(--ink-900)]',
  info: 'text-[var(--brass)] border-[var(--brass)]/35 bg-[var(--accent-subtle)]',
  live: 'text-[var(--gain)] border-[var(--gain)]/35 bg-[var(--gain)]/10'
}

/* Badge: dot only when the state is live. StatusPill retained as compat. */
export function Badge({ tone = 'neutral', live = false, children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium',
        tones[tone] || tones.neutral,
        className
      )}
    >
      {live && <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

export default function StatusPill({ tone = 'neutral', children, className }) {
  return (
    <Badge tone={tone} live className={className}>
      {children}
    </Badge>
  )
}
