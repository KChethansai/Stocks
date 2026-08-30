import { Schema, model } from 'mongoose'

//portfolio holding data
const holdingSchema = new Schema(
  {
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    avgBuyPrice: {
      type: Number,
      required: [true, 'Average buy price is required'],
      min: [0, 'Average buy price cannot be negative']
    },
    currentPrice: {
      type: Number,
      required: [true, 'Current price is required'],
      min: [0, 'Current price cannot be negative']
    }
  },
  { _id: false, strict: 'throw' }
)

//user portfolio data
const portfolioSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'User is required'],
      unique: true
    },
    holdings: {
      type: [holdingSchema],
      default: []
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

export const portfolioModel = model('portfolio', portfolioSchema)
