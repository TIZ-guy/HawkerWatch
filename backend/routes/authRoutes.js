import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { register, login, me, updateMe, changePassword, logout } from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const LOGIN_WINDOW_MINUTES = 15

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
router.get('/me', protect, me)
router.patch('/me', protect, updateMe)
router.patch('/password', protect, changePassword)
router.post('/logout', logout)

export default router
