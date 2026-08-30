import exp from 'express'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { automationRuleModel } from '../models/AutomationRuleModel.js'
import { alertModel } from '../models/AlertModel.js'
import { ensureHistory } from '../ml/history.js'
import { predict, predictBatch } from '../ml/predictor.js'
import { predictionLogModel } from '../models/PredictionLogModel.js'
import { resolvePredictionAccuracy } from '../ml/accuracyResolver.js'

export const mlApp = exp.Router()

const isValidSymbol = (symbol) => /^[A-Z.]{1,10}$/.test(symbol || '')
const isObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(value || '')

// ── Prediction cache ──────────────────────────────────────────────
// Predictions are deterministic per (symbol, horizon) until new candles land,
// so a short in-memory TTL removes most of the recompute + Yahoo traffic.
const PREDICTION_TTL_MS = 5 * 60 * 1000
const predictionCache = new Map()

// Presentation-only metric. It is deliberately opt-in and clearly marked so
// it cannot be mistaken for verified model performance.
const demoAccuracy = {
  insufficientData: false,
  demo: true,
  accuracy: 0.88,
  total: 50,
  correct: 44,
  currentStreak: 6,
  streakType: 'win',
  byDirection: {
    UP: { total: 25, correct: 22, precision: 0.88 },
    DOWN: { total: 25, correct: 22, precision: 0.88 }
  },
  calibration: [
    { bucket: 7, confidence: '70-80%', total: 10, hitRate: 0.8 },
    { bucket: 8, confidence: '80-90%', total: 30, hitRate: 0.9 },
    { bucket: 9, confidence: '90-100%', total: 10, hitRate: 0.9 }
  ],
  predictions: []
}

const isDemoAccuracyEnabled = () => process.env.ML_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production'

const cacheKey = (symbol, horizon) => `${symbol}:${horizon}`

/**
 * Prediction for one symbol, served from the 5-minute cache when warm.
 * Never throws — failures resolve to `{ ok: false, insufficientData: true }`.
 */
export async function predictSymbol(symbol, horizonDays = 1) {
  const key = cacheKey(symbol, horizonDays)
  const hit = predictionCache.get(key)
  if (hit && Date.now() - hit.at < PREDICTION_TTL_MS) return hit.value

  const prediction = await predict(symbol, { horizon: horizonDays })

  // Enrich with live stock metadata so widgets can render without a second call.
  const stock = await stockModel.findOne({ symbol }).lean()
  const value = {
    symbol,
    name: stock?.name || symbol,
    sector: stock?.sector || null,
    livePrice: stock?.price ?? prediction.currentPrice ?? null,
    cachedAt: new Date(),
    ...prediction
  }

  if (value.ok) await logPrediction(value, horizonDays)

  // Only cache usable results — a transient Yahoo failure should retry sooner.
  if (value.ok) predictionCache.set(key, { at: Date.now(), value })

  return value
}

/** Batch variant: one stock lookup for the whole set instead of N. */
async function predictSymbolBatch(symbols, horizonDays = 1) {
  const warm = []
  const cold = []

  for (const symbol of symbols) {
    const hit = predictionCache.get(cacheKey(symbol, horizonDays))
    if (hit && Date.now() - hit.at < PREDICTION_TTL_MS) warm.push(hit.value)
    else cold.push(symbol)
  }

  if (cold.length === 0) return warm

  const [predictions, stocks] = await Promise.all([
    predictBatch(cold, { horizon: horizonDays }),
    stockModel.find({ symbol: { $in: cold } }).lean()
  ])

  const stockBySymbol = new Map(stocks.map((s) => [s.symbol, s]))

  const fresh = await Promise.all(predictions.map(async (prediction) => {
    const stock = stockBySymbol.get(prediction.symbol)
    const value = {
      symbol: prediction.symbol,
      name: stock?.name || prediction.symbol,
      sector: stock?.sector || null,
      livePrice: stock?.price ?? prediction.currentPrice ?? null,
      cachedAt: new Date(),
      ...prediction
    }
    if (value.ok) await logPrediction(value, horizonDays)
    if (value.ok) predictionCache.set(cacheKey(prediction.symbol, horizonDays), { at: Date.now(), value })
    return value
  }))

  // Preserve the caller's requested order.
  const bySymbol = new Map([...warm, ...fresh].map((p) => [p.symbol, p]))
  return symbols.map((s) => bySymbol.get(s)).filter(Boolean)
}

async function logPrediction(prediction, horizonDays) {
  try {
    const price = prediction.currentPrice ?? prediction.livePrice
    if (!(price > 0)) return
    const createdAt = new Date()
    const targetDate = new Date(createdAt)
    targetDate.setUTCDate(targetDate.getUTCDate() + horizonDays)
    await predictionLogModel.create({ symbol: prediction.symbol, direction: prediction.direction, confidence: prediction.confidence, predictedPrice: prediction.predictedPrice, predictedRange: prediction.predictedRange, priceAtPrediction: price, horizonDays, targetDate })
  } catch (error) {
    console.error('[ML] prediction log write failed:', error.message)
  }
}

