// Tests for turning NEA's data.gov.sg records into hawker centres, and for the import itself.
// The records below are copied from the real dataset. No network or database is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import HawkerCentre from '../models/HawkerCentre.js';
import ImportLog from '../models/ImportLog.js';
import { cleanText, parseSgDate, splitAddress, toClosures, toHawkerCentre } from '../utils/hawkerImport.js';
import { importHawkerCentres } from '../services/hawkerImportService.js';
import axios from 'axios';

const ADAM_ROAD = {
    serial_no: '1', name: 'Adam Road Food Centre', address_myenv: '2, Adam Road, Singapore 289876',
    latitude_hc: '1.324131966', longitude_hc: '103.8141632', no_of_food_stalls: '32',
    q1_cleaningstartdate: '30/3/2026', q1_cleaningenddate: '31/3/2026', remarks_q1: 'nil',
    q2_cleaningstartdate: '8/6/2026', q2_cleaningenddate: '8/6/2026', remarks_q2: 'nil',
    q3_cleaningstartdate: '7/9/2026', q3_cleaningenddate: '7/9/2026', remarks_q3: 'nil',
    q4_cleaningstartdate: '7/12/2026', q4_cleaningenddate: '8/12/2026', remarks_q4: 'nil',
    other_works_startdate: 'NA', other_works_enddate: 'NA', remarks_other_works: 'nil',
    photourl: 'http://www.nea.gov.sg/images/default-source/Hawker-Centres-Division/resize_1267437914368.jpg',
    description_myenv: 'Built in 1974, Adam Food Centre comprises 32 cooked food stalls.', status: 'Existing'
};

const BUKIT_TIMAH = {
    ...ADAM_ROAD, serial_no: '20', name: 'Bukit Timah Market',
    address_myenv: 'Closed for redevelopment till 2029 (tentative)',
    q1_cleaningstartdate: 'TBC', q1_cleaningenddate: 'TBC',
    other_works_startdate: '1/10/2024', other_works_enddate: '31/12/2029',
    remarks_other_works: 'Closed for redevelopment till 2029 (tentative)'
};


test('parseSgDate reads day/month/year and skips NA, TBC and impossible dates', () => {
    assert.equal(parseSgDate('30/3/2026').toISOString(), '2026-03-30T00:00:00.000Z');
    assert.equal(parseSgDate('NA'), null);
    assert.equal(parseSgDate('TBC'), null);
    assert.equal(parseSgDate('31/2/2026'), null); // there is no 31 February
    assert.equal(parseSgDate(''), null);
});

test('cleanText treats nil, NA and TBC as empty', () => {
    assert.equal(cleanText('nil'), undefined);
    assert.equal(cleanText(' NA '), undefined);
    assert.equal(cleanText('Repairs and Redecoration '), 'Repairs and Redecoration');
});

test('splitAddress keeps the postal code separately, including when two are listed', () => {
    assert.deepEqual(splitAddress('2, Adam Road, Singapore 289876'), { address: '2, Adam Road', postalCode: '289876' });
    assert.deepEqual(splitAddress('Blk 13/14, Haig Road, Singapore 430013/430014'), { address: 'Blk 13/14, Haig Road', postalCode: '430013' });
    assert.deepEqual(splitAddress('Closed for redevelopment till 2029 (tentative)'),
        { address: 'Closed for redevelopment till 2029 (tentative)', postalCode: undefined });
});

test('toHawkerCentre turns a real record into a centre', () => {
    const centre = toHawkerCentre(ADAM_ROAD);

    assert.equal(centre.sourceId, '1');
    assert.equal(centre.name, 'Adam Road Food Centre');
    assert.equal(centre.address, '2, Adam Road');
    assert.equal(centre.postalCode, '289876');
    assert.equal(centre.foodStallCount, 32);
    assert.deepEqual(centre.location.coordinates, [103.8141632, 1.324131966]); // [longitude, latitude]
    assert.ok(centre.photoUrl.startsWith('https://www.nea.gov.sg/')); // http changed to https
    assert.equal(centre.closures.length, 4); // four cleanings; "other works" is NA
    assert.equal(centre.closures[0].type, 'CLEANING');
    assert.equal(centre.closures[0].remarks, undefined);
});

test('toClosures keeps long works closures and skips TBC cleanings', () => {
    const closures = toClosures(BUKIT_TIMAH);
    const works = closures.find((closure) => closure.type === 'OTHER_WORKS');

    assert.equal(closures.length, 4); // Q2-Q4 cleanings + the works; Q1 is TBC
    assert.equal(works.endDate.toISOString(), '2029-12-31T00:00:00.000Z');
    assert.equal(works.remarks, 'Closed for redevelopment till 2029 (tentative)');
});

test('the centre from a record passes the HawkerCentre model checks', () => {
    for (const record of [ADAM_ROAD, BUKIT_TIMAH]) {
        const error = new HawkerCentre(toHawkerCentre(record)).validateSync();
        assert.equal(error, undefined, error && error.message);
    }
});

test('importHawkerCentres updates centres by NEA serial number and logs the run', async (t) => {
    t.mock.method(axios, 'get', async () => ({
        data: { success: true, result: { total: 2, records: [ADAM_ROAD, BUKIT_TIMAH] } }
    }));
    let saved = null;
    t.mock.method(ImportLog, 'create', async (fields) => ({ ...fields, recordsCreated: 0, recordsUpdated: 0, save: async function () { saved = this; } }));
    const updateOne = t.mock.method(HawkerCentre, 'updateOne', async (filter) =>
        (filter.sourceId === '1' ? { upsertedCount: 1 } : { upsertedCount: 0 }));

    const result = await importHawkerCentres();

    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.recordsFetched, 2);
    assert.equal(result.recordsCreated, 1);
    assert.equal(result.recordsUpdated, 1);
    assert.deepEqual(updateOne.mock.calls[0].arguments[0], { sourceId: '1' });
    assert.equal(updateOne.mock.calls[0].arguments[2].upsert, true);
    assert.equal(saved.status, 'SUCCESS');
});

test('importHawkerCentres keeps going when one centre fails, and reports it', async (t) => {
    t.mock.method(axios, 'get', async () => ({
        data: { success: true, result: { total: 2, records: [ADAM_ROAD, BUKIT_TIMAH] } }
    }));
    t.mock.method(ImportLog, 'create', async (fields) => ({ ...fields, recordsCreated: 0, recordsUpdated: 0, save: async () => {} }));
    t.mock.method(HawkerCentre, 'updateOne', async (filter) => {
        if (filter.sourceId === '20') throw new Error('bad data');
        return { upsertedCount: 0 };
    });

    const result = await importHawkerCentres();

    assert.equal(result.status, 'PARTIAL');
    assert.equal(result.recordsUpdated, 1);
    assert.match(result.failed[0], /Bukit Timah Market: bad data/);
});

test('importHawkerCentres reports FAILED when data.gov.sg cannot be reached', async (t) => {
    t.mock.method(axios, 'get', async () => { throw new Error('getaddrinfo ENOTFOUND data.gov.sg'); });
    t.mock.method(ImportLog, 'create', async (fields) => ({ ...fields, recordsCreated: 0, recordsUpdated: 0, save: async () => {} }));
    const updateOne = t.mock.method(HawkerCentre, 'updateOne', async () => ({}));

    const result = await importHawkerCentres();

    assert.equal(result.status, 'FAILED');
    assert.match(result.errorMessage, /data.gov.sg request failed/);
    assert.equal(updateOne.mock.callCount(), 0);
});
