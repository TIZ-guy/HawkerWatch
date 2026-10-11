import express from 'express';

import {
    getHawkerCentres,
    getHawkerCentreById,
    getHawkerCentreStalls,
    getCommunitySummary
} from '../controllers/hawkerCentreController.js';

const router = express.Router(); // sub application, mounted at /api/hawker-centres

router.get('/', getHawkerCentres);

router.get('/:id', getHawkerCentreById);

router.get('/:id/stalls', getHawkerCentreStalls);

router.get('/:id/community-summary', getCommunitySummary);

// EXPORT
export default router;
