import express from 'express';

import {
    importCentres,
    getOverview,
    getAdminStalls,
    approveStall,
    rejectStall,
    restoreStall,
    getAdminReports
} from '../controllers/adminController.js';
// Kia's login check and admin check
import { protect, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router(); // sub application, mounted at /api/admin

// Every admin route needs a logged-in admin
router.use(protect, requireRole('admin'));

router.post('/import-centres', importCentres);

router.get('/overview', getOverview);

router.get('/stalls', getAdminStalls);

router.post('/stalls/:id/approve', approveStall);

router.post('/stalls/:id/reject', rejectStall);

router.post('/stalls/:id/restore', restoreStall);

router.get('/reports', getAdminReports);

// Removing a listed stall is DELETE /api/stalls/:id, and removing a report is DELETE /api/reports/:id.

// EXPORT
export default router;
