import { Schema, model } from 'mongoose'

/**
 * Per-user paper-trading automation rule driven by ML predictions.
 * Only acts on virtual balances — never real money.
 */
const automationRuleSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    /** BUY | SELL | ALERT */
    action: {
      type: String,
      enum: ['BUY', 'SELL', 'ALERT'],
      default: 'ALERT'
    },
    /** Fire when predicted direction matches (or ANY) */
    direction: {
      type: String,
      enum: ['UP', 'DOWN', 'ANY'],
      default: 'ANY'
    },
    /**
     * 0–1 confidence floor. The API accepts a 0–100 percentage and normalises
     * it to this fraction, so both units work from the client side.
     */
    confidenceThreshold: {
      type: Number,
      default: 0.65,
      min: 0.3,
      max: 0.95
    },
    /** Fallback share count when no budget/percent sizing is configured. */
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 10000
    },
    /**
     * BUY sizing: virtual cash to deploy per trigger. Shares bought =
     * floor(budgetPerTrade / price). `0` means fall back to `quantity`.
     */
    budgetPerTrade: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000000
    },
    /**
     * SELL sizing: percentage of the held position to liquidate per trigger.
     * `0` means fall back to `quantity`.
     */
    percentToSell: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    /** Minutes that must elapse after `lastTriggeredAt` before firing again. */
    cooldownMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 10080
    },
    lastTriggeredAt: {
      type: Date,
      default: null
    },
    lastPrediction: {
      direction: String,
      confidence: Number,
      predictedPrice: Number
    },
    /** Set on every automation pass, whether or not the rule fired. */
    lastEvaluatedAt: {
      type: Date,
      default: null
    },
    /**
     * Why the last evaluation did not trade. Drives the real status rows in the
     * "Control above action" UI instead of guessing state on the client.
     */
    lastSkipReason: {
      type: String,
      enum: [
        'NONE',
        'COOLDOWN',
        'THRESHOLD_NOT_MET',
        'DIRECTION_MISMATCH',
        'INSUFFICIENT_DATA',
        'INSUFFICIENT_FUNDS',
        'NO_POSITION',
        'DAILY_CAP_REACHED',
        'PRICE_UNAVAILABLE',
        'ERROR'
      ],
      default: 'NONE'
    },
    triggerCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true, versionKey: false }
)

automationRuleSchema.index({ userId: 1, symbol: 1 }, { unique: true })

export const automationRuleModel = model('automationRule', automationRuleSchema)
