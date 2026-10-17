import Stall from '../models/Stall.js';
import { contains, getLiveReports, getRatings, ratingFor } from '../utils/hawkerUtils.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.


// ============================================================
// GET /api/stalls
// Optional query: search, cuisine
// Each stall has its star rating as rating: { average, count }.
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

        const ratings = await getRatings(stalls.map(stall => stall._id));

        const data = stalls.map(stall => ({
            ...stall,
            rating: ratingFor(ratings, stall._id)
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/stalls/:id
// Includes the newest live community report as liveReport (or null), the star rating
// as rating: { average, count }, and the centre's location and official closures
// (the stall page shows the closures, and the report form checks the distance).
// ============================================================

export const getStallById = async (req, res, next) => {
    try {
        const stall = await Stall
            .findById(req.params.id)
            .populate('hawkerCentre', 'name address postalCode location closures')
            .lean();

        if (!stall) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        const reports = await getLiveReports({ stall: stall._id });
        const ratings = await getRatings([stall._id]);

        res.status(200).json({
            success: true,
            data: {
                ...stall,
                liveReport: reports[0] || null, // reports are newest first
                rating: ratingFor(ratings, stall._id)
            }
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
