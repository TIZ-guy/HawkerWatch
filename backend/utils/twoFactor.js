// Two-factor login with an authenticator app (Google Authenticator, Microsoft Authenticator, ...).
// The app and the server share a secret and each turn it into the same 6-digit code every 30 seconds.
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'
import { authenticator } from 'otplib'

const APP_NAME = 'HawkerWatch'
const CHALLENGE_MINUTES = 5

// Also accepts the code from 30 seconds before or after, in case the phone's clock is a little off.
authenticator.options = { window: 1 }

export const generateSecret = () => authenticator.generateSecret()

// What the user needs to add HawkerWatch to their app: a QR code image (data URL) to scan,
// or the secret to type in by hand.
export async function setupDetails(email, secret) {
  const otpauthUrl = authenticator.keyuri(email, APP_NAME, secret)
  return { secret, otpauthUrl, qrCode: await QRCode.toDataURL(otpauthUrl) }
}

// "123 456" and "123456" both work, because some apps show the code with a space.
export function checkCode(code, secret) {
  if (typeof code !== 'string' || !secret) return false
  return authenticator.check(code.replace(/\s/g, ''), secret)
}

function jwtSecret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set in backend/.env')
  return process.env.JWT_SECRET
}

// After the right password, a user with 2FA gets this short-lived token instead of the login cookie.
// It only proves the password step passed; POST /api/auth/login/2fa swaps it plus a code for the cookie.
export const signChallenge = (user) =>
  jwt.sign({ id: user._id.toString(), purpose: '2fa' }, jwtSecret(), { expiresIn: `${CHALLENGE_MINUTES}m` })

// Returns the user id, or null if the token is wrong, expired or not a 2FA challenge.
export function verifyChallenge(token) {
  try {
    const payload = jwt.verify(token, jwtSecret())
    return payload.purpose === '2fa' ? payload.id : null
  } catch {
    return null
  }
}
