import mongoose from 'mongoose'

// One document per run of the official data import (Phase 4). createdAt is the start time.
const importLogSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    status: { type: String, enum: ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'], default: 'RUNNING' },
    recordsFetched: { type: Number, default: 0, min: 0 },
    recordsCreated: { type: Number, default: 0, min: 0 },
    recordsUpdated: { type: Number, default: 0, min: 0 },
    errorMessage: { type: String },
    finishedAt: { type: Date }
  },
  { timestamps: true }
)

importLogSchema.index({ source: 1, createdAt: -1 })

export default mongoose.model('ImportLog', importLogSchema)
