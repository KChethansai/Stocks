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
  model: { type: String, default: 'unknown', index: true },
  // Phase 1.6 provenance + lifecycle. All optional: pre-existing records read
  // back as legacy/unknown and are never retrospectively relabeled.
  /** Release bundle id (e.g. canonical-20261009-01) or legacy/unknown. */
  releaseId: { type: String, default: null, index: true },
  /** Model identity string (mirrors `model` for version-aware aggregation). */
  modelVersion: { type: String, default: null },
  /** Real origin: trained | heuristic | experimental | legacy | unknown. */
  provenance: {
    type: String,
    enum: ['trained', 'heuristic', 'experimental', 'legacy', 'unknown', null],
    default: null,
    index: true
  },
  /** Lifecycle: pending | resolved | unresolvable (with resolutionReason). */
  status: {
    type: String,
    enum: ['pending', 'resolved', 'unresolvable', null],
    default: null,
    index: true
  },
  /** Why unresolvable, or resolver diagnostic (e.g. missing-candles). */
  resolutionReason: { type: String, default: null },
  /** Market-data session the prediction was based on (feature as-of). */
  asOf: { type: Date, default: null },
  /** Where priceAtPrediction came from (quote-cache | history-close | unknown). */
  priceProvenance: { type: String, default: null },
  actualPrice: { type: Number, default: null },
  actualDirection: { type: String, enum: ['UP', 'DOWN', 'NEUTRAL', null], default: null },
  wasCorrect: { type: Boolean, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

predictionLogSchema.index({ targetDate: 1, resolvedAt: 1 })
predictionLogSchema.index({ status: 1, createdAt: 1 })
predictionLogSchema.index({ releaseId: 1, resolvedAt: 1 })
export const predictionLogModel = model('predictionLog', predictionLogSchema)
