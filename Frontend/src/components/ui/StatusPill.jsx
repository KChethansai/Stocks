import { cn } from '../../lib/utils'

const tones = {
  up: 'text-positive border-positive/35 bg-[var(--positive-subtle)]',
  down: 'text-negative border-negative/35 bg-[var(--negative-subtle)]',
  neutral: 'text-text-secondary border-border bg-surface',
  info: 'text-accent border-accent/35 bg-[var(--accent-subtle)]'
}

export default function StatusPill({ tone = 'neutral', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium',
        tones[tone] || tones.neutral,
        className
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}