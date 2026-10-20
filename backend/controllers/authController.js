import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { AUTH_COOKIE, signToken, cookieOptions, cookieMaxAge } from '../utils/authToken.js'
import { passwordProblem } from '../utils/passwordRules.js'
import { checkCode, signChallenge, verifyChallenge } from '../utils/twoFactor.js'

const SALT_ROUNDS = 10

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode })

// Rejects non-strings so a body like { "email": { "$ne": null } } can't be used as a MongoDB query.
const isText = (value) => typeof value === 'string' && value.trim() !== ''

// "  Zachary   Tay " -> "Zachary Tay", so extra spaces can't be used to copy someone's name.
const tidyName = (name) => name.trim().replace(/\s+/g, ' ')

// Display names are unique, ignoring capitals: "zachary tay" counts as taken by "Zachary Tay".
// exceptUserId lets a user keep their own name when changing its capitals.
function nameTaken(name, exceptUserId) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = { name: { $regex: `^${escaped}$`, $options: 'i' } }
  if (exceptUserId) filter._id = { $ne: exceptUserId }
  return User.exists(filter)
}

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
  if (await nameTaken(tidyName(name))) {
    throw httpError(409, 'That name is already taken, please choose another')
  }

  // role is never taken from the request, so nobody can sign themselves up as an admin.
  const user = await User.create({
    name: tidyName(name),
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

  // With 2FA on, the password alone isn't enough: no cookie yet, the user must send a code next.
  if (user.twoFactorEnabled) {
    return res.json({ success: true, data: { twoFactorRequired: true, challengeToken: signChallenge(user) } })
  }

  sendLoggedIn(res, 200, user)
}

// POST /api/auth/login/2fa  { challengeToken, code }
// Second step of logging in for users with 2FA: the challengeToken from POST /login plus the app's code.
export async function loginTwoFactor(req, res) {
  const { challengeToken, code } = req.body || {}
  if (!isText(challengeToken) || !isText(code)) throw httpError(400, 'Code is required')

  const userId = verifyChallenge(challengeToken)
  if (!userId) throw httpError(401, 'Your login has timed out, please enter your password again')

  const user = await User.findById(userId).select('+twoFactorSecret')
  if (!user || !user.twoFactorEnabled) throw httpError(401, 'Please log in again')
  if (!checkCode(code, user.twoFactorSecret)) throw httpError(401, 'That code is wrong or has expired')

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
  if (await nameTaken(tidyName(name), req.user._id)) {
    throw httpError(409, 'That name is already taken, please choose another')
  }

  req.user.name = tidyName(name)
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
