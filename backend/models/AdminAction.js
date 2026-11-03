import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

// The admin activity log: one entry for each thing an admin does (approve a stall, delete a review,
// ban a user...). Written by utils/adminLog.js and shown on the Admin page's Activity tab.
export const ADMIN_ACTIONS = [
  'stall.approve', 'stall.reject', 'stall.remove', 'stall.restore',
  'report.delete', 'foodUpdate.delete', 'review.delete', 'comment.delete',
  'user.ban', 'user.unban', 'user.role',
  'centres.import'
]

const adminActionSchema = new mongoose.Schema(
  {
    admin: { type: ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ADMIN_ACTIONS, required: true },
    // A sentence for the log, e.g. 'Deleted a comment: "Rubbish food"'
    summary: { type: String, required: true },
    // What was acted on, e.g. 'Stall' and its id (it may since have been deleted)
    targetType: { type: String },
    targetId: { type: ObjectId },
    // The user whose post or account it was, so the log can show their name
    subjectUser: { type: ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

adminActionSchema.index({ createdAt: -1 })

export default mongoose.model('AdminAction', adminActionSchema)
