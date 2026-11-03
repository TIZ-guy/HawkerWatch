import StatusReport from '../models/StatusReport.js';
import Stall from '../models/Stall.js';
import Review from '../models/Review.js';
import { FLAG_HIDE_THRESHOLD } from './reportUtils.js';
import { CUISINE_VALUES } from './constants.js';
import { currentReviewFilter } from './reviewUtils.js';
import { LISTED_STALL } from './stallUtils.js';

// Small helpers shared by the hawker-centre and stall controllers.

// Case-insensitive "contains" search. The replace stops characters like ( or * from breaking it.
export function contains(text) {
    return new RegExp(String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// Reports are kept after they expire, so only reports that have not expired yet are fetched.
// Newest first. The user ids are left out so they are not sent to the frontend.
// Reports flagged by FLAG_HIDE_THRESHOLD or more users are hidden too (Eugene's rule in reportUtils.js):
// "flaggedBy.2 doesn't exist" means the flaggedBy list has fewer than 3 entries.
function liveReportFilter() {
    return {
        expiresAt: { $gt: new Date() },
        [`flaggedBy.${FLAG_HIDE_THRESHOLD - 1}`]: { $exists: false }
    };
}

export function getLiveReports(filter) {
    return StatusReport
        .find({ ...filter, ...liveReportFilter() })
        .sort({ createdAt: -1 })
        .select('-user -flaggedBy')
        .lean();
}

// `reports` must be newest first. Returns a Map of stallId -> that stall's newest report.
export function latestReportPerStall(reports) {
    const latest = new Map();

    for (const report of reports) {
        const stallId = String(report.stall);

        if (!latest.has(stallId)) {
            latest.set(stallId, report);
        }
    }
    return latest;
}


// Average star rating and number of reviews for each stall in `stallIds`.
// Only current reviews count (posted or edited in the last 3 months).
// Returns an object of stallId -> { average, count }. Stalls with no reviews are left out.
// average is rounded to 1 decimal place, e.g. 4.3
export async function getRatings(stallIds) {
    const groups = await Review.aggregate([
        { $match: { stall: { $in: stallIds }, ...currentReviewFilter() } },
        { $group: { _id: '$stall', average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    const ratings = {};
    for (const group of groups) {
        ratings[String(group._id)] = { average: Math.round(group.average * 10) / 10, count: group.count };
    }
    return ratings;
}

// The rating to send for one stall: { average, count }, or { average: null, count: 0 } with no reviews.
export function ratingFor(ratings, stallId) {
    return ratings[String(stallId)] || { average: null, count: 0 };
}

// How many stalls are listed (added and not removed) at each centre in `centreIds`.
// Counted fresh on every request, so it changes as soon as someone adds or removes a stall.
// Returns an object of centreId -> count. Centres with no stalls are left out (use stallCountFor).
export async function getStallCounts(centreIds) {
    const groups = await Stall.aggregate([
        { $match: { hawkerCentre: { $in: centreIds }, ...LISTED_STALL } },
        { $group: { _id: '$hawkerCentre', count: { $sum: 1 } } }
    ]);

    const counts = {};
    for (const group of groups) {
        counts[String(group._id)] = group.count;
    }
    return counts;
}

// The number of stalls listed at one centre (0 when none)
export function stallCountFor(counts, centreId) {
    return counts[String(centreId)] || 0;
}

// For the centre list: how many stalls each centre has listed, and which cuisines they cover.
// One query for all the centres. Returns an object of centreId -> { count, cuisines }.
// cuisines follows the order of CUISINE_VALUES, e.g. ['Chinese', 'Malay', 'Drinks'].
export async function getCentreStallInfo(centreIds) {
    const groups = await Stall.aggregate([
        { $match: { hawkerCentre: { $in: centreIds }, ...LISTED_STALL } },
        { $group: { _id: '$hawkerCentre', count: { $sum: 1 }, cuisines: { $addToSet: '$cuisine' } } }
    ]);

    const info = {};
    for (const group of groups) {
        const present = group.cuisines || [];
        info[String(group._id)] = {
            count: group.count,
            cuisines: CUISINE_VALUES.filter(cuisine => present.includes(cuisine))
        };
    }
    return info;
}

// For the centre list: each centre's newest live community report and how many stalls have one.
// Uses the same rules as getLiveReports (not expired, not hidden by flags). One query for all the centres.
// Returns an object of centreId -> { stallsReported, latestStatus, latestReportAt }. Centres with none are left out.
export async function getCentreLiveInfo(centreIds) {
    const groups = await StatusReport.aggregate([
        {
            $match: {
                hawkerCentre: { $in: centreIds },
                expiresAt: { $gt: new Date() },
                [`flaggedBy.${FLAG_HIDE_THRESHOLD - 1}`]: { $exists: false }
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$hawkerCentre',
                latestStatus: { $first: '$status' },
                latestReportAt: { $first: '$createdAt' },
                stalls: { $addToSet: '$stall' }
            }
        }
    ]);

    const info = {};
    for (const group of groups) {
        info[String(group._id)] = {
            stallsReported: (group.stalls || []).length,
            latestStatus: group.latestStatus,
            latestReportAt: group.latestReportAt
        };
    }
    return info;
}
