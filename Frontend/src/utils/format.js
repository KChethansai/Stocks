/* Central display formatting (Phase 1 foundation).
 * All user-visible numbers and dates go through here (Intl-based).
 * Numeric CALCULATIONS stay numeric at their call sites — these helpers are
 * for display strings only. True minus sign (U+2212) is avoided on purpose:
 * ASCII hyphen-minus renders consistently in tabular figures.
 */
const moneyFmt = (digits) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })

const numFmt = (digits) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })

const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

/** $1,234.56 — display only. */
export const fmtMoney = (value, digits = 2) => moneyFmt(digits).format(Number(value || 0))

/** +$1,234.56 / -$1,234.56 with explicit sign — display only. */
export const fmtSignedMoney = (value, digits = 2) => {
  const n = Number(value || 0)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${moneyFmt(digits).format(Math.abs(n))}`
}

/** +1.24% / -1.24% — display only. */
export const fmtPct = (value, digits = 2) => {
  const n = Number(value || 0)
  const sign = n > 0 ? '+' : ''
  return `${sign}${numFmt(digits).format(n)}%`
}

/** 1.2M / 3.4B for currency-scale values — display only. */
export const fmtCompactMoney = (value) => {
  const n = Number(value || 0)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return fmtMoney(n, 0)
}

/** 12.4M share counts WITHOUT currency symbols — display only. */
export const fmtShares = (value) => {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1000) return compactFmt.format(n)
  return numFmt(0).format(n)
}

/** Whole-share quantities with grouping — display only. */
export const fmtQty = (value) => numFmt(0).format(Number(value || 0))

/** Aug 14, 2026 — display only. */
export const fmtDate = (value) => {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

/** 2:30:15 PM — display only. */
export const fmtTime = (value) => {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(d)
}

/** Relative "3h ago" for inbox-style timestamps — display only. */
export const fmtRelativeTime = (value) => {
  const t = value ? new Date(value).getTime() : 0
  if (!t) return '—'
  const minutes = Math.max(0, Math.floor((Date.now() - t) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}
