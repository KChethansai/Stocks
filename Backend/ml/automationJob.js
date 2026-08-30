import cron from 'node-cron'
import { automationRuleModel } from '../models/AutomationRuleModel.js'
import { alertModel } from '../models/AlertModel.js'
import { stockModel } from '../models/StockModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { executePaperTrade } from '../services/tradeService.js'
import { predict } from './predictor.js'

/**
 * ML-driven automation engine.
 *
 * Every enabled rule is evaluated against a fresh prediction; qualifying rules
 * execute through the same `executePaperTrade` service the manual routes use, so
 * balance and holdings validation is identical. Paper money only.
 */

const DEFAULT_CRON = '*/15 * * * *'
const DEFAULT_MAX_TRADES_PER_DAY = 10

const automationCron = () => process.env.AUTOMATION_INTERVAL_CRON || DEFAULT_CRON

const maxTradesPerDay = () => {
  const parsed = Number.parseInt(process.env.MAX_AUTOMATION_TRADES_PER_DAY, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_TRADES_PER_DAY
}

const startOfUtcDay = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Automation trades already executed for a user since midnight UTC.
 * Counted from the transaction ledger rather than a separate counter — nothing to
 * reset, and it stays correct across restarts.
 */
const automationTradesToday = (userId) =>
  transactionModel.countDocuments({
    userId,
    source: 'AUTOMATION',
    type: { $in: ['BUY', 'SELL'] },
    createdAt: { $gte: startOfUtcDay() }
  })

const isInCooldown = (rule, now) => {
  if (!rule.lastTriggeredAt) return false
  const cooldownMs = (rule.cooldownMinutes ?? 60) * 60 * 1000
  return now - new Date(rule.lastTriggeredAt).getTime() < cooldownMs
}

/**
 * Resolve how many shares a rule should trade.
 * BUY  → budgetPerTrade / price, else `quantity`.
 * SELL → percentToSell of the held position, else `quantity` (capped at holding).
 *
 * @returns {Promise<{quantity: number, skipReason?: string}>}
 */
async function resolveQuantity(rule, stock) {
  if (rule.action === 'BUY') {
    if (rule.budgetPerTrade > 0) {
      const shares = Math.floor(rule.budgetPerTrade / stock.price)
      if (shares < 1) return { quantity: 0, skipReason: 'INSUFFICIENT_FUNDS' }
      return { quantity: shares }
    }
    return { quantity: rule.quantity || 1 }
  }

  // SELL — must actually hold the position.
  const portfolio = await portfolioModel.findOne({ userId: rule.userId }).lean()
  const holding = portfolio?.holdings?.find((h) => h.symbol === rule.symbol)
  if (!holding || holding.quantity < 1) return { quantity: 0, skipReason: 'NO_POSITION' }

  if (rule.percentToSell > 0) {
    const shares = Math.floor((holding.quantity * rule.percentToSell) / 100)
    if (shares < 1) return { quantity: 0, skipReason: 'NO_POSITION' }
    return { quantity: shares }
  }

  const wanted = rule.quantity || 1
  return { quantity: Math.min(wanted, holding.quantity) }
}

const recordEvaluation = (ruleId, skipReason, extra = {}) =>
  automationRuleModel.updateOne(
    { _id: ruleId },
    { $set: { lastEvaluatedAt: new Date(), lastSkipReason: skipReason, ...extra } }
  )

/**
 * Evaluate every enabled automation rule once.
 * Each rule is isolated in its own try/catch so a single failure cannot abort the pass.
 *
 * @returns {Promise<{evaluated: number, triggered: number, skipped: number, errors: number, actions: object[]}>}
 */
export async function runAutomationPass() {
  const rules = await automationRuleModel.find({ enabled: true }).lean()
  const summary = { evaluated: rules.length, triggered: 0, skipped: 0, errors: 0, actions: [] }

  if (rules.length === 0) {
    console.log('[Automation] No enabled rules')
    return summary
  }

  console.log(`[Automation] Evaluating ${rules.length} enabled rule(s)`)

  const dailyCap = maxTradesPerDay()
  /** Cache the per-user trade count for this pass so one rule's fill affects the next. */
  const tradeCounts = new Map()
  const now = Date.now()

  for (const rule of rules) {
    try {
      if (isInCooldown(rule, now)) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'COOLDOWN')
        continue
      }

      const prediction = await predict(rule.symbol, { horizon: 1 })

      if (!prediction.ok) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'INSUFFICIENT_DATA')
        continue
      }

      // Always persist the latest read, even when the rule does not fire.
      const lastPrediction = {
        direction: prediction.direction,
        confidence: prediction.confidence,
        predictedPrice: prediction.predictedPrice
      }

      const directionOk = rule.direction === 'ANY' || prediction.direction === rule.direction
      const actionAligned =
        rule.action === 'ALERT' ||
        (rule.action === 'BUY' && prediction.direction === 'UP') ||
        (rule.action === 'SELL' && prediction.direction === 'DOWN')

      if (!directionOk || !actionAligned) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'DIRECTION_MISMATCH', { lastPrediction })
        continue
      }

      if (prediction.confidence < rule.confidenceThreshold) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'THRESHOLD_NOT_MET', { lastPrediction })
        continue
      }

      // ── ALERT: notify, never trade ────────────────────────────────
      if (rule.action === 'ALERT') {
        await alertModel.create({
          userId: rule.userId,
          symbol: rule.symbol,
          direction: prediction.direction,
          confidence: prediction.confidence,
          message: `${rule.symbol} forecast ${prediction.direction} at ${prediction.confidencePct}% confidence — target ${prediction.predictedPrice} (range ${prediction.predictedRange.low}–${prediction.predictedRange.high})`
        })

        await automationRuleModel.updateOne(
          { _id: rule._id },
          {
            $set: {
              lastTriggeredAt: new Date(),
              lastEvaluatedAt: new Date(),
              lastSkipReason: 'NONE',
              lastPrediction
            },
            $inc: { triggerCount: 1 }
          }
        )

        summary.triggered += 1
        summary.actions.push({ symbol: rule.symbol, action: 'ALERT', confidence: prediction.confidence })
        console.log(`[Automation] ALERT ${rule.symbol} user=${rule.userId} conf=${prediction.confidencePct}%`)
        continue
      }

      // ── BUY / SELL: safety rails, then execute ────────────────────
      const userKey = String(rule.userId)
      if (!tradeCounts.has(userKey)) {
        tradeCounts.set(userKey, await automationTradesToday(rule.userId))
      }
      if (tradeCounts.get(userKey) >= dailyCap) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'DAILY_CAP_REACHED', { lastPrediction })
        console.log(
          `[Automation] SKIP ${rule.symbol} user=${rule.userId} — daily automation cap (${dailyCap}) reached`
        )
        continue
      }

      const stock = await stockModel.findOne({ symbol: rule.symbol }).lean()
      if (!stock || !(stock.price > 0)) {
        summary.skipped += 1
        await recordEvaluation(rule._id, 'PRICE_UNAVAILABLE', { lastPrediction })
        continue
      }

      const { quantity, skipReason } = await resolveQuantity(rule, stock)
      if (skipReason || quantity < 1) {
        summary.skipped += 1
        await recordEvaluation(rule._id, skipReason || 'NO_POSITION', { lastPrediction })
        console.log(`[Automation] SKIP ${rule.action} ${rule.symbol} user=${rule.userId} — ${skipReason}`)
        continue
      }

      let result
      try {
        result = await executePaperTrade({
          userId: rule.userId,
          symbol: rule.symbol,
          quantity,
          side: rule.action,
          source: 'AUTOMATION',
          stock
        })
      } catch (tradeErr) {
        // Expected business failures (funds/holdings) skip the rule, they do not
        // fail the pass — same checks the manual routes enforce.
        const reason =
          tradeErr.message === 'Insufficient balance'
            ? 'INSUFFICIENT_FUNDS'
            : tradeErr.message?.includes('holdings') || tradeErr.message?.includes('quantity to sell')
              ? 'NO_POSITION'
              : 'ERROR'

        summary.skipped += 1
        await recordEvaluation(rule._id, reason, { lastPrediction })
        console.log(
          `[Automation] SKIP ${rule.action} ${rule.symbol} user=${rule.userId} — ${tradeErr.message}`
        )
        continue
      }

      tradeCounts.set(userKey, tradeCounts.get(userKey) + 1)

      await automationRuleModel.updateOne(
        { _id: rule._id },
        {
          $set: {
            lastTriggeredAt: new Date(),
            lastEvaluatedAt: new Date(),
            lastSkipReason: 'NONE',
            lastPrediction
          },
          $inc: { triggerCount: 1 }
        }
      )

      summary.triggered += 1
      summary.actions.push({
        symbol: rule.symbol,
        action: rule.action,
        quantity: result.quantity,
        price: result.price,
        total: result.total,
        confidence: prediction.confidence
      })

      console.log(
        `[Automation] ${rule.action} ${result.quantity}x ${rule.symbol} @ ${result.price} ` +
          `(total ${result.total}) user=${rule.userId} conf=${prediction.confidencePct}% balance=${result.balance}`
      )
    } catch (err) {
      summary.errors += 1
      console.error(`[Automation] Rule ${rule._id} (${rule.symbol}) failed:`, err.message)
      try {
        await recordEvaluation(rule._id, 'ERROR')
      } catch {
        /* rule may have been deleted mid-pass — nothing to record */
      }
    }
  }

  console.log(
    `[Automation] Pass summary — evaluated=${summary.evaluated} triggered=${summary.triggered} ` +
      `skipped=${summary.skipped} errors=${summary.errors}`
  )

  return summary
}

/**
 * Schedule the automation pass. Interval configurable via `AUTOMATION_INTERVAL_CRON`.
 * `runAutomationPass()` stays safe to call directly for demos.
 */
export function startAutomationScheduler() {
  const schedule = automationCron()

  if (!cron.validate(schedule)) {
    console.error(`[Automation] Invalid AUTOMATION_INTERVAL_CRON "${schedule}" — falling back to ${DEFAULT_CRON}`)
    return startScheduler(DEFAULT_CRON)
  }

  return startScheduler(schedule)
}

function startScheduler(schedule) {
  cron.schedule(schedule, async () => {
    try {
      await runAutomationPass()
    } catch (err) {
      console.error('[Automation] Scheduler error:', err.message)
    }
  })

  console.log(
    `[Automation] Scheduler started (cron "${schedule}", max ${maxTradesPerDay()} trades/user/day, paper trades only)`
  )
}
