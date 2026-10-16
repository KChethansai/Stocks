// Bell-dropdown read-state merge (side-effect free).
// Root cause (Oct 2026): the 30 s poll replaced the alert list wholesale, so
// a locally-confirmed read could flip back to unread on the next poll, and
// the badge count came from a separately-decremented counter that could drift
// from the list. This merge keeps confirmed reads across polls and derives
// the badge from the merged list — no global "all read" flag, no badge
// hiding. Server rows remain the source of truth for everything else.
export function mergeAlertsWithConfirmed(fetched, confirmedReadIds, serverUnreadCount) {
  const confirmed = confirmedReadIds instanceof Set ? confirmedReadIds : new Set(confirmedReadIds || [])
  const merged = (fetched || []).map((alert) => {
    if (!alert || typeof alert._id === 'undefined') return alert
    const id = String(alert._id)
    if (confirmed.has(id) && !alert.read) return { ...alert, read: true }
    return alert
  })
  const pruned = new Set()
  for (const alert of merged) {
    if (alert && typeof alert._id !== 'undefined') pruned.add(String(alert._id))
  }
  // Keep confirmed ids only while their rows still exist server-side.
  const live = new Set([...confirmed].filter((id) => pruned.has(id)))
  const localUnread = merged.filter((a) => a && !a.read).length
  const confirmedButStale = (fetched || []).filter((a) => a && !a.read && confirmed.has(String(a._id))).length
  // The API lists only the latest 50 rows but counts unread across the
  // entire account. Never replace that global count with a window count.
  const unreadCount = Number.isInteger(serverUnreadCount) && serverUnreadCount >= 0
    ? Math.max(0, serverUnreadCount - confirmedButStale)
    : localUnread
  return { alerts: merged, unreadCount, liveConfirmedIds: live }
}
