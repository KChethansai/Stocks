import cron from 'node-cron'
import { predictionLogModel } from '../models/PredictionLogModel.js'
import { ensureHistory } from './history.js'

const deadband = 0.001
const directionFor = (change) => change > deadband ? 'UP' : change < -deadband ? 'DOWN' : 'NEUTRAL'

/** Logs with zero candles older than this are marked unresolvable, never retried forever. */
const UNRESOLVABLE_AFTER_DAYS = Number(process.env.ACCURACY_UNRESOLVABLE_AFTER_DAYS) || 30

/**
 * Pure per-log resolution decision against a candle list. No I/O — the unit
 * under isolated test (weekends/holidays, DST-safe session counting).
 *
 * @returns {{outcome: 'resolved'|'not-yet-due'|'awaiting-data'|'no-base',
 *   actualPrice?: number, actualDirection?: string, wasCorrect?: boolean,
 *   targetTimestamp?: Date}}
 */
export function decideLogResolution(log, candles, now = new Date()) {
  if (!candles?.length) return { outcome: 'awaiting-data', reason: 'missing-candles' }
  const createdAt = new Date(log.createdAt || Date.now())
  let baseIdx = -1
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    if (new Date(candles[i].timestamp) <= createdAt) { baseIdx = i; break }
  }
  if (baseIdx < 0) return { outcome: 'no-base', reason: 'no-candle-at-or-before-prediction' }
  const horizon = Math.max(1, Number(log.horizonDays) || 1)
  const targetIdx = baseIdx + horizon
  if (targetIdx >= candles.length) return { outcome: 'not-yet-due', reason: 'target-session-untraded' }
  const target = candles[targetIdx]
  if (new Date(target.timestamp) > now) return { outcome: 'not-yet-due', reason: 'target-in-future' }
  if (!(log.priceAtPrediction > 0) || !(target.close > 0)) {
    return { outcome: 'awaiting-data', reason: 'invalid-price' }
  }
  const actualDirection = directionFor((target.close - log.priceAtPrediction) / log.priceAtPrediction)
  return {
    outcome: 'resolved',
    actualPrice: target.close,
    actualDirection,
    wasCorrect: actualDirection === log.direction,
    targetTimestamp: target.timestamp
  }
}

/**
 * Resolve pending predictions using TRADING-SESSION horizons, not calendar days.
 * For each log: base = last candle at-or-before createdAt, target = base + horizonDays
 * sessions forward. A prediction is due only when that target session exists.
 * This keeps weekends/holidays from shifting a 1-session horizon to 3 calendar days.
 *
 * Phase 1.6:
 * - Idempotent + concurrency-safe: claims via updateOne({resolvedAt: null}) so
 *   overlapping workers/cron instances and retries cannot double-resolve.
 * - Lifecycle: pending → resolved | unresolvable (with resolutionReason).
 *   Logs older than UNRESOLVABLE_AFTER_DAYS whose target session can never be
 *   established (no candles at all) are marked unresolvable instead of pending
 *   forever. History is never rewritten: only pending logs transition.
 * - Dry-run: { dryRun: true } reports what WOULD resolve without any write.
 * - Injectable historyLoader for isolated tests (defaults to ensureHistory).
 *
 * @param {{dryRun?: boolean, limit?: number, now?: Date,
 *   historyLoader?: (symbol: string) => Promise<Array|null>,
 *   writer?: (filter: object, update: object) => Promise<{modifiedCount: number}>}} [options]
 */
export async function resolvePredictionAccuracy(options = {}) {
  const {
    dryRun = false,
    limit = 1000,
    now = new Date(),
    historyLoader = ensureHistory,
    writer = (filter, update) => predictionLogModel.updateOne(filter, update)
  } = options
  const pending = await predictionLogModel.find({ resolvedAt: null, status: { $ne: 'unresolvable' } }).sort({ createdAt: 1 }).limit(limit).lean()
  let resolved = 0
  let correct = 0
  let unresolvable = 0
  let notYetDue = 0
  let awaitingData = 0
  const byModel = {}
  const wouldResolve = []
  for (const log of pending) {
    try {
      const candles = await historyLoader(log.symbol)
      if (!candles?.length) {
        awaitingData += 1
        // No candles at all and the log is older than the grace window:
        // it can never resolve — mark unresolvable (reason recorded).
        const ageDays = (now - new Date(log.createdAt || now)) / 86_400_000
        if (!dryRun && ageDays > UNRESOLVABLE_AFTER_DAYS) {
          const r = await writer(
            { _id: log._id, resolvedAt: null },
            { $set: { status: 'unresolvable', resolutionReason: 'missing-candles' } }
          )
          if (r.modifiedCount > 0) unresolvable += 1
        }
        continue
      }
      const decision = decideLogResolution(log, candles, now)
      if (decision.outcome === 'no-base') continue
      if (decision.outcome === 'not-yet-due') {
        notYetDue += 1
        continue // target session not traded yet
      }
      if (decision.outcome === 'awaiting-data') {
        awaitingData += 1
        continue
      }
      const { actualDirection, wasCorrect, actualPrice } = decision
      if (dryRun) {
        resolved += 1
        if (wasCorrect) correct += 1
        wouldResolve.push(String(log._id))
        const m = log.model || 'unknown'
        byModel[m] = byModel[m] || { resolved: 0, correct: 0 }
        byModel[m].resolved += 1
        if (wasCorrect) byModel[m].correct += 1
        continue
      }
      const r = await writer(
        { _id: log._id, resolvedAt: null },
        {
          $set: {
            actualPrice,
            actualDirection,
            wasCorrect,
            resolvedAt: new Date(),
            status: 'resolved',
            resolutionReason: null,
            priceProvenance: log.priceProvenance || 'history-close'
          }
        }
      )
      if (r.modifiedCount > 0) {
        resolved += 1
        if (wasCorrect) correct += 1
        const m = log.model || 'unknown'
        byModel[m] = byModel[m] || { resolved: 0, correct: 0 }
        byModel[m].resolved += 1
        if (wasCorrect) byModel[m].correct += 1
      }
    } catch (error) { console.error(`[Accuracy] ${log.symbol} failed:`, error.message) }
  }
  console.log(`[Accuracy] resolved=${resolved} correct=${correct} unresolvable=${unresolvable} notYetDue=${notYetDue} awaitingData=${awaitingData} byModel=${JSON.stringify(byModel)}`)
  return { resolved, correct, unresolvable, notYetDue, awaitingData, byModel, wouldResolve, dryRun }
}

export function startAccuracyResolver() {
  const schedule = process.env.ACCURACY_RESOLVE_CRON || '30 21 * * 1-5'
  if (!cron.validate(schedule)) return null
  return cron.schedule(schedule, () => resolvePredictionAccuracy().catch((e) => console.error('[Accuracy] cron:', e.message)))
}
