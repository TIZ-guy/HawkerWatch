// Tests for the helper functions. They run without a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, latestReportPerStall } from '../utils/hawkerUtils.js';

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
