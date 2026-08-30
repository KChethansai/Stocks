import { Schema, model } from 'mongoose'

const predictionLogSchema = new Schema({
  symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
  direction: { type: String, enum: ['UP', 'DOWN', 'NEUTRAL'], required: true },
  confidence: { type: Number, min: 0, max: 1, required: true },
  predictedPrice: { type: Number, required: true },
  predictedRange: { low: Number, high: Number },
  priceAtPrediction: { type: Number, required: true },
  horizonDays: { type: Number, required: true, min: 1 },
  targetDate: { type: Date, required: true, index: true },
  actualPrice: { type: Number, default: null },
  actualDirection: { type: String, enum: ['UP', 'DOWN', 'NEUTRAL', null], default: null },
  wasCorrect: { type: Boolean, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

predictionLogSchema.index({ targetDate: 1, resolvedAt: 1 })
export const predictionLogModel = model('predictionLog', predictionLogSchema)
