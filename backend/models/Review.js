import mongoose from 'mongoose'
import { REVIEW_TEXT_MAX_LENGTH, MAX_REVIEW_PHOTOS } from '../utils/constants.js'

// A star rating (1 to 5) for a stall, with an optional written review.
// Each user can review a stall once; they edit that review instead of adding another.
// Up to MAX_REVIEW_PHOTOS photos can be attached.
const reviewSchema = new mongoose.Schema(
  {
    stall: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number from 1 to 5' }
    },
    text: { type: String, trim: true, maxlength: REVIEW_TEXT_MAX_LENGTH, default: '' },
    // Ids of the review's photos, in the order they were added. The images live in ReviewPhoto.
    photos: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReviewPhoto' }],
      validate: { validator: (photos) => photos.length <= MAX_REVIEW_PHOTOS, message: `A review can have at most ${MAX_REVIEW_PHOTOS} photos` }
    },
    // When the author last changed the stars or text (null if never). Adding photos doesn't count,
    // so the "edited" label only shows for real edits.
    editedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

// One review per user per stall
reviewSchema.index({ stall: 1, user: 1 }, { unique: true })

export default mongoose.model('Review', reviewSchema)