/** Re-exported so existing callers keep working. */
export { ensureHistory }

// ── GET /ml-api/predict/:symbol?horizon=1 ─────────────────────────
mlApp.get('/predict/:symbol', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const horizon = Math.min(5, Math.max(1, Number.parseInt(req.query.horizon, 10) || 1))
    const result = await predictSymbol(symbol, horizon)

    if (!result.ok) {
      // Graceful, not an error: the symbol simply lacks enough history.
      return res.status(200).json({
        message: result.message || 'Prediction unavailable',
        symbol,
        insufficientData: true,
        candleCount: result.candleCount ?? 0,
        prediction: null
      })
    }

    return res.status(200).json({ message: 'Prediction ready', prediction: result })
  } catch (err) {
    next(err)
  }
})

// ── GET /ml-api/predict?symbols=AAPL,NVDA ─────────────────────────
mlApp.get('/predict', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

    const raw = typeof req.query.symbols === 'string' ? req.query.symbols : ''
    let symbols = [
      ...new Set(
        raw
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(isValidSymbol)
      )
    ].slice(0, 8)

    if (symbols.length === 0) {
      const top = await stockModel.find().sort({ volume: -1 }).limit(5).lean()
      symbols = top.map((s) => s.symbol)
    }

    const horizon = Math.min(5, Math.max(1, Number.parseInt(req.query.horizon, 10) || 1))
    const results = await predictSymbolBatch(symbols, horizon)

    const predictions = results.filter((p) => p.ok)
    const unavailable = results.filter((p) => !p.ok).map((p) => p.symbol)

    return res.status(200).json({
      message: 'Batch predictions ready',
      count: predictions.length,
      predictions,
      unavailable
    })
  } catch (err) {
    next(err)
  }
})

// ══ Automation rules (authenticated) ═══════════════════════════════
mlApp.use('/automation', verifyToken('USER'))

/** Accept either a 0–1 fraction or a 0–100 percentage; store the fraction. */
const normalizeThreshold = (input, fallback = 0.65) => {
  let value = Number(input)
  if (!Number.isFinite(value)) return fallback
  if (value > 1) value /= 100
  return Math.min(0.95, Math.max(0.3, value))
}

const clampInt = (input, min, max, fallback) => {
  const value = Number.parseInt(input, 10)
  if (!Number.isInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const clampNumber = (input, min, max, fallback) => {
  const value = Number(input)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

mlApp.get('/automation', async (req, res, next) => {
  try {
    const rules = await automationRuleModel
      .find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .lean()
    return res.status(200).json({ message: 'Automation rules fetched', rules })
  } catch (err) {
    next(err)
  }
})

mlApp.post('/automation', async (req, res, next) => {
  try {
    const symbol = typeof req.body.symbol === 'string' ? req.body.symbol.toUpperCase().trim() : ''
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const stock = await stockModel.findOne({ symbol }).lean()
    if (!stock) {
      return res.status(404).json({ message: 'Stock not in tracked universe' })
    }

    const action = ['BUY', 'SELL', 'ALERT'].includes(req.body.action) ? req.body.action : 'ALERT'
    const direction = ['UP', 'DOWN', 'ANY'].includes(req.body.direction) ? req.body.direction : 'ANY'
    const confidenceThreshold = normalizeThreshold(req.body.confidenceThreshold)
    const quantity = clampInt(req.body.quantity, 1, 10000, 1)
    const cooldownMinutes = clampInt(req.body.cooldownMinutes, 5, 10080, 60)
    const budgetPerTrade = clampNumber(req.body.budgetPerTrade, 0, 1000000, 0)
    const percentToSell = clampNumber(req.body.percentToSell, 0, 100, 0)
    const enabled = req.body.enabled !== false

    // A BUY rule must be fundable right now, otherwise it would only ever log skips.
    if (action === 'BUY' && budgetPerTrade > 0) {
      const user = await userModel.findById(req.user.id).select('balance').lean()
      if (!user) return res.status(404).json({ message: 'User not found' })

      if (budgetPerTrade > user.balance) {
        return res.status(400).json({
          message: `Budget per trade (${budgetPerTrade}) exceeds available cash (${user.balance})`
        })
      }
      if (budgetPerTrade < stock.price) {
        return res.status(400).json({
          message: `Budget per trade (${budgetPerTrade}) is below one share of ${symbol} (${stock.price})`
        })
      }
    }

    const rule = await automationRuleModel
      .findOneAndUpdate(
        { userId: req.user.id, symbol },
        {
          $set: {
            action,
            direction,
            confidenceThreshold,
            quantity,
            cooldownMinutes,
            budgetPerTrade,
            percentToSell,
            enabled
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .lean()

    return res.status(200).json({ message: 'Automation rule saved', rule })
  } catch (err) {
    next(err)
  }
})

mlApp.patch('/automation/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const updates = {}
    if (typeof req.body.enabled === 'boolean') updates.enabled = req.body.enabled
    if (['BUY', 'SELL', 'ALERT'].includes(req.body.action)) updates.action = req.body.action
    if (['UP', 'DOWN', 'ANY'].includes(req.body.direction)) updates.direction = req.body.direction
    if (req.body.confidenceThreshold !== undefined) {
      updates.confidenceThreshold = normalizeThreshold(req.body.confidenceThreshold)
    }
    if (req.body.quantity !== undefined) updates.quantity = clampInt(req.body.quantity, 1, 10000, 1)
    if (req.body.cooldownMinutes !== undefined) {
      updates.cooldownMinutes = clampInt(req.body.cooldownMinutes, 5, 10080, 60)
    }
    if (req.body.budgetPerTrade !== undefined) {
      updates.budgetPerTrade = clampNumber(req.body.budgetPerTrade, 0, 1000000, 0)
    }
    if (req.body.percentToSell !== undefined) {
      updates.percentToSell = clampNumber(req.body.percentToSell, 0, 100, 0)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' })
    }

    const rule = await automationRuleModel
      .findOneAndUpdate({ userId: req.user.id, symbol }, { $set: updates }, { new: true })
      .lean()

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' })
    }

    return res.status(200).json({ message: 'Automation rule updated', rule })
  } catch (err) {
    next(err)
  }
})

mlApp.delete('/automation/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const deleted = await automationRuleModel.findOneAndDelete({ userId: req.user.id, symbol })
    if (!deleted) {
      return res.status(404).json({ message: 'Automation rule not found' })
    }

    return res.status(200).json({ message: 'Automation rule removed' })
  } catch (err) {
    next(err)
  }
})

// ══ Alerts (authenticated) ═════════════════════════════════════════
mlApp.use('/alerts', verifyToken('USER'))

// GET /ml-api/alerts?includeRead=true
mlApp.get('/alerts', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

    const query = { userId: req.user.id }
    if (req.query.includeRead !== 'true') query.read = false

    const [alerts, unreadCount] = await Promise.all([
      alertModel.find(query).sort({ createdAt: -1 }).limit(50).lean(),
      alertModel.countDocuments({ userId: req.user.id, read: false })
    ])

    return res.status(200).json({ message: 'Alerts fetched', alerts, unreadCount })
  } catch (err) {
    next(err)
  }
})

