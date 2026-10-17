import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

import { updateReview, deleteReview, addReviewPhotos, deleteReviewPhoto } from '../controllers/reviewController.js';
// Kia's login check: reads the login cookie and sets req.user (401 if not logged in)
import { protect } from '../middleware/authMiddleware.js';
import { MAX_REVIEW_PHOTOS, MAX_PHOTO_BYTES } from '../utils/constants.js';

// Listing and posting reviews live under /api/stalls/:id/reviews (stallRoutes.js).
// Editing, deleting and photos only need the review's id, so they live here.

// multer reads uploaded files into memory (req.files) so the controller can check them and save
// them to MongoDB. It refuses files over MAX_PHOTO_BYTES or more than MAX_REVIEW_PHOTOS at once.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_REVIEW_PHOTOS }
});

// Stops photo spam: each IP can upload a limited number of times per window
const photoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.PHOTO_RATE_LIMIT_MAX) || 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many photo uploads, please try again later' }
});

const router = express.Router(); // sub application, mounted at /api/reviews

router.patch('/:id', protect, updateReview);

router.delete('/:id', protect, deleteReview);

router.post('/:id/photos', protect, photoLimiter, upload.array('photos', MAX_REVIEW_PHOTOS), addReviewPhotos);

router.delete('/:id/photos/:photoId', protect, deleteReviewPhoto);

// EXPORT
export default router;
