// Calls the real stall and admin routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import app from '../app.js';
import HawkerCentre from '../models/HawkerCentre.js';
import ImportLog from '../models/ImportLog.js';
import Stall from '../models/Stall.js';
import User from '../models/User.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';
import { checkStallDetails, normaliseUnitNumber } from '../utils/stallUtils.js';

process.env.JWT_SECRET = 'test-secret';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';

const adder = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Adder', role: 'user' };
const otherUser = { _id: '64b7f0c2a1b2c3d4e5f60731', name: 'Someone Else', role: 'user' };
const admin = { _id: '64b7f0c2a1b2c3d4e5f60732', name: 'Admin', role: 'admin' };

// Starts the real app on a free port.
async function startServer(t) {
    const server = app.listen(0);
    t.after(() => server.close());
    await new Promise((resolve) => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
}

// Logs `user` in: protect() looks the user up again, so User.findById returns them.
function loginAs(t, user) {
    t.mock.method(User, 'findById', async () => user);
    return { Cookie: `${AUTH_COOKIE}=${signToken(user)}` };
}

// A saved stall added by `adder`, with a fake save()
function savedStall(t) {
    const stall = {
        _id: STALL_ID,
        hawkerCentre: CENTRE_ID,
        name: 'Ah Hock Chicken Rice',
        cuisine: 'Chicken rice',
        unitNumber: '01-23',
        isActive: true,
        addedBy: adder._id,
        save: t.mock.fn(async () => {}),
        toObject() { return { _id: this._id, name: this.name, cuisine: this.cuisine, unitNumber: this.unitNumber }; }
    };
    t.mock.method(Stall, 'findById', async () => stall);
    return stall;
}

function send(url, method, headers, body) {
    return fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body && JSON.stringify(body)
    });
}


test('normaliseUnitNumber accepts common ways of writing a unit number', () => {
    assert.equal(normaliseUnitNumber('#01-23'), '01-23');
    assert.equal(normaliseUnitNumber('1-23'), '01-23');
    assert.equal(normaliseUnitNumber(' 02 - 115a '), '02-115A');
    assert.equal(normaliseUnitNumber('stall 5'), null);
});

test('checkStallDetails cleans up the details and rejects bad ones', () => {
    assert.deepEqual(checkStallDetails({ name: '  Ah   Hock ', cuisine: '', unitNumber: '#1-23' }, { nameRequired: true }),
        { details: { name: 'Ah Hock', cuisine: undefined, unitNumber: '01-23' } });
    assert.ok(checkStallDetails({}, { nameRequired: true }).message); // name is required when adding
    assert.deepEqual(checkStallDetails({}, { nameRequired: false }), { details: {} }); // nothing to change when editing
    assert.ok(checkStallDetails({ name: 'A' }, { nameRequired: true }).message);
    assert.ok(checkStallDetails({ name: 'x'.repeat(61) }, { nameRequired: true }).message);
    assert.ok(checkStallDetails({ name: 'Ah Hock', unitNumber: 'near the toilet' }, { nameRequired: true }).message);
    assert.ok(checkStallDetails({ name: { $ne: '' } }, { nameRequired: true }).message);
});

test('POST /api/hawker-centres/:id/stalls needs a login', async (t) => {
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`, 'POST', {}, { name: 'Ah Hock' });
    assert.equal(response.status, 401);
});

test('POST /api/hawker-centres/:id/stalls adds a stall, remembering who added it', async (t) => {
    const headers = loginAs(t, adder);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Stall, 'exists', async () => null);
    const create = t.mock.method(Stall, 'create', async (fields) => ({ toObject: () => ({ _id: STALL_ID, ...fields }) }));
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`, 'POST', headers,
        { name: 'Ah Hock Chicken Rice', cuisine: 'Chicken rice', unitNumber: '#1-23' });
    const body = await response.json();

    assert.equal(response.status, 201);
    const fields = create.mock.calls[0].arguments[0];
    assert.equal(fields.unitNumber, '01-23');
    assert.equal(String(fields.hawkerCentre), CENTRE_ID);
    assert.equal(String(fields.addedBy), adder._id);
    assert.deepEqual(body.data.rating, { average: null, count: 0 });
    assert.equal(body.data.liveReport, null);
});

