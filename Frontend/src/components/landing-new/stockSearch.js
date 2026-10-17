// Pure search/matching helpers for the public landing stock selector.
// Kept free of React and the store so they can be unit tested directly and
// reused by the component.
export function filterStocks(stocks, rawQuery) {
  const q = String(rawQuery ?? '').trim().toLowerCase()
  const list = Array.isArray(stocks) ? stocks.filter(Boolean) : []
  if (!q) return list
  return list.filter(
    (s) =>
      String(s.symbol ?? '').trim().toLowerCase().includes(q) ||
      String(s.name ?? '').trim().toLowerCase().includes(q)
  )
}

// Guard against a slow response for a previously selected symbol landing
// under a newer selection.
export function isCurrentSelection(seq, current) {
  return seq === current
}

export function formatAsOfLabel(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return `as of ${d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`
}