import express from 'express';

import { updateComment, deleteComment } from '../controllers/commentController.js';
import { protect, notBanned } from '../middleware/authMiddleware.js';

// Listing and posting comments live under /api/hawker-centres/:id/comments (hawkerCentreRoutes.js).
// Editing and deleting only need the comment's id, so they live here.

const router = express.Router(); // sub application, mounted at /api/comments

router.patch('/:id', protect, notBanned, updateComment);

router.delete('/:id', protect, deleteComment);

// EXPORT
export default router;
