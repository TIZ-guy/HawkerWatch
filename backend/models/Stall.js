import mongoose from 'mongoose'
import { CUISINE_VALUES } from '../utils/constants.js'

const stallSchema = new mongoose.Schema(
  {
    hawkerCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'HawkerCentre', required: true },
    name: { type: String, required: true, trim: true },
    unitNumber: { type: String, trim: true }, // e.g. "01-23", optional
    cuisine: { type: String, trim: true, enum: CUISINE_VALUES }, // a category, e.g. "Chinese"; optional
    speciality: { type: String, trim: true }, // the dish, e.g. "Chicken rice"
    isActive: { type: Boolean, default: true }, // false once an admin removes the stall
    // true while a stall added by a user waits for an admin to approve it. Pending stalls are hidden
    // everywhere except the admin page. Stalls from before approvals existed have no value, so count as approved.
    pendingApproval: { type: Boolean, default: false },
    // Who added the stall (stalls are added by users, as no official stall list exists).
    // They can edit its details; admins can edit or remove any stall.
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

// A unit number can only be used once per centre. Stalls without one are not checked.
stallSchema.index(
  { hawkerCentre: 1, unitNumber: 1 },
  { unique: true, partialFilterExpression: { unitNumber: { $type: 'string' } } }
)
stallSchema.index({ hawkerCentre: 1, name: 1 })
stallSchema.index({ hawkerCentre: 1, cuisine: 1 }) // the centre page filters by cuisine

export default mongoose.model('Stall', stallSchema)
