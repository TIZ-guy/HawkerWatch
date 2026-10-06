import mongoose from 'mongoose'

// Official closure dates only (from data.gov.sg). Community reports live in StatusReport.
const closureSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['CLEANING', 'OTHER_WORKS'], required: true },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return !this.startDate || value >= this.startDate
        },
        message: 'Closure endDate must be on or after startDate'
      }
    },
    remarks: { type: String, trim: true }
  },
  { _id: false }
)

const hawkerCentreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, match: [/^\d{6}$/, 'Postal code must be 6 digits'] },
    // GeoJSON point. Note the order: [longitude, latitude].
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        validate: {
          validator: (value) => value.length === 2,
          message: 'Location needs [longitude, latitude]'
        }
      }
    },
    // ID from the data.gov.sg dataset, used by the Phase 4 import to update rather than duplicate.
    sourceId: { type: String, unique: true, sparse: true, trim: true },
    closures: [closureSchema]
  },
  { timestamps: true }
)

hawkerCentreSchema.index({ location: '2dsphere' })
hawkerCentreSchema.index({ name: 'text', address: 'text' })

export default mongoose.model('HawkerCentre', hawkerCentreSchema)
