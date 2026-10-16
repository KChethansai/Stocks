import { cn } from '../../lib/utils'
import { fmtPct } from '../../utils/format'

/* Stat: chromeless figure. 13px stone label, 28px tabular value, signed delta.
 * StatCard is retained as a compat alias until callers migrate (Phase 5). */
export function Stat({ label, value, delta, sub, className, valueClassName }) {
  const positive = delta != null && Number(delta) >= 0
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-[13px] leading-5 text-[var(--stone)]">{label}</p>
      <p className={cn('text-[28px] leading-8 font-medium text-[var(--ivory)] tabular-nums', valueClassName)}>
        {value}
      </p>
      {delta != null && (
        <p className={cn('text-xs tabular-nums', positive ? 'text-[var(--gain)]' : 'text-[var(--loss)]')}>
          {fmtPct(delta)}
        </p>
      )}
      {sub && <p className="text-xs text-[var(--stone)]">{sub}</p>}
    </div>
  )
}

export default function StatCard({ label, value, delta, sub, className, valueClassName }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--hairline)] bg-[var(--ink-900)] p-4',
        className
      )}
    >
      <Stat label={label} value={value} delta={delta} sub={sub} valueClassName={valueClassName} />
    </div>
  )
}
