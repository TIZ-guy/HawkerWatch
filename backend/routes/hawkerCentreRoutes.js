import express from 'express';
import rateLimit from 'express-rate-limit';

import {
    getHawkerCentres,
    getHawkerCentreById,
    getHawkerCentreStalls,
    getCommunitySummary
} from '../controllers/hawkerCentreController.js';
import { getCentreComments, addComment } from '../controllers/commentController.js';
import { addStall } from '../controllers/stallController.js';
import { getCentreReviews } from '../controllers/reviewController.js';
// Kia's login check: reads the login cookie and sets req.user (401 if not logged in)
import { protect, notBanned } from '../middleware/authMiddleware.js';

// Stops comment spam: each IP can post a limited number of comments per window
const commentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.COMMENT_RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many comments, please try again later' }
});

// Stops spam: each IP can add a limited number of stalls per window
const stallLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.STALL_RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many stalls added, please try again later' }
});

const router = express.Router(); // sub application, mounted at /api/hawker-centres

router.get('/', getHawkerCentres);

router.get('/:id', getHawkerCentreById);

router.get('/:id/stalls', getHawkerCentreStalls);

router.post('/:id/stalls', protect, notBanned, stallLimiter, addStall);

router.get('/:id/community-summary', getCommunitySummary);

router.get('/:id/reviews', getCentreReviews);

router.get('/:id/comments', getCentreComments);

router.post('/:id/comments', protect, notBanned, commentLimiter, addComment);

// EXPORT
export default router;
