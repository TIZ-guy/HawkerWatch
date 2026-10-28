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
    // From the NEA dataset on data.gov.sg (scripts/importHawkerClosures.js)
    description: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    foodStallCount: { type: Number, min: 0 }, // number of cooked food stalls, according to NEA
    // ID from the data.gov.sg dataset, used by the import to update a centre rather than add it twice.
    // Centres without one were added by hand (e.g. the demo centres from pnpm seed).
    sourceId: { type: String, unique: true, sparse: true, trim: true },
    closures: [closureSchema]
  },
  { timestamps: true }
)

hawkerCentreSchema.index({ location: '2dsphere' })
hawkerCentreSchema.index({ name: 'text', address: 'text' })

export default mongoose.model('HawkerCentre', hawkerCentreSchema)
