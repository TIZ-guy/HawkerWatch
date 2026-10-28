// Calls the real routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import HawkerCentre from '../models/HawkerCentre.js';
import Stall from '../models/Stall.js';
import StatusReport from '../models/StatusReport.js';
import Review from '../models/Review.js';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';

// A stand-in for a mongoose query: chaining methods return itself and awaiting gives the result.
function fakeQuery(result) {
    return {
        sort() { return this; },
        select() { return this; },
        populate() { return this; },
        lean() { return this; },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
}

// Starts the real app on a free port.
async function startServer(t) {
    const server = app.listen(0);
    t.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
}

test('GET /api/hawker-centres returns the centres, each with how many stalls are listed', async (t) => {
    t.mock.method(HawkerCentre, 'find', () => fakeQuery([
        { _id: CENTRE_ID, name: 'Test Centre', location: { coordinates: [103.8, 1.3] } },
        { _id: '64b7f0c2a1b2c3d4e5f6071b', name: 'Empty Centre' }
    ]));
    const aggregate = t.mock.method(Stall, 'aggregate', async () => [{ _id: CENTRE_ID, count: 12 }]);
    t.mock.method(StatusReport, 'aggregate', async () => []);

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres`)).json();

    assert.equal(body.success, true);
    assert.equal(body.data[0].name, 'Test Centre');
    assert.deepEqual(body.data[0].location.coordinates, [103.8, 1.3]);
    assert.equal(body.data[0].stallCount, 12);
    assert.equal(body.data[1].stallCount, 0); // no stalls added yet
    // Only stalls that haven't been removed are counted
    assert.equal(aggregate.mock.calls[0].arguments[0][0].$match.isActive, true);
});

test('GET /api/hawker-centres includes how many stalls have live updates', async (t) => {
    t.mock.method(HawkerCentre, 'find', () => fakeQuery([
        { _id: CENTRE_ID, name: 'Busy Centre' },
        { _id: '64b7f0c2a1b2c3d4e5f6071b', name: 'Quiet Centre' }
    ]));
    t.mock.method(Stall, 'aggregate', async () => []);
    const aggregate = t.mock.method(StatusReport, 'aggregate', async () => [{ _id: CENTRE_ID, count: 2 }]);

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres`)).json();

    assert.equal(body.data[0].liveStallCount, 2);
    assert.equal(body.data[1].liveStallCount, 0);

    const [match, byStall, byCentre] = aggregate.mock.calls[0].arguments[0];
    // Same rules as the live reports shown on stall pages: not expired, not hidden by 3 flags
    assert.ok(match.$match.expiresAt.$gt instanceof Date);
    assert.deepEqual(match.$match['flaggedBy.2'], { $exists: false });
    // Several reports for one stall count once
    assert.deepEqual(byStall.$group._id, { centre: '$hawkerCentre', stall: '$stall' });
    assert.equal(byCentre.$group._id, '$_id.centre');
});

