// Calls the real favourites routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startServer } from './startServer.js';
import Favourite from '../models/Favourite.js';
import HawkerCentre from '../models/HawkerCentre.js';
import Stall from '../models/Stall.js';
import User from '../models/User.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';

process.env.JWT_SECRET = 'test-secret';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';
const FAVOURITE_ID = '64b7f0c2a1b2c3d4e5f60720';

const diner = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Diner', role: 'user' };

// Logs `user` in: protect() looks the user up again, so User.findById returns them.
function loginAs(t, user) {
    t.mock.method(User, 'findById', async () => user);
    return { Cookie: `${AUTH_COOKIE}=${signToken(user)}` };
}

function send(url, method, headers, body) {
    return fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body && JSON.stringify(body)
    });
}

// Favourite.find(...).populate(...).sort(...) resolving to `rows`
function fakeListQuery(rows) {
    const query = {
        populate: () => query,
        sort: () => query,
        then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject)
    };
    return query;
}

// The error Mongoose gives for these alert settings, from the real schema rules
function alertValidationError(alert) {
    const doc = new Favourite({ user: diner._id, targetType: 'Stall', target: STALL_ID, alert });
    return doc.validateSync();
}


test('every favourites route needs a login', async (t) => {
    const baseUrl = await startServer(t);
    const routes = [
        ['GET', '/api/favourites'],
        ['POST', '/api/favourites'],
        ['PATCH', `/api/favourites/${FAVOURITE_ID}/alert`],
        ['DELETE', `/api/favourites/${FAVOURITE_ID}`]
    ];

    for (const [method, path] of routes) {
        const response = await send(`${baseUrl}${path}`, method, {}, method === 'GET' ? undefined : {});
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.equal((await response.json()).success, false);
    }
});

test('GET /api/favourites lists only the logged-in user\'s favourites', async (t) => {
    const headers = loginAs(t, diner);
    const rows = [{ _id: FAVOURITE_ID, targetType: 'HawkerCentre', target: { _id: CENTRE_ID, name: 'Maxwell' } }];
    const find = t.mock.method(Favourite, 'find', () => fakeListQuery(rows));
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites`, 'GET', headers);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: rows });
    assert.equal(find.mock.calls[0].arguments[0].user, diner._id);
});

test('POST /api/favourites saves a hawker centre for the logged-in user', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    const create = t.mock.method(Favourite, 'create', async (data) => ({ _id: FAVOURITE_ID, ...data }));
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites`, 'POST', headers, { targetType: 'HawkerCentre', target: CENTRE_ID });

    assert.equal(response.status, 201);
    assert.equal((await response.json()).data._id, FAVOURITE_ID);
    assert.deepEqual(create.mock.calls[0].arguments[0], { user: diner._id, targetType: 'HawkerCentre', target: CENTRE_ID });
});

test('POST /api/favourites only accepts a stall that is still active', async (t) => {
    const headers = loginAs(t, diner);
    const exists = t.mock.method(Stall, 'exists', async () => null);
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites`, 'POST', headers, { targetType: 'Stall', target: STALL_ID });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, 'Stall not found');
    assert.deepEqual(exists.mock.calls[0].arguments[0], { _id: STALL_ID, isActive: true });
});

test('POST /api/favourites rejects a bad targetType or a missing target', async (t) => {
    const headers = loginAs(t, diner);
    const baseUrl = await startServer(t);

    const badType = await send(`${baseUrl}/api/favourites`, 'POST', headers, { targetType: 'Review', target: STALL_ID });
    assert.equal(badType.status, 400);
    assert.equal((await badType.json()).message, 'targetType must be Stall or HawkerCentre');

    const noTarget = await send(`${baseUrl}/api/favourites`, 'POST', headers, { targetType: 'Stall' });
    assert.equal(noTarget.status, 400);
    assert.equal((await noTarget.json()).message, 'target is required');
});

test('POST /api/favourites gives 409 when it is already saved', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Favourite, 'create', async () => {
        throw Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { target: CENTRE_ID } });
    });
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites`, 'POST', headers, { targetType: 'HawkerCentre', target: CENTRE_ID });

    assert.equal(response.status, 409);
});

test('PATCH /api/favourites/:id/alert saves valid days and time on the user\'s own favourite', async (t) => {
    const headers = loginAs(t, diner);
    const alert = { enabled: true, days: [1, 3, 5], time: '12:30' };
    const update = t.mock.method(Favourite, 'findOneAndUpdate', async () => ({ _id: FAVOURITE_ID, alert }));
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, alert);

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.alert, alert);

    const [filter, changes, options] = update.mock.calls[0].arguments;
    assert.deepEqual(filter, { _id: FAVOURITE_ID, user: diner._id });
    assert.deepEqual(changes, { $set: { 'alert.enabled': true, 'alert.days': [1, 3, 5], 'alert.time': '12:30' } });
    assert.equal(options.runValidators, true); // without this the invalid cases below would be saved
});

test('PATCH /api/favourites/:id/alert only changes the fields that were sent', async (t) => {
    const headers = loginAs(t, diner);
    const update = t.mock.method(Favourite, 'findOneAndUpdate', async () => ({ _id: FAVOURITE_ID }));
    const baseUrl = await startServer(t);

    await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { enabled: false });

    assert.deepEqual(update.mock.calls[0].arguments[1], { $set: { 'alert.enabled': false } });
});

test('PATCH /api/favourites/:id/alert gives 400 for an invalid time', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(Favourite, 'findOneAndUpdate', async () => { throw alertValidationError({ time: '25:99' }); });
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { time: '25:99' });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, 'Alert time must be HH:mm');
});

test('PATCH /api/favourites/:id/alert gives 400 for a day outside 0 to 6', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(Favourite, 'findOneAndUpdate', async () => { throw alertValidationError({ days: [7] }); });
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { days: [7] });

    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /maximum allowed value \(6\)/);
});

test('PATCH /api/favourites/:id/alert gives 404 for a favourite the user does not have', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(Favourite, 'findOneAndUpdate', async () => null);
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { enabled: true });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, 'Favourite not found');
});

test('DELETE /api/favourites/:id removes the user\'s own favourite', async (t) => {
    const headers = loginAs(t, diner);
    const remove = t.mock.method(Favourite, 'findOneAndDelete', async () => ({ _id: FAVOURITE_ID }));
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}`, 'DELETE', headers);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { id: FAVOURITE_ID } });
    assert.deepEqual(remove.mock.calls[0].arguments[0], { _id: FAVOURITE_ID, user: diner._id });
});

test('DELETE /api/favourites/:id gives 404 when there is nothing to remove', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(Favourite, 'findOneAndDelete', async () => null);
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/${FAVOURITE_ID}`, 'DELETE', headers);

    assert.equal(response.status, 404);
    assert.equal((await response.json()).message, 'Favourite not found');
});

test('DELETE /api/favourites/:id gives 400 for an invalid id', async (t) => {
    const headers = loginAs(t, diner);
    t.mock.method(Favourite, 'findOneAndDelete', async () => {
        throw new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id');
    });
    const baseUrl = await startServer(t);

    const response = await send(`${baseUrl}/api/favourites/not-an-id`, 'DELETE', headers);

    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, 'Invalid _id');
});
