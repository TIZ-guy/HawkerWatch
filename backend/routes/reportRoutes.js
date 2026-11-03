import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { submitReport, listReports, recentReports, reportSettings, flagReport, deleteReport } from '../controllers/reportController.js'
// Kia's login check: reads the login cookie and sets req.user (401 if not logged in)
import { protect, requireRole } from '../middleware/authMiddleware.js'

// Stops spamming: each IP can submit a limited number of reports per window
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.REPORT_RATE_LIMIT_MAX) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many reports, please try again later' }
})

const router = Router()

router.get('/', listReports)
router.get('/recent', recentReports)
router.get('/settings', reportSettings)
router.post('/', protect, submitLimiter, submitReport)
router.post('/:id/flag', protect, flagReport)
router.delete('/:id', protect, requireRole('admin'), deleteReport)

export default router