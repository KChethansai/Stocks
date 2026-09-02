import { cn } from '../../lib/utils'

function formatDelta(delta) {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${Number(delta).toFixed(2)}%`
}

export default function StatCard({
  label,
  value,
  delta,
  sub,
  className,
  valueClassName
}) {
  const positive = delta != null && delta >= 0
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-hover',
        className
      )}
    >
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p className={cn('mt-2 font-mono text-2xl font-medium text-text-primary', valueClassName)}>
        {value}
      </p>
      {delta != null && (
        <p className={cn('mt-1 font-mono text-xs', positive ? 'text-positive' : 'text-negative')}>
          {formatDelta(delta)}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-text-secondary">{sub}</p>}
    </div>
  )
}