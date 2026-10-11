import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { AUTH_COOKIE, signToken, cookieOptions, cookieMaxAge } from '../utils/authToken.js'
import { passwordProblem } from '../utils/passwordRules.js'

const SALT_ROUNDS = 10

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
  const problem = passwordProblem(password)
  if (problem) throw httpError(400, problem)
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

// PATCH /api/auth/me  { name }  (needs protect)
// Only the name can be changed here. Email and role stay as they are.
export async function updateMe(req, res) {
  const { name } = req.body || {}
  if (!isText(name)) throw httpError(400, 'Name is required')

  req.user.name = name
  await req.user.save() // runs the User schema rules, e.g. the 60-character limit

  res.json({ success: true, data: { user: req.user } })
}

// PATCH /api/auth/password  { currentPassword, newPassword }  (needs protect)
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {}

  if (!isText(currentPassword) || !isText(newPassword)) {
    throw httpError(400, 'Current and new password are required')
  }
  const problem = passwordProblem(newPassword)
  if (problem) throw httpError(400, `New ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`)

  const user = await User.findById(req.user._id).select('+passwordHash')
  const passwordMatches = user && (await bcrypt.compare(currentPassword, user.passwordHash).catch(() => false))
  // 400 rather than 401, so the frontend doesn't mistake a typo for an expired login.
  if (!passwordMatches) throw httpError(400, 'Current password is incorrect')

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await user.save()

  res.json({ success: true, data: {} })
}

// POST /api/auth/logout
export function logout(_req, res) {
  res.clearCookie(AUTH_COOKIE, cookieOptions())
  res.json({ success: true, data: {} })
}
