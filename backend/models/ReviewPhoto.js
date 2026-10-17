import mongoose from 'mongoose'

// One photo attached to a review. The image itself is stored here (as bytes), so photos
// survive redeploys without needing a separate file-hosting service.
// Kept apart from Review so listing reviews never loads the images.
const reviewPhotoSchema = new mongoose.Schema(
  {
    review: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true },
    stall: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    // select: false keeps the image bytes out of query results unless asked for with .select('+data')
    data: { type: Buffer, required: true, select: false }
  },
  { timestamps: true }
)

reviewPhotoSchema.index({ review: 1 })

export default mongoose.model('ReviewPhoto', reviewPhotoSchema)
