import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { submitFoodUpdate, listFoodUpdates, flagFoodUpdate, deleteFoodUpdate } from '../controllers/foodUpdateController.js'
import { protect, requireRole, notBanned } from '../middleware/authMiddleware.js'

// Stops spamming: each IP can submit a limited number of food updates per window
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.REPORT_RATE_LIMIT_MAX) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many updates, please try again later' }
})

const router = Router()

router.get('/', listFoodUpdates)
router.post('/', protect, notBanned, submitLimiter, submitFoodUpdate)
router.post('/:id/flag', protect, notBanned, flagFoodUpdate)
router.delete('/:id', protect, requireRole('admin'), deleteFoodUpdate)

export default router