test('POST /api/hawker-centres/:id/stalls gives 409 for a name already used at the centre', async (t) => {
    const headers = loginAs(t, adder);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    const exists = t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    const create = t.mock.method(Stall, 'create', async () => ({}));
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`, 'POST', headers, { name: 'ah hock chicken rice' });

    assert.equal(response.status, 409);
    assert.ok(exists.mock.calls[0].arguments[0].name.test('Ah Hock Chicken Rice')); // ignores capitals
    assert.equal(create.mock.callCount(), 0);
});

test('POST /api/hawker-centres/:id/stalls gives 404 for a centre that does not exist', async (t) => {
    const headers = loginAs(t, adder);
    t.mock.method(HawkerCentre, 'exists', async () => null);
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`, 'POST', headers, { name: 'Ah Hock' });
    assert.equal(response.status, 404);
});

test('PATCH /api/stalls/:id lets the person who added it, or an admin, change the details', async (t) => {
    for (const user of [adder, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const stall = savedStall(t);
            t.mock.method(Stall, 'exists', async () => null);
            const base = await startServer(t);

            const response = await send(`${base}/api/stalls/${STALL_ID}`, 'PATCH', headers, { unitNumber: '01-24', cuisine: '' });

            assert.equal(response.status, 200);
            assert.equal(stall.unitNumber, '01-24');
            assert.equal(stall.cuisine, undefined); // cleared
            assert.equal(stall.name, 'Ah Hock Chicken Rice'); // not sent, so unchanged
            assert.equal(stall.save.mock.callCount(), 1);
        });
    }
});

test('PATCH /api/stalls/:id refuses other users', async (t) => {
    const headers = loginAs(t, otherUser);
    const stall = savedStall(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/stalls/${STALL_ID}`, 'PATCH', headers, { name: 'Renamed' });

    assert.equal(response.status, 403);
    assert.equal(stall.save.mock.callCount(), 0);
});

test('DELETE /api/stalls/:id is for admins only, and hides the stall instead of deleting it', async (t) => {
    await t.test('a normal user gets 403', async (t) => {
        const headers = loginAs(t, adder);
        savedStall(t);
        const base = await startServer(t);

        const response = await send(`${base}/api/stalls/${STALL_ID}`, 'DELETE', headers);
        assert.equal(response.status, 403);
    });

    await t.test('an admin removes it', async (t) => {
        const headers = loginAs(t, admin);
        const stall = savedStall(t);
        const base = await startServer(t);

        const response = await send(`${base}/api/stalls/${STALL_ID}`, 'DELETE', headers);

        assert.equal(response.status, 200);
        assert.equal(stall.isActive, false);
        assert.equal(stall.unitNumber, undefined); // the unit number is free for a new stall
        assert.equal(stall.save.mock.callCount(), 1);
    });
});

test('GET /api/stalls/:id gives 404 for a removed stall', async (t) => {
    t.mock.method(Stall, 'findById', () => ({
        populate() { return this; },
        lean: async () => ({ _id: STALL_ID, name: 'Gone', isActive: false })
    }));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/stalls/${STALL_ID}`);
    assert.equal(response.status, 404);
});

test('POST /api/admin/import-centres is for admins only', async (t) => {
    const headers = loginAs(t, adder);
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/import-centres`, 'POST', headers);
    assert.equal(response.status, 403);
});

test('POST /api/admin/import-centres runs the import for an admin', async (t) => {
    const headers = loginAs(t, admin);
    t.mock.method(axios, 'get', async () => ({
        data: { success: true, result: { total: 1, records: [{ serial_no: '1', name: 'Adam Road Food Centre', address_myenv: '2, Adam Road, Singapore 289876' }] } }
    }));
    t.mock.method(ImportLog, 'create', async (fields) => ({ ...fields, recordsCreated: 0, recordsUpdated: 0, save: async () => {} }));
    t.mock.method(HawkerCentre, 'updateOne', async () => ({ upsertedCount: 1 }));
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/import-centres`, 'POST', headers);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.status, 'SUCCESS');
    assert.equal(body.data.recordsCreated, 1);
});
