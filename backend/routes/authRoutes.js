import { Router } from 'express'
import { register, login, me, updateMe, changePassword, logout } from '../controllers/authController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', protect, me)
router.patch('/me', protect, updateMe)
router.patch('/password', protect, changePassword)
router.post('/logout', logout)

export default router
