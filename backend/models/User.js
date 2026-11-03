import mongoose from 'mongoose'
import { ROLES } from '../utils/constants.js'
import { BAN_REASON_MAX_LENGTH } from '../utils/banUtils.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is invalid']
    },
    // select: false keeps the hash out of query results unless asked for with .select('+passwordHash')
    // Accounts made with "Continue with Google" have no password, only a googleId.
    passwordHash: { type: String, required: function () { return !this.googleId }, select: false },
    // Google's id for the account ("sub" in the ID token), set the first time someone logs in with Google.
    googleId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    // Set by an admin to stop the user posting until this time (utils/banUtils.js). null when not banned.
    bannedUntil: { type: Date, default: null },
    banReason: { type: String, trim: true, maxlength: BAN_REASON_MAX_LENGTH, default: '' },
    // Two-factor login with an authenticator app. The secret is saved when setup starts,
    // but only used for logins once twoFactorEnabled is true (after the user types a correct code).
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        // Tells the Profile page whether to ask for the current password (Google-only accounts have none).
        // Only when the hash was loaded, otherwise a missing hash wouldn't mean "no password".
        if (doc.isSelected?.('passwordHash')) ret.hasPassword = Boolean(ret.passwordHash)
        delete ret.passwordHash
        delete ret.twoFactorSecret
        return ret
      }
    }
  }
)

export default mongoose.model('User', userSchema)
