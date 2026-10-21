// Imports NEA's hawker centres and closures into MongoDB. Used by:
//   - npm run import:centres (scripts/importHawkerClosures.js)
//   - the server on start-up, when the data is missing or over a week old (server.js)
//   - admins, with POST /api/admin/import-centres
// Each centre is matched by its NEA serial number (sourceId), so running the import again updates
// centres instead of adding them twice, and their stalls, reviews and favourites stay linked.
import HawkerCentre from '../models/HawkerCentre.js';
import ImportLog from '../models/ImportLog.js';
import { fetchHawkerCentreRecords, HAWKER_DATASET_ID } from './dataGovService.js';
import { toHawkerCentre } from '../utils/hawkerImport.js';

export const IMPORT_SOURCE = `data.gov.sg ${HAWKER_DATASET_ID}`;
const REFRESH_AFTER_DAYS = 7;

// Runs the import and returns { status, recordsFetched, recordsCreated, recordsUpdated, failed }
export async function importHawkerCentres() {
    const log = await ImportLog.create({ source: IMPORT_SOURCE });
    const failed = [];

    try {
        const records = await fetchHawkerCentreRecords();
        log.recordsFetched = records.length;

        for (const record of records) {
            const centre = toHawkerCentre(record);
            try {
                // upsert: update the centre with this sourceId, or create it if it's new
                const result = await HawkerCentre.updateOne(
                    { sourceId: centre.sourceId },
                    { $set: centre },
                    { upsert: true, runValidators: true }
                );
                if (result.upsertedCount) {
                    log.recordsCreated += 1;
                } else {
                    log.recordsUpdated += 1;
                }
            } catch (error) {
                // One bad record shouldn't stop the rest; it is listed in the log instead
                failed.push(`${centre.name || record.serial_no}: ${error.message}`);
            }
        }

        log.status = failed.length ? 'PARTIAL' : 'SUCCESS';
        if (failed.length) {
            log.errorMessage = failed.join('; ').slice(0, 2000);
        }
    } catch (error) {
        log.status = 'FAILED';
        log.errorMessage = error.message;
    }

    log.finishedAt = new Date();
    await log.save();

    return {
        status: log.status,
        recordsFetched: log.recordsFetched,
        recordsCreated: log.recordsCreated,
        recordsUpdated: log.recordsUpdated,
        failed: failed,
        errorMessage: log.errorMessage
    };
}

// True when there are no imported centres yet, or the last good import is over REFRESH_AFTER_DAYS old.
// NEA updates the closure dates every few months, so a weekly refresh keeps them current.
export async function isHawkerDataStale() {
    if (!await HawkerCentre.exists({ sourceId: { $exists: true } })) {
        return true;
    }
    const lastGood = await ImportLog
        .findOne({ source: IMPORT_SOURCE, status: { $in: ['SUCCESS', 'PARTIAL'] } })
        .sort({ createdAt: -1 });
    if (!lastGood) {
        return true;
    }
    const ageDays = (Date.now() - lastGood.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    return ageDays > REFRESH_AFTER_DAYS;
}