test('GET /api/hawker-centres/:id includes how many stalls are listed', async (t) => {
    t.mock.method(HawkerCentre, 'findById', () => fakeQuery({ _id: CENTRE_ID, name: 'Test Centre' }));
    t.mock.method(Stall, 'aggregate', async () => [{ _id: CENTRE_ID, count: 3 }]);

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres/${CENTRE_ID}`)).json();

    assert.equal(body.data.stallCount, 3);
});

test('GET /api/hawker-centres builds a search and a nearby filter', async (t) => {
    const find = t.mock.method(HawkerCentre, 'find', () => fakeQuery([]));
    t.mock.method(Stall, 'aggregate', async () => []);
    t.mock.method(StatusReport, 'aggregate', async () => []);

    const base = await startServer(t);
    await fetch(`${base}/api/hawker-centres?search=chicken&lat=1.3&lng=103.8&radius=500`);

    const filter = find.mock.calls[0].arguments[0];
    assert.equal(filter.$or.length, 2);
    assert.deepEqual(filter.location.$nearSphere.$geometry.coordinates, [103.8, 1.3]);
    assert.equal(filter.location.$nearSphere.$maxDistance, 500);
});

test('GET /api/hawker-centres gives 400 for bad coordinates', async (t) => {
    t.mock.method(HawkerCentre, 'find', () => fakeQuery([]));
    const base = await startServer(t);

    const onlyLat = await fetch(`${base}/api/hawker-centres?lat=1.3`);
    assert.equal(onlyLat.status, 400);

    const outOfRange = await fetch(`${base}/api/hawker-centres?lat=200&lng=103.8`);
    assert.equal(outOfRange.status, 400);
    assert.equal((await outOfRange.json()).success, false);
});

test('GET /api/hawker-centres/:id gives 404 when the centre is missing', async (t) => {
    t.mock.method(HawkerCentre, 'findById', () => fakeQuery(null));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/hawker-centres/${CENTRE_ID}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, message: 'Hawker centre not found.' });
});

test('GET /api/hawker-centres/:id gives 400 for an id that is not an ObjectId', async (t) => {
    const base = await startServer(t);

    const response = await fetch(`${base}/api/hawker-centres/not-an-id`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
});

test('GET /api/hawker-centres/:id/stalls adds each stall\'s newest live report and rating', async (t) => {
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Stall, 'find', () => fakeQuery([
        { _id: STALL_ID, name: 'Laksa' },
        { _id: '64b7f0c2a1b2c3d4e5f6071a', name: 'Satay' }
    ]));
    t.mock.method(StatusReport, 'find', () => fakeQuery([
        { stall: STALL_ID, status: 'LONG_QUEUE' },
        { stall: STALL_ID, status: 'OPEN' }
    ]));
    t.mock.method(Review, 'aggregate', async () => [{ _id: STALL_ID, average: 4.333, count: 3 }]);

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`)).json();

    assert.equal(body.data[0].liveReport.status, 'LONG_QUEUE');
    assert.equal(body.data[1].liveReport, null);
    assert.deepEqual(body.data[0].rating, { average: 4.3, count: 3 }); // rounded to 1 decimal place
    assert.deepEqual(body.data[1].rating, { average: null, count: 0 }); // no reviews yet
});

test('GET /api/hawker-centres/:id/community-summary counts each stall once', async (t) => {
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    const find = t.mock.method(StatusReport, 'find', () => fakeQuery([
        { stall: STALL_ID, status: 'SHORT_QUEUE', createdAt: new Date() },
        { stall: STALL_ID, status: 'OPEN', createdAt: new Date(Date.now() - 600000) },
        { stall: 'other-stall', status: 'OPEN', createdAt: new Date(Date.now() - 900000) }
    ]));

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres/${CENTRE_ID}/community-summary`)).json();

    assert.equal(body.data.stallsReported, 2);
    assert.equal(body.data.byStatus.SHORT_QUEUE, 1);
    assert.equal(body.data.byStatus.OPEN, 1);
    assert.equal(body.data.byStatus.LONG_QUEUE, 0);
    // Only reports that have not expired are queried.
    assert.ok(find.mock.calls[0].arguments[0].expiresAt.$gt instanceof Date);
});

test('GET /api/stalls/:id includes the newest live report and the rating', async (t) => {
    t.mock.method(Stall, 'findById', () => fakeQuery({ _id: STALL_ID, name: 'Laksa' }));
    t.mock.method(StatusReport, 'find', () => fakeQuery([{ stall: STALL_ID, status: 'OPEN' }]));
    t.mock.method(Review, 'aggregate', async () => [{ _id: STALL_ID, average: 5, count: 1 }]);

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/stalls/${STALL_ID}`)).json();

    assert.equal(body.data.liveReport.status, 'OPEN');
    assert.deepEqual(body.data.rating, { average: 5, count: 1 });
});

test('GET /api/stalls/:id gives 404 when the stall is missing', async (t) => {
    t.mock.method(Stall, 'findById', () => fakeQuery(null));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/stalls/${STALL_ID}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, message: 'Stall not found.' });
});

test('GET /api/stalls/:id/reports returns the live reports', async (t) => {
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(StatusReport, 'find', () => fakeQuery([{ stall: STALL_ID, status: 'OPEN' }]));

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/stalls/${STALL_ID}/reports`)).json();

    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].status, 'OPEN');
});

test('a database error is passed to the shared error handler', async (t) => {
    t.mock.method(console, 'error', () => {}); // keep the test output clean
    t.mock.method(Stall, 'find', () => { throw new Error('database is down'); });
    const base = await startServer(t);

    const response = await fetch(`${base}/api/stalls`);
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
});
