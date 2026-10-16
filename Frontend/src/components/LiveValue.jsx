import { cn } from '@/lib/utils'

/* LiveValue: tabular digits, silent text swap on change (D3 — the 400ms
 * gain/loss flash was deleted: motion on money reads as volatility).
 * Plain text with no live region — correct for values that poll on an
 * interval, where a live region would spam screen-reader users. */
export function LiveValue({ value, format = (v) => String(v), className }) {
  return <span className={cn('tabular-nums', className)}>{format(value)}</span>
}
