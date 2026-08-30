import cron from 'node-cron'
import { predictionLogModel } from '../models/PredictionLogModel.js'
import { ensureHistory } from './history.js'

const deadband = 0.001
const directionFor = (change) => change > deadband ? 'UP' : change < -deadband ? 'DOWN' : 'NEUTRAL'

export async function resolvePredictionAccuracy() {
  const pending = await predictionLogModel.find({ targetDate: { $lte: new Date() }, resolvedAt: null }).limit(1000).lean()
  let resolved = 0
  let correct = 0
  for (const log of pending) {
    try {
      const candles = await ensureHistory(log.symbol)
      const target = candles?.filter((c) => new Date(c.timestamp) <= new Date(log.targetDate)).at(-1)
      if (!target) continue
      const actualDirection = directionFor((target.close - log.priceAtPrediction) / log.priceAtPrediction)
      const wasCorrect = actualDirection === log.direction
      await predictionLogModel.updateOne({ _id: log._id, resolvedAt: null }, { $set: { actualPrice: target.close, actualDirection, wasCorrect, resolvedAt: new Date() } })
      resolved += 1
      if (wasCorrect) correct += 1
    } catch (error) { console.error(`[Accuracy] ${log.symbol} failed:`, error.message) }
  }
  console.log(`[Accuracy] resolved=${resolved} correct=${correct}`)
  return { resolved, correct }
}

export function startAccuracyResolver() {
  const schedule = process.env.ACCURACY_RESOLVE_CRON || '30 21 * * 1-5'
  if (!cron.validate(schedule)) return null
  return cron.schedule(schedule, () => resolvePredictionAccuracy().catch((e) => console.error('[Accuracy] cron:', e.message)))
}
