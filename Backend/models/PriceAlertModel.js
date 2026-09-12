import { Schema, model } from 'mongoose'

/**
 * User-set price threshold. Evaluated by the shared price monitor
 * (services/priceMonitor.js) on every stock-sync tick. One-shot: once
 * `triggered` flips true an inbox notification is written and the alert
 * never fires again — the user creates a new alert to re-arm.
 */
const priceAlertSchema = new Schema(
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
    targetPrice: {
      type: Number,
      required: true,
      min: 0.01
    },
    /** ABOVE fires when price >= target; BELOW fires when price <= target. */
    direction: {
      type: String,
      enum: ['ABOVE', 'BELOW'],
      required: true
    },
    triggered: {
      type: Boolean,
      default: false,
      index: true
    },
    triggeredAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

priceAlertSchema.index({ userId: 1, triggered: 1, createdAt: -1 })

export const priceAlertModel = model('pricealert', priceAlertSchema)
