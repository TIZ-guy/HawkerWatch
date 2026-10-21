import { importHawkerCentres } from '../services/hawkerImportService.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.


// ============================================================
// POST /api/admin/import-centres
// Admins only. Imports NEA's hawker centres and closures from data.gov.sg now,
// instead of waiting for the weekly refresh. Takes a few seconds.
// ============================================================

export const importCentres = async (req, res, next) => {
    try {
        const result = await importHawkerCentres();

        if (result.status === 'FAILED') {
            res.status(502).json({ success: false, message: `Import failed: ${result.errorMessage}` });
            return;
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};
