import mongoose from 'mongoose'

const favouriteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['Stall', 'HawkerCentre'], required: true },
    // refPath lets populate() look in the Stall or HawkerCentre collection depending on targetType.
    target: { type: mongoose.Schema.Types.ObjectId, refPath: 'targetType', required: true },
    alert: {
      enabled: { type: Boolean, default: false },
      days: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday
      time: { type: String, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Alert time must be HH:mm'] }
    }
  },
  { timestamps: true }
)

favouriteSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true })

export default mongoose.model('Favourite', favouriteSchema)
