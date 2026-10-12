import StatusReport from '../models/StatusReport.js';
import { FLAG_HIDE_THRESHOLD } from './reportUtils.js';

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
