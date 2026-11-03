import express from 'express';

import {
    importCentres,
    getOverview,
    getAdminStalls,
    approveStall,
    rejectStall,
    restoreStall,
    getAdminReports,
    getAdminFoodUpdates,
    getAdminReviews,
    getAdminComments,
    getAdminUsers,
    setUserRole,
    banUser,
    unbanUser,
    getActivity
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

router.get('/food-updates', getAdminFoodUpdates);

router.get('/reviews', getAdminReviews);

router.get('/comments', getAdminComments);

router.get('/users', getAdminUsers);

router.patch('/users/:id/role', setUserRole);

router.post('/users/:id/ban', banUser);

router.post('/users/:id/unban', unbanUser);

router.get('/activity', getActivity);

// Deleting lives with each kind of post: DELETE /api/stalls/:id (removes a listed stall), /api/reports/:id,
// /api/food-updates/:id, /api/reviews/:id and /api/comments/:id. All of them write to the activity log.

// EXPORT
export default router;
