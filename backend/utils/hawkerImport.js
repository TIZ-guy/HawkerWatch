// Turns one record from NEA's "Dates of Hawker Centres Closure" dataset on data.gov.sg into the
// shape of our HawkerCentre model. No database or network here, so it is easy to test.
//
// A record looks like (all values are text):
//   { serial_no: '1', name: 'Adam Road Food Centre', address_myenv: '2, Adam Road, Singapore 289876',
//     latitude_hc: '1.324131966', longitude_hc: '103.8141632', no_of_food_stalls: '32',
//     q1_cleaningstartdate: '30/3/2026', q1_cleaningenddate: '31/3/2026', remarks_q1: 'nil', ... q4 ...,
//     other_works_startdate: 'NA', other_works_enddate: 'NA', remarks_other_works: 'nil',
//     photourl: 'http://www.nea.gov.sg/...jpg', description_myenv: 'Built in 1974, ...' }

// The four quarterly cleanings and the "other works" (repairs, redevelopment) closures
const CLOSURE_COLUMNS = [
    { type: 'CLEANING', start: 'q1_cleaningstartdate', end: 'q1_cleaningenddate', remarks: 'remarks_q1' },
    { type: 'CLEANING', start: 'q2_cleaningstartdate', end: 'q2_cleaningenddate', remarks: 'remarks_q2' },
    { type: 'CLEANING', start: 'q3_cleaningstartdate', end: 'q3_cleaningenddate', remarks: 'remarks_q3' },
    { type: 'CLEANING', start: 'q4_cleaningstartdate', end: 'q4_cleaningenddate', remarks: 'remarks_q4' },
    { type: 'OTHER_WORKS', start: 'other_works_startdate', end: 'other_works_enddate', remarks: 'remarks_other_works' }
];


// "30/3/2026" -> a Date for 30 March 2026 (Singapore dates are day/month/year).
// Returns null for "NA" (no closure), "TBC" (not decided yet) or anything else that isn't a date.
export function parseSgDate(text) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim());
    if (!match) {
        return null;
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day)); // months start at 0 in JavaScript

    // Reject impossible dates like 31/2/2026, which JavaScript would quietly turn into 3 March
    if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
        return null;
    }
    return date;
}

// "nil", "NA", "" -> undefined; anything else -> the trimmed text
export function cleanText(text) {
    const value = String(text || '').trim();
    if (['', 'nil', 'na', 'tbc'].includes(value.toLowerCase())) {
        return undefined;
    }
    return value;
}

// All the closures in a record that have real start and end dates
export function toClosures(record) {
    const closures = [];
    for (const column of CLOSURE_COLUMNS) {
        const startDate = parseSgDate(record[column.start]);
        const endDate = parseSgDate(record[column.end]);
        if (!startDate || !endDate || endDate < startDate) {
            continue;
        }
        closures.push({ type: column.type, startDate: startDate, endDate: endDate, remarks: cleanText(record[column.remarks]) });
    }
    return closures;
}

// "2, Adam Road, Singapore 289876" -> { address: '2, Adam Road', postalCode: '289876' }
// Some records list two postal codes ("Singapore 430013/430014"); the first one is kept.
// The postal code is kept separately because the app adds ", Singapore 289876" when showing it.
export function splitAddress(text) {
    const value = String(text || '').trim();
    const match = /^(.*?),?\s*Singapore\s+(\d{6})(?:\/\d{6})*\s*$/i.exec(value);
    if (!match) {
        return { address: value, postalCode: undefined };
    }
    return { address: match[1].trim(), postalCode: match[2] };
}

// One NEA record -> the fields of a HawkerCentre
export function toHawkerCentre(record) {
    const lat = Number(record.latitude_hc);
    const lng = Number(record.longitude_hc);
    const stallCount = Number(record.no_of_food_stalls);
    const { address, postalCode } = splitAddress(record.address_myenv);
    const photoUrl = cleanText(record.photourl);

    const centre = {
        sourceId: String(record.serial_no).trim(),
        name: String(record.name || '').trim(),
        address: address,
        postalCode: postalCode,
        description: cleanText(record.description_myenv),
        // NEA's photo links start with http://, which browsers block on an https site; https works too
        photoUrl: photoUrl ? photoUrl.replace(/^http:\/\//i, 'https://') : undefined,
        foodStallCount: Number.isInteger(stallCount) && stallCount >= 0 ? stallCount : undefined,
        closures: toClosures(record)
    };

    // GeoJSON order is [longitude, latitude]. Only kept if both are real Singapore-ish numbers.
    if (lat > 1 && lat < 2 && lng > 103 && lng < 105) {
        centre.location = { type: 'Point', coordinates: [lng, lat] };
    }

    return centre;
}
