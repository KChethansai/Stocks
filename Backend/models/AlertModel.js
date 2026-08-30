import { Schema, model } from 'mongoose'

/**
 * Notification emitted by an `ALERT`-type automation rule.
 * Polled by the frontend bell dropdown; never triggers a trade.
 */
const alertSchema = new Schema(
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
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    /** UP | DOWN | NEUTRAL — mirrors the prediction that raised the alert. */
    direction: {
      type: String,
      enum: ['UP', 'DOWN', 'NEUTRAL'],
      default: 'NEUTRAL'
    },
    /** 0–1 fraction, same unit as AutomationRule.confidenceThreshold. */
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

alertSchema.index({ userId: 1, read: 1, createdAt: -1 })

export const alertModel = model('alert', alertSchema)
