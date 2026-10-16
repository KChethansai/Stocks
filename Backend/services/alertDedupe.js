// Inbox-alert deduplication (side-effect free: safe to import from unit
// tests without booting the automation scheduler).
//
// Root cause (Oct 2026): every ALERT-rule trigger minted a brand-new inbox
// row, so an AAPL rule firing each pass kept producing fresh UNREAD rows —
// the user could mark rows read forever and new unread ones kept arriving.
// The fix skips a trigger when an identical unread notification (same user,
// symbol, direction) already exists inside the rule's cooldown window.
export function recentUnreadAlertQuery(userId, symbol, direction, sinceDate) {
  return {
    userId,
    symbol,
    direction,
    read: false,
    createdAt: { $gte: sinceDate }
  }
}

export function alertDedupeWindowStart(rule, now = Date.now()) {
  const minutes = rule?.cooldownMinutes ?? 60
  return new Date(now - minutes * 60 * 1000)
}
import { createHash } from 'node:crypto'

export function predictionEventKey(rule, prediction) {
  const observedAt = prediction.asOf && new Date(prediction.asOf).getTime()
  if (!rule.userId || !rule._id || !prediction.model || !Number.isFinite(observedAt) || observedAt <= 0) {
    throw new Error('Prediction notification requires a rule, model and observation timestamp')
  }
  return `prediction:${createHash('sha256').update(JSON.stringify([
    String(rule.userId), String(rule._id), rule.symbol, prediction.model,
    prediction.releaseId ?? null, prediction.featureSchema ?? null,
    prediction.horizon ?? prediction.horizonDays ?? 1, observedAt, prediction.direction
  ])).digest('hex')}`
}

export async function writeAlertOnce(model, alert) {
  if (!alert.userId || !alert.eventKey) throw new Error('Notification event identity is required')
  try {
    const result = await model.updateOne(
      { userId: alert.userId, eventKey: alert.eventKey },
      { $setOnInsert: alert },
      { upsert: true, runValidators: true }
    )
    return result.upsertedCount === 1
  } catch (err) {
    if (err.code === 11000) return false
    throw err
  }
}
