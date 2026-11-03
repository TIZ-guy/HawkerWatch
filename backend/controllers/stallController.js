import Stall from '../models/Stall.js';
import HawkerCentre from '../models/HawkerCentre.js';
import { contains, getLiveReports, getRatings, ratingFor } from '../utils/hawkerUtils.js';
import { checkStallDetails, exactly, LISTED_STALL } from '../utils/stallUtils.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.


// ============================================================
// GET /api/stalls
// Optional query: search (stall name or dish), cuisine (exact category, e.g. "Chinese")
// Each stall has its star rating as rating: { average, count }, and its centre as
// hawkerCentre: { _id, name, address, location } (the home page sorts stalls by distance).
// ============================================================

export const getStalls = async (req, res, next) => {
    try {
        const filter = { ...LISTED_STALL };

        if (req.query.search) {
            filter.$or = [{ name: contains(req.query.search) }, { speciality: contains(req.query.search) }];
        }
        // Only plain text is used, so a query like cuisine[$ne]=x can't reach the database as an operator
        if (typeof req.query.cuisine === 'string' && req.query.cuisine) {
            filter.cuisine = req.query.cuisine;
        }

        const stalls = await Stall
            .find(filter)
            .populate('hawkerCentre', 'name address location')
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

        if (!stall || stall.isActive === false || stall.pendingApproval) { // removed and unapproved stalls are hidden
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



// ============================================================
// POST /api/hawker-centres/:id/stalls
// Login required. Adds a stall to a centre (no official stall list exists, so users add them).
// A stall added by a user waits for an admin to approve it (pendingApproval: true) before anyone sees it.
// A stall added by an admin is listed straight away.
// Body: { name, cuisine (optional category, e.g. "Chinese"), speciality (optional dish), unitNumber (optional, e.g. "01-23") }
// ============================================================

export const addStall = async (req, res, next) => {
    try {
        const centreId = req.params.id;
        const { details, message } = checkStallDetails(req.body, { nameRequired: true });

        if (message) {
            res.status(400).json({ success: false, message: message });
            return;
        }

        if (!await HawkerCentre.exists({ _id: centreId })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const duplicate = await findDuplicate(centreId, details);
        if (duplicate) {
            res.status(409).json({ success: false, message: duplicate });
            return;
        }

        const stall = await Stall.create({
            ...details,
            hawkerCentre: centreId,
            addedBy: req.user._id,
            pendingApproval: req.user.role !== 'admin'
        });

        res.status(201).json({
            success: true,
            data: { ...stall.toObject(), liveReport: null, rating: { average: null, count: 0 } }
        });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// PATCH /api/stalls/:id
// Login required. The person who added the stall, or an admin, can change its details.
// Body: any of { name, cuisine, speciality, unitNumber }; send "" to clear cuisine, speciality or unitNumber.
// ============================================================

export const updateStall = async (req, res, next) => {
    try {
        const stall = await Stall.findById(req.params.id);

        if (!stall || !stall.isActive) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        const isAdmin = req.user.role === 'admin';
        const addedByUser = stall.addedBy && String(stall.addedBy) === String(req.user._id);
        if (!isAdmin && !addedByUser) {
            res.status(403).json({ success: false, message: 'Only the person who added this stall, or an admin, can edit it.' });
            return;
        }

        const { details, message } = checkStallDetails(req.body, { nameRequired: false });
        if (message) {
            res.status(400).json({ success: false, message: message });
            return;
        }

        const duplicate = await findDuplicate(stall.hawkerCentre, details, stall._id);
        if (duplicate) {
            res.status(409).json({ success: false, message: duplicate });
            return;
        }

        // Only the fields that were sent are changed; undefined clears an optional field
        for (const field of ['name', 'cuisine', 'speciality', 'unitNumber']) {
            if (field in details) {
                stall[field] = details[field];
            }
        }
        await stall.save();

        res.status(200).json({ success: true, data: stall.toObject() });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// DELETE /api/stalls/:id
// Admins only (checked in stallRoutes.js). Hides the stall everywhere instead of deleting it,
// so its reviews and reports stay in the database. Its unit number is freed for a new stall.
// An admin can bring it back from the admin page (POST /api/admin/stalls/:id/restore).
// ============================================================

export const removeStall = async (req, res, next) => {
    try {
        const stall = await Stall.findById(req.params.id);

        if (!stall || !stall.isActive) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        stall.isActive = false;
        stall.unitNumber = undefined;
        await stall.save();

        res.status(200).json({ success: true, data: { id: stall._id } });
    } catch (error) {
        next(error);
    }
};


// A message if another active stall in the centre already has this name or unit number, else null.
// `ignoreId` is the stall being edited, so it doesn't count as its own duplicate.
async function findDuplicate(centreId, details, ignoreId) {
    const others = { hawkerCentre: centreId };
    if (ignoreId) {
        others._id = { $ne: ignoreId };
    }

    if (details.name && await Stall.exists({ ...others, isActive: true, name: exactly(details.name) })) {
        return `There is already a stall called "${details.name}" at this centre.`;
    }
    if (details.unitNumber && await Stall.exists({ ...others, unitNumber: details.unitNumber })) {
        return `Unit #${details.unitNumber} already has a stall at this centre.`;
    }
    return null;
}
