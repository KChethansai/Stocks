import { Schema, model } from 'mongoose'

// Durable idempotency for paper trades.
// Key scope is per-user: (userId, key) is unique. Stores the original receipt
// so concurrent requests and retries return the same transaction instead of
// double-filling. Keys expire after 24h to bound collection growth
// (retention/replay window: 24 hours).
const idempotencyKeySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'User is required']
    },
    key: {
      type: String,
      required: [true, 'Key is required'],
      trim: true,
      maxlength: [128, 'Key too long']
    },
    symbol: {
      type: String,
      uppercase: true,
      trim: true,
      default: undefined
    },
    side: {
      type: String,
      enum: ['BUY', 'SELL'],
      default: undefined
    },
    quantity: {
      type: Number,
      default: undefined
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress'
    },
    response: {
      type: Schema.Types.Mixed,
      default: undefined
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

idempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true })
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export const idempotencyKeyModel = model('idempotencyKey', idempotencyKeySchema)
