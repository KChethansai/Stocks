import { Schema, model } from 'mongoose'

//trade order data
const orderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'User is required']
    },
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      uppercase: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: [true, 'Type is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    total: {
      type: Number,
      required: [true, 'Total is required'],
      min: [0, 'Total cannot be negative']
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED'
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

orderSchema.index({ userId: 1, createdAt: -1 })
orderSchema.index({ userId: 1, symbol: 1, createdAt: -1 })

export const orderModel = model('order', orderSchema)
