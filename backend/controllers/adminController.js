import { importHawkerCentres } from '../services/hawkerImportService.js';
import Stall from '../models/Stall.js';
import StatusReport from '../models/StatusReport.js';
import User from '../models/User.js';
import FoodUpdate from '../models/FoodUpdate.js';
import Review from '../models/Review.js';
import Comment from '../models/Comment.js';
import AdminAction from '../models/AdminAction.js';
import { contains } from '../utils/hawkerUtils.js';
import { exactly, LISTED_STALL } from '../utils/stallUtils.js';
import { FLAG_HIDE_THRESHOLD, isHidden, isLive } from '../utils/reportUtils.js';
import * as foodUpdateUtils from '../utils/foodUpdateUtils.js';
import { ROLES } from '../utils/constants.js';
import { BAN_REASON_MAX_LENGTH, MAX_BAN_DAYS, PERMANENT_BAN, isBanned, isPermanentBan } from '../utils/banUtils.js';
import { logAdminAction } from '../utils/adminLog.js';

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
        await logAdminAction(req.user, 'centres.import', `Refreshed the NEA data (${result.recordsFetched} centres)`);

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
        const [pendingStalls, listedStalls, removedStalls, users, liveReports, flaggedReports, flaggedFoodUpdates, bannedUsers] = await Promise.all([
            Stall.countDocuments(STALL_TABS.pending),
            Stall.countDocuments(STALL_TABS.listed),
            Stall.countDocuments(STALL_TABS.removed),
            User.countDocuments(),
            StatusReport.countDocuments({ expiresAt: { $gt: now } }),
            StatusReport.countDocuments({ expiresAt: { $gt: now }, 'flaggedBy.0': { $exists: true } }), // live with at least one flag
            FoodUpdate.countDocuments({ expiresAt: { $gt: now }, 'flaggedBy.0': { $exists: true } }),
            User.countDocuments({ bannedUntil: { $gt: now } })
        ]);

        res.status(200).json({
            success: true,
            data: { pendingStalls, listedStalls, removedStalls, users, liveReports, flaggedReports, flaggedFoodUpdates, bannedUsers }
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
        await logAdminAction(req.user, 'stall.approve', `Approved stall "${stall.name}"`, { type: 'Stall', id: stall._id, user: stall.addedBy });

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
        await logAdminAction(req.user, 'stall.reject', `Rejected stall "${stall.name}"`, { type: 'Stall', id: stall._id, user: stall.addedBy });

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
        await logAdminAction(req.user, 'stall.restore', `Restored stall "${stall.name}"`, { type: 'Stall', id: stall._id, user: stall.addedBy });

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


// ============================================================
// GET /api/admin/food-updates
// Query: flagged=true for only updates at least one user flagged as wrong.
// Newest first, up to 100, expired ones included, with who sent each (user: { _id, name, email }).
// ============================================================

export const getAdminFoodUpdates = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.flagged === 'true') {
            filter['flaggedBy.0'] = { $exists: true };
        }

        const updates = await FoodUpdate
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .populate('stall', 'name unitNumber')
            .populate('hawkerCentre', 'name')
            .populate('user', 'name email')
            .lean();

        const data = updates.map(update => ({
            id: update._id,
            stall: update.stall,
            hawkerCentre: update.hawkerCentre,
            user: update.user,
            type: update.type,
            note: update.note ?? null,
            createdAt: update.createdAt,
            expiresAt: update.expiresAt,
            flagCount: update.flaggedBy?.length ?? 0,
            live: foodUpdateUtils.isLive(update),
            hidden: foodUpdateUtils.isHidden(update)
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/reviews
// Newest first, up to 100, with the stall and its centre, who wrote it, and how many photos it has.
// Reviews can't be flagged, so this is every recent review. Delete one with DELETE /api/reviews/:id.
// ============================================================

export const getAdminReviews = async (req, res, next) => {
    try {
        const reviews = await Review
            .find()
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .populate({ path: 'stall', select: 'name hawkerCentre', populate: { path: 'hawkerCentre', select: 'name' } })
            .populate('user', 'name email')
            .lean();

        const data = reviews.map(review => ({
            id: review._id,
            stall: review.stall,
            user: review.user,
            rating: review.rating,
            text: review.text,
            photoCount: review.photos?.length ?? 0,
            createdAt: review.createdAt,
            editedAt: review.editedAt
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/comments
// Newest first, up to 100, with the centre and who wrote it. Delete one with DELETE /api/comments/:id.
// ============================================================

export const getAdminComments = async (req, res, next) => {
    try {
        const comments = await Comment
            .find()
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .populate('hawkerCentre', 'name')
            .populate('user', 'name email')
            .lean();

        const data = comments.map(comment => ({
            id: comment._id,
            hawkerCentre: comment.hawkerCentre,
            user: comment.user,
            text: comment.text,
            createdAt: comment.createdAt
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/users
// Query: search (optional, name or email), filter (optional: admins or banned)
// Newest first, up to 100. Each user has banned, permanentBan, and posts: { reports, reviews, comments }
// (how many they have ever posted), to help spot spammers.
// ============================================================

export const getAdminUsers = async (req, res, next) => {
    try {
        const filter = {};
        if (req.query.search) {
            filter.$or = [{ name: contains(req.query.search) }, { email: contains(req.query.search) }];
        }
        if (req.query.filter === 'admins') {
            filter.role = 'admin';
        } else if (req.query.filter === 'banned') {
            filter.bannedUntil = { $gt: new Date() };
        }

        const users = await User
            .find(filter)
            .select('name email role bannedUntil banReason createdAt')
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .lean();

        const ids = users.map(user => user._id);
        const [reports, reviews, comments] = await Promise.all(
            [StatusReport, Review, Comment].map(model => countByUser(model, ids))
        );

        const data = users.map(user => {
            const id = String(user._id);
            return {
                ...user,
                banned: isBanned(user),
                permanentBan: isPermanentBan(user),
                posts: { reports: reports[id] || 0, reviews: reviews[id] || 0, comments: comments[id] || 0 }
            };
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// An object of userId -> how many documents of `model` each user in `userIds` has
async function countByUser(model, userIds) {
    const groups = await model.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } }
    ]);

    const counts = {};
    for (const group of groups) {
        counts[String(group._id)] = group.count;
    }
    return counts;
}


// ============================================================
// PATCH /api/admin/users/:id/role
// Body: { role: 'user' or 'admin' }. An admin can't change their own role, so there is always
// at least one admin left.
// ============================================================

export const setUserRole = async (req, res, next) => {
    try {
        const { role } = req.body ?? {};
        if (typeof role !== 'string' || !ROLES.includes(role)) {
            res.status(400).json({ success: false, message: `role must be one of: ${ROLES.join(', ')}` });
            return;
        }
        if (String(req.params.id) === String(req.user._id)) {
            res.status(400).json({ success: false, message: 'You cannot change your own role.' });
            return;
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }

        if (user.role !== role) {
            user.role = role;
            if (role === 'admin') { // an admin can't be banned
                user.bannedUntil = null;
                user.banReason = '';
            }
            await user.save();
            const summary = role === 'admin'
                ? `Made ${user.name} (${user.email}) an admin`
                : `Removed admin from ${user.name} (${user.email})`;
            await logAdminAction(req.user, 'user.role', summary, { type: 'User', id: user._id, user: user._id });
        }

        res.status(200).json({ success: true, data: user.toJSON() });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/admin/users/:id/ban
// Body: { days (1 to 365, or null for a permanent ban), reason (optional, up to 200 characters) }
// Stops the user posting until the ban ends. Admins can't be banned (remove their admin role first).
// ============================================================

export const banUser = async (req, res, next) => {
    try {
        const { days, reason = '' } = req.body ?? {};
        const permanent = days === null || days === undefined;

        if (!permanent && !(Number.isInteger(days) && days >= 1 && days <= MAX_BAN_DAYS)) {
            res.status(400).json({ success: false, message: `days must be a whole number from 1 to ${MAX_BAN_DAYS}, or null for a permanent ban` });
            return;
        }
        if (typeof reason !== 'string' || reason.trim().length > BAN_REASON_MAX_LENGTH) {
            res.status(400).json({ success: false, message: `The reason must be ${BAN_REASON_MAX_LENGTH} characters or fewer` });
            return;
        }
        if (String(req.params.id) === String(req.user._id)) {
            res.status(400).json({ success: false, message: 'You cannot ban yourself.' });
            return;
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (user.role === 'admin') {
            res.status(400).json({ success: false, message: 'Admins cannot be banned. Remove their admin role first.' });
            return;
        }

        user.bannedUntil = permanent ? PERMANENT_BAN : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        user.banReason = reason.trim();
        await user.save();

        const length = permanent ? 'permanently' : `for ${days} day${days === 1 ? '' : 's'}`;
        const because = user.banReason ? `: ${user.banReason}` : '';
        await logAdminAction(req.user, 'user.ban', `${permanent ? 'Banned' : 'Suspended'} ${user.name} (${user.email}) ${length}${because}`, {
            type: 'User', id: user._id, user: user._id
        });

        res.status(200).json({ success: true, data: { ...user.toJSON(), banned: true, permanentBan: permanent } });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/admin/users/:id/unban
// Lets a suspended or banned user post again.
// ============================================================

export const unbanUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        if (!isBanned(user)) {
            res.status(400).json({ success: false, message: 'This user is not banned.' });
            return;
        }

        user.bannedUntil = null;
        user.banReason = '';
        await user.save();
        await logAdminAction(req.user, 'user.unban', `Lifted the ban on ${user.name} (${user.email})`, { type: 'User', id: user._id, user: user._id });

        res.status(200).json({ success: true, data: { ...user.toJSON(), banned: false, permanentBan: false } });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/admin/activity
// The admin activity log, newest first, up to 100. Each entry has admin and subjectUser as { _id, name, email }.
// ============================================================

export const getActivity = async (req, res, next) => {
    try {
        const entries = await AdminAction
            .find()
            .sort({ createdAt: -1 })
            .limit(LIST_LIMIT)
            .populate('admin', 'name email')
            .populate('subjectUser', 'name email')
            .lean();

        res.status(200).json({ success: true, data: entries });
    } catch (error) {
        next(error);
    }
};
