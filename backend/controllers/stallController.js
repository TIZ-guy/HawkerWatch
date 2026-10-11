import Stall from '../models/Stall.js';
import { contains, getLiveReports } from '../utils/hawkerUtils.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.


// ============================================================
// GET /api/stalls
// Optional query: search, cuisine
// ============================================================

export const getStalls = async (req, res, next) => {
    try {
        const filter = { isActive: true };

        if (req.query.search) {
            filter.name = contains(req.query.search);
        }
        if (req.query.cuisine) {
            filter.cuisine = contains(req.query.cuisine);
        }

        const stalls = await Stall
            .find(filter)
            .populate('hawkerCentre', 'name address')
            .sort({ name: 1 })
            .lean();

        res.status(200).json({ success: true, data: stalls });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/stalls/:id
// Includes the newest live community report as liveReport (or null).
// ============================================================

export const getStallById = async (req, res, next) => {
    try {
        const stall = await Stall
            .findById(req.params.id)
            .populate('hawkerCentre', 'name address')
            .lean();

        if (!stall) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        const reports = await getLiveReports({ stall: stall._id });

        res.status(200).json({
            success: true,
            data: { ...stall, liveReport: reports[0] || null } // reports are newest first
        });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/stalls/:id/reports
// Live reports only, newest first.
// ============================================================

export const getStallReports = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await Stall.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        const reports = await getLiveReports({ stall: id });

        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        next(error);
    }
};
