import { importHawkerCentres } from '../services/hawkerImportService.js';
import Stall from '../models/Stall.js';
import StatusReport from '../models/StatusReport.js';
import User from '../models/User.js';
import { contains } from '../utils/hawkerUtils.js';
import { exactly, LISTED_STALL } from '../utils/stallUtils.js';
import { FLAG_HIDE_THRESHOLD, isHidden, isLive } from '../utils/reportUtils.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.
// Every route here is for admins only (checked in adminRoutes.js).

const LIST_LIMIT = 100;

// Which stalls each tab of the admin page lists
const STALL_TABS = {
    pending: { isActive: true, pendingApproval: true },
    listed: LISTED_STALL,
    removed: { isActive: false }
};


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


// ============================================================
// GET /api/admin/overview
// The numbers at the top of the admin page.
// ============================================================

export const getOverview = async (req, res, next) => {
    try {
        const now = new Date();
        const [pendingStalls, listedStalls, removedStalls, users, liveReports, flaggedReports] = await Promise.all([
            Stall.countDocuments(STALL_TABS.pending),
            Stall.countDocuments(STALL_TABS.listed),
            Stall.countDocuments(STALL_TABS.removed),
            User.countDocuments(),
            StatusReport.countDocuments({ expiresAt: { $gt: now } }),
            StatusReport.countDocuments({ expiresAt: { $gt: now }, 'flaggedBy.0': { $exists: true } }) // live with at least one flag
        ]);

        res.status(200).json({
            success: true,
            data: { pendingStalls, listedStalls, removedStalls, users, liveReports, flaggedReports }
        });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/stalls
// Query: status (pending, listed or removed; default pending), search (optional, stall name or dish)
// Newest first, up to 100. Each stall has hawkerCentre: { _id, name } and addedBy: { _id, name, email }.
// ============================================================

export const getAdminStalls = async (req, res, next) => {
    try {
        const status = req.query.status || 'pending';
        if (!Object.hasOwn(STALL_TABS, status)) {
            res.status(400).json({ success: false, message: 'status must be one of: pending, listed, removed' });
            return;
        }

        const filter = { ...STALL_TABS[status] };
        if (req.query.search) {
            filter.$or = [{ name: contains(req.query.search) }, { speciality: contains(req.query.search) }];
        }

        const stalls = await Stall
            .find(filter)
            .populate('hawkerCentre', 'name')
            .populate('addedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .lean();

        res.status(200).json({ success: true, data: stalls });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/admin/stalls/:id/approve
// Lists a stall that was waiting for approval.
// ============================================================

export const approveStall = async (req, res, next) => {
    try {
        const stall = await Stall.findById(req.params.id);

        if (!stall || !stall.isActive || !stall.pendingApproval) {
            res.status(404).json({ success: false, message: 'No stall waiting for approval with that id.' });
            return;
        }

        stall.pendingApproval = false;
        await stall.save();

        res.status(200).json({ success: true, data: stall.toObject() });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/admin/stalls/:id/reject
// Deletes a stall that was waiting for approval. It was never shown to anyone,
// so it has no reviews or reports to keep.
// ============================================================

export const rejectStall = async (req, res, next) => {
    try {
        const stall = await Stall.findOneAndDelete({ _id: req.params.id, isActive: true, pendingApproval: true });

        if (!stall) {
            res.status(404).json({ success: false, message: 'No stall waiting for approval with that id.' });
            return;
        }

        res.status(200).json({ success: true, data: { id: stall._id } });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/admin/stalls/:id/restore
// Brings back a removed stall, with its reviews. Its unit number was cleared when it was removed,
// so an admin can set it again by editing the stall.
// ============================================================

export const restoreStall = async (req, res, next) => {
    try {
        const stall = await Stall.findById(req.params.id);

        if (!stall || stall.isActive) {
            res.status(404).json({ success: false, message: 'No removed stall with that id.' });
            return;
        }

        const sameName = await Stall.exists({
            _id: { $ne: stall._id },
            hawkerCentre: stall.hawkerCentre,
            isActive: true,
            name: exactly(stall.name)
        });
        if (sameName) {
            res.status(409).json({ success: false, message: `There is already a stall called "${stall.name}" at this centre.` });
            return;
        }

        stall.isActive = true;
        stall.pendingApproval = false;
        await stall.save();

        res.status(200).json({ success: true, data: stall.toObject() });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/reports
// Query: flagged=true for only reports at least one user flagged as wrong.
// Newest first, up to 100, expired ones included. Unlike the public lists, each report says who
// sent it (user: { _id, name, email }), how many flagged it, and whether it is live or hidden.
// ============================================================

export const getAdminReports = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.flagged === 'true') {
            filter['flaggedBy.0'] = { $exists: true };
        }

        const reports = await StatusReport
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .populate('stall', 'name unitNumber')
            .populate('hawkerCentre', 'name')
            .populate('user', 'name email')
            .lean();

        const data = reports.map(report => ({
            id: report._id,
            stall: report.stall,
            hawkerCentre: report.hawkerCentre,
            user: report.user,
            status: report.status,
            createdAt: report.createdAt,
            expiresAt: report.expiresAt,
            flagCount: report.flaggedBy?.length ?? 0,
            live: isLive(report),
            hidden: isHidden(report)
        }));

        res.status(200).json({ success: true, data: { reports: data, hideThreshold: FLAG_HIDE_THRESHOLD } });
    } catch (error) {
        next(error);
    }
};
