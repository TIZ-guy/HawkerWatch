import express from 'express';
import rateLimit from 'express-rate-limit';

import { geocode } from '../controllers/geocodeController.js';

// Each IP can search a limited number of times per window, so OneMap isn't flooded through us
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.GEOCODE_RATE_LIMIT_MAX) || 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many searches, please try again later' }
});

const router = express.Router(); // sub application, mounted at /api/geocode

router.get('/', searchLimiter, geocode);

// EXPORT
export default router;
