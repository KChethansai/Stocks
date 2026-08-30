import { Schema, model } from 'mongoose'

//stock price data
const stockSchema = new Schema(
  {
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    change: {
      type: Number,
      required: [true, 'Change is required']
    },
    changePercent: {
      type: Number,
      required: [true, 'Change percent is required']
    },
    volume: {
      type: Number,
      required: [true, 'Volume is required'],
      min: [0, 'Volume cannot be negative']
    },
    marketCap: {
      type: Number,
      required: [true, 'Market cap is required'],
      min: [0, 'Market cap cannot be negative']
    },
    sector: {
      type: String,
      required: [true, 'Sector is required'],
      trim: true
    }
  },
  { timestamps: true, versionKey: false, strict: 'throw' }
)

export const stockModel = model('stock', stockSchema)
