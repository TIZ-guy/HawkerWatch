import User from '../models/User.js'
import { AUTH_COOKIE, verifyToken } from '../utils/authToken.js'
import { banMessage, isBanned } from '../utils/banUtils.js'

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
  // The hash is loaded so the user sent back can say hasPassword; toJSON never sends the hash itself.
  const user = await User.findById(payload.id).select('+passwordHash')
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

// Put after protect on routes that post or change something people see (reports, reviews, comments...).
// Suspended and banned users get 403 with the reason; they can still browse and delete their own posts.
// Usage: router.post('/', protect, notBanned, createReport)
export function notBanned(req, _res, next) {
  if (isBanned(req.user)) throw httpError(403, banMessage(req.user))
  next()
}
