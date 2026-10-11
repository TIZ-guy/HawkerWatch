import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { AUTH_COOKIE, signToken, cookieOptions, cookieMaxAge } from '../utils/authToken.js'

const SALT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8
// bcrypt ignores everything after 72 bytes, so longer passwords would give a false sense of security.
const MAX_PASSWORD_LENGTH = 72

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode })

// Rejects non-strings so a body like { "email": { "$ne": null } } can't be used as a MongoDB query.
const isText = (value) => typeof value === 'string' && value.trim() !== ''

function sendLoggedIn(res, statusCode, user) {
  res.cookie(AUTH_COOKIE, signToken(user), { ...cookieOptions(), maxAge: cookieMaxAge })
  res.status(statusCode).json({ success: true, data: { user } })
}

// POST /api/auth/register  { name, email, password }
export async function register(req, res) {
  const { name, email, password } = req.body || {}

  if (!isText(name) || !isText(email) || !isText(password)) {
    throw httpError(400, 'Name, email and password are required')
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw httpError(400, `Password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`)
  }
  if (await User.exists({ email: email.trim().toLowerCase() })) {
    throw httpError(409, 'An account with this email already exists')
  }

  // role is never taken from the request, so nobody can sign themselves up as an admin.
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS)
  })

  sendLoggedIn(res, 201, user)
}

// POST /api/auth/login  { email, password }
export async function login(req, res) {
  const { email, password } = req.body || {}

  if (!isText(email) || !isText(password)) {
    throw httpError(400, 'Email and password are required')
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
  // Seeded demo users have a placeholder hash that bcrypt can't read, which counts as a wrong password.
  const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash).catch(() => false))

  // Same message either way, so the response doesn't reveal which emails have accounts.
  if (!passwordMatches) throw httpError(401, 'Invalid email or password')

  sendLoggedIn(res, 200, user)
}

// GET /api/auth/me  (needs protect)
export function me(req, res) {
  res.json({ success: true, data: { user: req.user } })
}

// POST /api/auth/logout
export function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions())
  res.json({ success: true, data: {} })
}
