import mongoose from 'mongoose'
import { ROLES } from '../utils/constants.js'

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
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    // Two-factor login with an authenticator app. The secret is saved when setup starts,
    // but only used for logins once twoFactorEnabled is true (after the user types a correct code).
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash
        delete ret.twoFactorSecret
        return ret
      }
    }
  }
)

export default mongoose.model('User', userSchema)
