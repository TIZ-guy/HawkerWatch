import express from 'express';
import rateLimit from 'express-rate-limit';

import {
    getStalls,
    getStallById,
    getStallReports
} from '../controllers/stallController.js';
import { getStallReviews, addReview } from '../controllers/reviewController.js';
// Kia's login check: reads the login cookie and sets req.user (401 if not logged in)
import { protect } from '../middleware/authMiddleware.js';

// Stops review spam: each IP can post a limited number of reviews per window
const reviewLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.REVIEW_RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many reviews, please try again later' }
});

const router = express.Router(); // sub application, mounted at /api/stalls

router.get('/', getStalls);

router.get('/:id', getStallById);

router.get('/:id/reports', getStallReports);

router.get('/:id/reviews', getStallReviews);

router.post('/:id/reviews', protect, reviewLimiter, addReview);

// EXPORT
export default router;
