import express from 'express';

import { importCentres } from '../controllers/adminController.js';
// Kia's login check and admin check
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router(); // sub application, mounted at /api/admin

router.post('/import-centres', protect, requireRole('admin'), importCentres);

// EXPORT
export default router;
