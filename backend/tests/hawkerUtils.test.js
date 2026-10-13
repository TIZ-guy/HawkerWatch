// Tests for the helper functions. They run without a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, getLiveReports, latestReportPerStall } from '../utils/hawkerUtils.js';
import { FLAG_HIDE_THRESHOLD } from '../utils/reportUtils.js';
import StatusReport from '../models/StatusReport.js';

test('contains matches part of a name and ignores upper and lower case', () => {
    assert.equal(contains('lak').test('Sample Laksa'), true);
    assert.equal(contains('LAKSA').test('Sample Laksa'), true);
    assert.equal(contains('satay').test('Sample Laksa'), false);
});

test('contains treats special characters as plain text', () => {
    assert.equal(contains('a(b').test('a(b'), true);
    assert.equal(contains('.').test('abc'), false);
});

test('latestReportPerStall keeps the first (newest) report of each stall', () => {
    const reports = [
        { stall: 'a', status: 'LONG_QUEUE' },
        { stall: 'a', status: 'OPEN' },
        { stall: 'b', status: 'OPEN' }
    ];
    const latest = latestReportPerStall(reports);

    assert.equal(latest.size, 2);
    assert.equal(latest.get('a').status, 'LONG_QUEUE');
});

test('getLiveReports skips expired reports and reports hidden by flags', async (t) => {
    const find = t.mock.method(StatusReport, 'find', () => {
        const query = { sort: () => query, select: () => query, lean: async () => [] };
        return query;
    });
    await getLiveReports({ stall: 'a' });

    const filter = find.mock.calls[0].arguments[0];
    assert.equal(filter.stall, 'a');
    assert.ok(filter.expiresAt.$gt instanceof Date);
    assert.deepEqual(filter[`flaggedBy.${FLAG_HIDE_THRESHOLD - 1}`], { $exists: false });
});
