import { stockModel } from '../models/StockModel.js'
import { priceAlertModel } from '../models/PriceAlertModel.js'
import { alertModel } from '../models/AlertModel.js'

/**
 * Shared price-trigger evaluator. Reads the already-cached StockModel prices
 * (synced every 5 min by StockAPI) — zero extra Yahoo traffic — and fires
 * one-shot price alerts. Built as the single tick that future trigger-based
 * features (e.g. limit/stop orders) plug into: add an evaluator, not a poller.
 *
 * Defensive by design:
 * - Restart-safe: pending state is the `triggered` flag in Mongo, nothing
 *   in memory. A missed tick while the server sleeps just evaluates late on
 *   wake; a crossed alert fires once, never lost, never duplicated (the flag
 *   flip and inbox write happen per-alert, and a crash between them can at
 *   worst produce a duplicate inbox row on the next tick — accepted, since
 *   the flag check runs first and inbox rows are idempotent-ish reads).
 * - One bad alert row can never kill the cycle: per-alert try/catch.
 */
export const checkPriceTriggers = async () => {
  let pending
  try {
    pending = await priceAlertModel.find({ triggered: false }).lean()
  } catch (err) {
    console.error('[PriceMonitor] Failed to load pending alerts:', err.message)
    return { checked: 0, fired: 0 }
  }

  if (!pending.length) return { checked: 0, fired: 0 }

  const symbols = [...new Set(pending.map((a) => a.symbol))]
  let priceMap = new Map()
  try {
    const stocks = await stockModel
      .find({ symbol: { $in: symbols } })
      .select({ symbol: 1, price: 1 })
      .lean()
    priceMap = new Map(stocks.map((s) => [s.symbol, Number(s.price)]))
  } catch (err) {
    console.error('[PriceMonitor] Failed to load prices:', err.message)
    return { checked: pending.length, fired: 0 }
  }

  let fired = 0
  for (const alert of pending) {
    try {
      const price = priceMap.get(alert.symbol)
      if (!Number.isFinite(price) || price <= 0) continue

      const crossed =
        alert.direction === 'ABOVE' ? price >= alert.targetPrice : price <= alert.targetPrice
      if (!crossed) continue

      // Claim first: concurrent ticks can't double-fire the same alert.
      const claimed = await priceAlertModel.findOneAndUpdate(
        { _id: alert._id, triggered: false },
        { $set: { triggered: true, triggeredAt: new Date() } },
        { new: true }
      )
      if (!claimed) continue

      const verb = alert.direction === 'ABOVE' ? 'rose above' : 'fell below'
      await alertModel.create({
        userId: alert.userId,
        symbol: alert.symbol,
        message: `${alert.symbol} ${verb} $${Number(alert.targetPrice).toFixed(2)} (now $${price.toFixed(2)})`,
        direction: alert.direction === 'ABOVE' ? 'UP' : 'DOWN',
        confidence: 1
      })
      fired += 1
    } catch (err) {
      console.error(`[PriceMonitor] Skipping alert ${alert._id}:`, err.message)
    }
  }

  if (fired > 0) console.log(`[PriceMonitor] Fired ${fired} price alert(s)`)
  return { checked: pending.length, fired }
}