mlApp.patch('/alerts/:id/read', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert id' })
    }

    const alert = await alertModel
      .findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { read: true } }, { new: true })
      .lean()

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' })
    }

    return res.status(200).json({ message: 'Alert marked read', alert })
  } catch (err) {
    next(err)
  }
})

// Prediction accuracy (authenticated; logs are global model telemetry).
mlApp.use('/accuracy', verifyToken('USER'))
const accuracySummary = async (query, limit = 30) => {
  const logs = await predictionLogModel.find({ ...query, resolvedAt: { $ne: null } }).sort({ resolvedAt: -1 }).limit(limit).lean()
  if (logs.length < 10) return { insufficientData: true, resolved: logs.length, predictions: logs }
  const correct = logs.filter((l) => l.wasCorrect).length
  const byDirection = {}
  for (const direction of ['UP', 'DOWN']) {
    const rows = logs.filter((l) => l.direction === direction)
    byDirection[direction] = { total: rows.length, correct: rows.filter((l) => l.wasCorrect).length, precision: rows.length ? rows.filter((l) => l.wasCorrect).length / rows.length : null }
  }
  const buckets = Array.from({ length: 10 }, (_, bucket) => {
    const rows = logs.filter((l) => Math.min(9, Math.floor(l.confidence * 10)) === bucket)
    return { bucket, confidence: `${bucket * 10}-${bucket * 10 + 10}%`, total: rows.length, hitRate: rows.length ? rows.filter((l) => l.wasCorrect).length / rows.length : null }
  })
  return { insufficientData: false, accuracy: correct / logs.length, total: logs.length, correct, byDirection, calibration: buckets, predictions: logs }
}

mlApp.get('/accuracy/:symbol', async (req, res, next) => {
  try {
    if (isDemoAccuracyEnabled()) return res.json(demoAccuracy)
    return res.json(await accuracySummary({ symbol: req.params.symbol.toUpperCase() }, Math.min(100, Number(req.query.limit) || 30)))
  } catch (e) { next(e) }
})
mlApp.get('/accuracy', async (req, res, next) => {
  try {
    if (isDemoAccuracyEnabled()) return res.json(demoAccuracy)
    const logs = await predictionLogModel.find({ resolvedAt: { $ne: null } }).sort({ resolvedAt: -1 }).limit(1000).lean()
    const summary = await accuracySummary({}, 1000)
    let streak = 0; let streakType = null
    for (const log of logs) { const type = log.wasCorrect ? 'win' : 'loss'; if (!streakType) streakType = type; if (type !== streakType) break; streak += 1 }
    return res.json({ ...summary, currentStreak: streak, streakType })
  } catch (e) { next(e) }
})
mlApp.post('/accuracy/resolve-now', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(404).end()
    return res.json(await resolvePredictionAccuracy())
  } catch (e) { next(e) }
})
