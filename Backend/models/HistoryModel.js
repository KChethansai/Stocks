import { Schema, model } from 'mongoose'

// Cached historical OHLC data for a stock symbol.
// A single document stores all daily candles for one symbol.
// The frontend derives 1W/1M/3M/6M/1Y by slicing this dataset.
const ohlcSchema = new Schema(
  {
    timestamp: { type: Date, required: true },
    open:  { type: Number, required: true },
    high:  { type: Number, required: true },
    low:   { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, default: 0 }
  },
  { _id: false }
)

const historySchema = new Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    data: [ohlcSchema],
    updatedAt: { type: Date, default: Date.now }
  },
  { versionKey: false, strict: 'throw' }
)

export const historyModel = model('history', historySchema)
