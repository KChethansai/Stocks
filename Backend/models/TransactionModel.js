import { Schema, model } from 'mongoose'

//trade transaction data
const transactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'User is required']
    },
    type: {
      type: String,
      enum: ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL'],
      required: [true, 'Type is required']
    },
    symbol: {
      type: String,
      uppercase: true,
      trim: true,
      default: undefined
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity must be at least 1'],
      default: undefined
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: undefined
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total cannot be negative']
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required']
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required']
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

transactionSchema.index({ userId: 1, createdAt: -1 })
transactionSchema.index({ userId: 1, symbol: 1, createdAt: -1 })

export const transactionModel = model('transaction', transactionSchema)
