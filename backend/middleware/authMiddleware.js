import User from '../models/User.js'
import { AUTH_COOKIE, verifyToken } from '../utils/authToken.js'

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode })

// Put in front of any route that needs a logged-in user. Sets req.user for the next handler.
// Usage: router.post('/', protect, createReport)
export async function protect(req, _res, next) {
  const token = req.cookies?.[AUTH_COOKIE]
  if (!token) throw httpError(401, 'Please log in to continue')

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw httpError(401, 'Your session has expired, please log in again')
  }

  // Look the user up again so deleted accounts and role changes take effect immediately.
  const user = await User.findById(payload.id)
  if (!user) throw httpError(401, 'Please log in to continue')

  req.user = user
  next()
}

// Put after protect to limit a route to certain roles.
// Usage: router.delete('/:id', protect, requireRole('admin'), deleteComment)
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw httpError(403, 'You do not have permission to do this')
    }
    next()
  }
}
