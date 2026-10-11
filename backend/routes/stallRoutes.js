import express from 'express';

import {
    getStalls,
    getStallById,
    getStallReports
} from '../controllers/stallController.js';

const router = express.Router(); // sub application, mounted at /api/stalls

router.get('/', getStalls);

router.get('/:id', getStallById);

router.get('/:id/reports', getStallReports);

// EXPORT
export default router;
