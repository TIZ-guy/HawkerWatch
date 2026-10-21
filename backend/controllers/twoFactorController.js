// Turning two-factor login (authenticator app) on and off. All routes need protect.
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { generateSecret, setupDetails, checkCode } from '../utils/twoFactor.js'

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode })

// POST /api/auth/2fa/setup
// Makes a new secret and returns the QR code to scan. 2FA stays off until /enable gets a correct code,
// so scanning and then giving up changes nothing.
export async function startSetup(req, res) {
  if (req.user.twoFactorEnabled) throw httpError(400, 'Two-factor login is already on')

  const secret = generateSecret()
  await User.updateOne({ _id: req.user._id }, { twoFactorSecret: secret })

  res.json({ success: true, data: await setupDetails(req.user.email, secret) })
}

// POST /api/auth/2fa/enable  { code }
// Proves the app was set up correctly before 2FA is switched on, so nobody locks themselves out.
export async function enableTwoFactor(req, res) {
  const { code } = req.body || {}
  const user = await User.findById(req.user._id).select('+twoFactorSecret')

  if (user.twoFactorEnabled) throw httpError(400, 'Two-factor login is already on')
  if (!user.twoFactorSecret) throw httpError(400, 'Start the setup first')
  if (!checkCode(code, user.twoFactorSecret)) throw httpError(400, 'That code is wrong or has expired')

  user.twoFactorEnabled = true
  await user.save()
  res.json({ success: true, data: { user } })
}

// POST /api/auth/2fa/disable  { password, code }
// Needs both, so someone using a computer you left logged in can't turn it off.
export async function disableTwoFactor(req, res) {
  const { password, code } = req.body || {}
  const user = await User.findById(req.user._id).select('+passwordHash +twoFactorSecret')

  if (!user.twoFactorEnabled) throw httpError(400, 'Two-factor login is already off')
  const passwordMatches = typeof password === 'string' && (await bcrypt.compare(password, user.passwordHash).catch(() => false))
  if (!passwordMatches) throw httpError(400, 'Password is incorrect')
  if (!checkCode(code, user.twoFactorSecret)) throw httpError(400, 'That code is wrong or has expired')

  user.twoFactorEnabled = false
  user.twoFactorSecret = undefined
  await user.save()
  res.json({ success: true, data: { user } })
}
