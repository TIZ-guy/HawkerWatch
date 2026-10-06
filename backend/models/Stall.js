import mongoose from 'mongoose'

const stallSchema = new mongoose.Schema(
  {
    hawkerCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'HawkerCentre', required: true },
    name: { type: String, required: true, trim: true },
    unitNumber: { type: String, trim: true }, // e.g. "01-23", optional
    cuisine: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

// A unit number can only be used once per centre. Stalls without one are not checked.
stallSchema.index(
  { hawkerCentre: 1, unitNumber: 1 },
  { unique: true, partialFilterExpression: { unitNumber: { $type: 'string' } } }
)
stallSchema.index({ hawkerCentre: 1, name: 1 })

export default mongoose.model('Stall', stallSchema)
