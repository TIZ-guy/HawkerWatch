import StatusReport from '../models/StatusReport.js';
import Stall from '../models/Stall.js';
import Review from '../models/Review.js';
import { FLAG_HIDE_THRESHOLD } from './reportUtils.js';
import { currentReviewFilter } from './reviewUtils.js';

// Small helpers shared by the hawker-centre and stall controllers.

// Case-insensitive "contains" search. The replace stops characters like ( or * from breaking it.
export function contains(text) {
    return new RegExp(String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

// Reports are kept after they expire, so only reports that have not expired yet are fetched.
// Newest first. The user ids are left out so they are not sent to the frontend.
// Reports flagged by FLAG_HIDE_THRESHOLD or more users are hidden too (Eugene's rule in reportUtils.js):
// "flaggedBy.2 doesn't exist" means the flaggedBy list has fewer than 3 entries.
export function getLiveReports(filter) {
    return StatusReport
        .find({
            ...filter,
            expiresAt: { $gt: new Date() },
            [`flaggedBy.${FLAG_HIDE_THRESHOLD - 1}`]: { $exists: false }
        })
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
        { $match: { hawkerCentre: { $in: centreIds }, isActive: true } },
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
