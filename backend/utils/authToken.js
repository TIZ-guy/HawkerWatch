import jwt from 'jsonwebtoken'

export const AUTH_COOKIE = 'token'
const TOKEN_DAYS = 7

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set in backend/.env')
  return process.env.JWT_SECRET
}

export const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, secret(), { expiresIn: `${TOKEN_DAYS}d` })

// Throws if the token is missing, tampered with or expired.
export const verifyToken = (token) => jwt.verify(token, secret())

// httpOnly stops page JavaScript from reading the cookie.
// In production the frontend (Vercel) and API (Render/Railway) are on different sites,
// so the cookie has to be SameSite=None, which browsers only accept over HTTPS (secure).
export function cookieOptions() {
  const production = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/'
  }
}

export const cookieMaxAge = TOKEN_DAYS * 24 * 60 * 60 * 1000
