import mongoose from 'mongoose'
import { FOOD_UPDATE_VALUES, FOOD_UPDATE_NOTE_MAX_LENGTH } from '../utils/constants.js'
import { endOfDay } from '../utils/foodUpdateUtils.js'

const { ObjectId } = mongoose.Schema.Types

// What the food is like at a stall today. Kept after they expire, so query live ones
// with { expiresAt: { $gt: new Date() } }.
const foodUpdateSchema = new mongoose.Schema(
  {
    stall: { type: ObjectId, ref: 'Stall', required: true },
    hawkerCentre: { type: ObjectId, ref: 'HawkerCentre', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: FOOD_UPDATE_VALUES, required: true },
    note: { type: String, trim: true, maxlength: FOOD_UPDATE_NOTE_MAX_LENGTH, default: null },
    expiresAt: { type: Date, default: () => endOfDay() },
    flaggedBy: [{ type: ObjectId, ref: 'User' }]
  },
  { timestamps: true }
)

foodUpdateSchema.index({ stall: 1, expiresAt: -1 }) // live updates for a stall
foodUpdateSchema.index({ hawkerCentre: 1, expiresAt: -1 }) // live updates for a centre
foodUpdateSchema.index({ user: 1, stall: 1, createdAt: -1 }) // 15-minute duplicate check

export default mongoose.model('FoodUpdate', foodUpdateSchema)
