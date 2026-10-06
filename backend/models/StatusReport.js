import mongoose from 'mongoose'
import { STATUS_VALUES, REPORT_TTL_MINUTES } from '../utils/constants.js'

const { ObjectId } = mongoose.Schema.Types

// Reports are kept after they expire, so query live ones with { expiresAt: { $gt: new Date() } }.
const statusReportSchema = new mongoose.Schema(
  {
    stall: { type: ObjectId, ref: 'Stall', required: true },
    hawkerCentre: { type: ObjectId, ref: 'HawkerCentre', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: STATUS_VALUES, required: true },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + REPORT_TTL_MINUTES * 60 * 1000)
    },
    flaggedBy: [{ type: ObjectId, ref: 'User' }]
  },
  { timestamps: true }
)

statusReportSchema.index({ stall: 1, expiresAt: -1 }) // live reports for a stall
statusReportSchema.index({ hawkerCentre: 1, expiresAt: -1 }) // centre community summary
statusReportSchema.index({ user: 1, stall: 1, createdAt: -1 }) // 15-minute duplicate check

export default mongoose.model('StatusReport', statusReportSchema)
