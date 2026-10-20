import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, loginTwoFactor, me, updateMe, changePassword, logout } from '../controllers/authController.js'
import { startSetup, enableTwoFactor, disableTwoFactor } from '../controllers/twoFactorController.js'
import { protect } from '../middleware/authMiddleware.js'

const LOGIN_WINDOW_MINUTES = 15

// Slows down password guessing: only failed logins count, per IP address.
// LOGIN_RATE_LIMIT_MAX in backend/.env changes the number of attempts allowed.
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: `Too many failed login attempts. Please wait ${LOGIN_WINDOW_MINUTES} minutes and try again.`
  }
})

const router = Router()

router.post('/register', register)
router.post('/login', loginLimiter, login)
// Wrong codes count towards the same failed-login limit, so codes can't be guessed.
router.post('/login/2fa', loginLimiter, loginTwoFactor)
router.get('/me', protect, me)
router.patch('/me', protect, updateMe)
router.patch('/password', protect, changePassword)
router.post('/logout', logout)

// Turning two-factor login on and off from the Profile page
router.post('/2fa/setup', protect, startSetup)
router.post('/2fa/enable', protect, loginLimiter, enableTwoFactor)
router.post('/2fa/disable', protect, loginLimiter, disableTwoFactor)

export default router
