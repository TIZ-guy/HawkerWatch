import express from 'express';
import rateLimit from 'express-rate-limit';

import {
    getHawkerCentres,
    getHawkerCentreById,
    getHawkerCentreStalls,
    getCommunitySummary
} from '../controllers/hawkerCentreController.js';
import { getCentreComments, addComment } from '../controllers/commentController.js';
// Kia's login check: reads the login cookie and sets req.user (401 if not logged in)
import { protect } from '../middleware/authMiddleware.js';

// Stops comment spam: each IP can post a limited number of comments per window
const commentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.COMMENT_RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many comments, please try again later' }
});

const router = express.Router(); // sub application, mounted at /api/hawker-centres

router.get('/', getHawkerCentres);

router.get('/:id', getHawkerCentreById);

router.get('/:id/stalls', getHawkerCentreStalls);

router.get('/:id/community-summary', getCommunitySummary);

router.get('/:id/comments', getCentreComments);

router.post('/:id/comments', protect, commentLimiter, addComment);

// EXPORT
export default router;
