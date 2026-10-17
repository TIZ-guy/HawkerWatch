import express from 'express';

import { getReviewPhoto } from '../controllers/reviewController.js';

const router = express.Router(); // sub application, mounted at /api/review-photos

router.get('/:id', getReviewPhoto);

// EXPORT
export default router;
