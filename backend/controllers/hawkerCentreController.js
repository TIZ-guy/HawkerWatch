import HawkerCentre from '../models/HawkerCentre.js';
import Stall from '../models/Stall.js';
import { STATUS_VALUES, REPORT_TTL_MINUTES } from '../utils/constants.js';
import { contains, getLiveReports, latestReportPerStall } from '../utils/hawkerUtils.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.

// ============================================================
// GET /api/hawker-centres
// Optional query: search, lat, lng, radius (metres, default 2000)
// ============================================================

export const getHawkerCentres = async (req, res, next) => {
    try {
        const filter = {};
        let centres;

        if (req.query.search) {
            filter.$or = [
                { name: contains(req.query.search) },
                { address: contains(req.query.search) }
            ];
        }

        if (req.query.lat || req.query.lng) {
            const lat = Number(req.query.lat);
            const lng = Number(req.query.lng);
            const radius = Number(req.query.radius || 2000);

            if (isNaN(lat) || isNaN(lng) || isNaN(radius) ||
                Math.abs(lat) > 90 || Math.abs(lng) > 180 || radius <= 0) {
                res.status(400).json({ success: false, message: 'lat, lng and radius must be valid numbers.' });
                return;
            }

            // function to help sort centres from nearest to furthest.
            filter.location = {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: radius
                }
            };
            centres = await HawkerCentre.find(filter).lean();
        } else {
            centres = await HawkerCentre.find(filter).sort({ name: 1 }).lean();
        }

        res.status(200).json({ success: true, data: centres });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/hawker-centres/:id
// ============================================================

export const getHawkerCentreById = async (req, res, next) => {
    try {
        const centre = await HawkerCentre.findById(req.params.id).lean();

        if (!centre) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        res.status(200).json({ success: true, data: centre });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/hawker-centres/:id/stalls
// Optional query: search, cuisine
// Each stall has its newest live community report as liveReport (or null).
// ============================================================

export const getHawkerCentreStalls = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await HawkerCentre.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const filter = { hawkerCentre: id, isActive: true };

        if (req.query.search) {
            filter.name = contains(req.query.search);
        }
        if (req.query.cuisine) {
            filter.cuisine = contains(req.query.cuisine);
        }

        const stalls = await Stall.find(filter).sort({ name: 1 }).lean();
        const latest = latestReportPerStall(await getLiveReports({ hawkerCentre: id }));

        const data = stalls.map(stall => ({
            ...stall,
            liveReport: latest.get(String(stall._id)) || null
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/hawker-centres/:id/community-summary
// Counts the newest live report of each stall in the centre.
// ============================================================

export const getCommunitySummary = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await HawkerCentre.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const reports = await getLiveReports({ hawkerCentre: id });
        const latest = latestReportPerStall(reports);

        // Start every status at 0, then count each stall's newest report.
        const byStatus = {};
        for (const status of STATUS_VALUES) {
            byStatus[status] = 0;
        }
        for (const report of latest.values()) {
            byStatus[report.status] += 1;
        }

        res.status(200).json({
            success: true,
            data: {
                windowMinutes: REPORT_TTL_MINUTES,
                stallsReported: latest.size,
                byStatus,
                latestReportAt: reports[0]?.createdAt || null // reports are newest first
            }
        });
    } catch (error) {
        next(error);
    }
};
