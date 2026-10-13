import mongoose from 'mongoose'
import { COMMENT_MAX_LENGTH } from '../utils/constants.js'

const commentSchema = new mongoose.Schema(
  {
    hawkerCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'HawkerCentre', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: COMMENT_MAX_LENGTH }
  },
  { timestamps: true }
)

commentSchema.index({ hawkerCentre: 1, createdAt: -1 })

export default mongoose.model('Comment', commentSchema)
