import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { submitReport, listReports, flagReport } from '../controllers/reportController.js'

// ---------------------------------------------------------------------------
// TEMPORARY stand-in for login, so you can test before Kia's auth is merged.
// It trusts an "x-dev-user-id" header, so it must NOT be merged into main.
// When Kia's middleware lands: delete this block and use instead
//   import { requireAuth } from '../middleware/authMiddleware.js'
// (it should set req.user._id). In production this stand-in refuses everyone.
// ---------------------------------------------------------------------------
const requireAuth = (req, res, next) => {
  const id = req.header('x-dev-user-id')
  if (process.env.NODE_ENV === 'production' || !/^[0-9a-f]{24}$/i.test(id ?? '')) {
    return res.status(401).json({
      success: false,
      message: 'Login required (dev stand-in: send an x-dev-user-id header with a user _id)'
    })
  }
  req.user = { _id: id }
  next()
}

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
router.post('/', requireAuth, submitLimiter, submitReport)
router.post('/:id/flag', requireAuth, flagReport)

export default router