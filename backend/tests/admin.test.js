// Stall approvals and the admin page's routes, called over HTTP. The database calls are replaced
// with fakes, so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './startServer.js';
import HawkerCentre from '../models/HawkerCentre.js';
import Stall from '../models/Stall.js';
import StatusReport from '../models/StatusReport.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';

process.env.JWT_SECRET = 'test-secret';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';
const REPORT_ID = '64b7f0c2a1b2c3d4e5f60720';

const user = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Diner', role: 'user' };
const admin = { _id: '64b7f0c2a1b2c3d4e5f60732', name: 'Admin', role: 'admin' };

// Logs `who` in: protect() looks the user up again, so User.findById returns them.
function loginAs(t, who) {
    t.mock.method(User, 'findById', () => ({ select: async () => who }));
    return { Cookie: `${AUTH_COOKIE}=${signToken(who)}` };
}

function send(url, method, headers, body) {
    return fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body && JSON.stringify(body)
    });
}

// A saved stall with a fake save()
function savedStall(t, fields) {
    const stall = {
        _id: STALL_ID,
        hawkerCentre: CENTRE_ID,
        name: 'Ah Hock Chicken Rice',
        isActive: true,
        pendingApproval: false,
        ...fields,
        save: t.mock.fn(async () => {}),
        toObject() { return { _id: this._id, name: this.name, isActive: this.isActive, pendingApproval: this.pendingApproval }; }
    };
    t.mock.method(Stall, 'findById', async () => stall);
    return stall;
}

async function addStallAs(t, who) {
    const headers = loginAs(t, who);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Stall, 'exists', async () => null);
    const create = t.mock.method(Stall, 'create', async (fields) => ({ toObject: () => ({ _id: STALL_ID, ...fields }) }));
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/stalls`, 'POST', headers, { name: 'Ah Hock' });
    return { response, body: await response.json(), fields: create.mock.calls[0].arguments[0] };
}


test('a stall added by a user waits for an admin to approve it', async (t) => {
    const { response, body, fields } = await addStallAs(t, user);

    assert.equal(response.status, 201);
    assert.equal(fields.pendingApproval, true);
    assert.equal(body.data.pendingApproval, true); // so the page can say it is waiting for approval
});

test('a stall added by an admin is listed straight away', async (t) => {
    const { fields } = await addStallAs(t, admin);
    assert.equal(fields.pendingApproval, false);
});

test('stall lists and centre stall counts leave out stalls waiting for approval', async (t) => {
    const find = t.mock.method(Stall, 'find', () => ({ populate() { return this; }, sort() { return this; }, lean: async () => [] }));
    t.mock.method(Review, 'aggregate', async () => []);
    const base = await startServer(t);

    await fetch(`${base}/api/stalls`);

    assert.deepEqual(find.mock.calls[0].arguments[0], { isActive: true, pendingApproval: { $ne: true } });
});

test('GET /api/stalls/:id gives 404 for a stall waiting for approval', async (t) => {
    t.mock.method(Stall, 'findById', () => ({
        populate() { return this; },
        lean: async () => ({ _id: STALL_ID, name: 'New', isActive: true, pendingApproval: true })
    }));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/stalls/${STALL_ID}`);
    assert.equal(response.status, 404);
});

test('every admin route needs an admin', async (t) => {
    const base = await startServer(t);
    const routes = [
        ['GET', '/api/admin/overview'],
        ['GET', '/api/admin/stalls'],
        ['POST', `/api/admin/stalls/${STALL_ID}/approve`],
        ['POST', `/api/admin/stalls/${STALL_ID}/reject`],
        ['POST', `/api/admin/stalls/${STALL_ID}/restore`],
        ['GET', '/api/admin/reports'],
        ['DELETE', `/api/reports/${REPORT_ID}`]
    ];

    for (const [method, path] of routes) {
        assert.equal((await send(`${base}${path}`, method, {})).status, 401, `${method} ${path} logged out`);
    }
    const headers = loginAs(t, user);
    for (const [method, path] of routes) {
        assert.equal((await send(`${base}${path}`, method, headers)).status, 403, `${method} ${path} as a user`);
    }
});

test('GET /api/admin/stalls lists the pending stalls by default, and refuses an unknown status', async (t) => {
    const headers = loginAs(t, admin);
    const find = t.mock.method(Stall, 'find', () => ({
        populate() { return this; },
        sort() { return this; },
        limit() { return this; },
        lean: async () => [{ _id: STALL_ID, name: 'New' }]
    }));
    const base = await startServer(t);

    const body = await (await send(`${base}/api/admin/stalls`, 'GET', headers)).json();
    assert.equal(body.data.length, 1);
    assert.deepEqual(find.mock.calls[0].arguments[0], { isActive: true, pendingApproval: true });

    await send(`${base}/api/admin/stalls?status=removed&search=hock`, 'GET', headers);
    const filter = find.mock.calls[1].arguments[0];
    assert.equal(filter.isActive, false);
    assert.ok(filter.$or[0].name.test('Ah Hock'));

    assert.equal((await send(`${base}/api/admin/stalls?status=everything`, 'GET', headers)).status, 400);
});

test('POST /api/admin/stalls/:id/approve lists a pending stall', async (t) => {
    const headers = loginAs(t, admin);
    const stall = savedStall(t, { pendingApproval: true });
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/stalls/${STALL_ID}/approve`, 'POST', headers);

    assert.equal(response.status, 200);
    assert.equal(stall.pendingApproval, false);
    assert.equal(stall.save.mock.callCount(), 1);
});

test('POST /api/admin/stalls/:id/approve gives 404 for a stall that is already listed', async (t) => {
    const headers = loginAs(t, admin);
    const stall = savedStall(t, { pendingApproval: false });
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/stalls/${STALL_ID}/approve`, 'POST', headers);

    assert.equal(response.status, 404);
    assert.equal(stall.save.mock.callCount(), 0);
});

test('POST /api/admin/stalls/:id/reject only deletes a stall that is waiting for approval', async (t) => {
    const headers = loginAs(t, admin);
    const remove = t.mock.method(Stall, 'findOneAndDelete', async () => ({ _id: STALL_ID }));
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/stalls/${STALL_ID}/reject`, 'POST', headers);

    assert.equal(response.status, 200);
    assert.deepEqual(remove.mock.calls[0].arguments[0], { _id: STALL_ID, isActive: true, pendingApproval: true });
});

test('POST /api/admin/stalls/:id/restore brings back a removed stall unless its name is taken', async (t) => {
    await t.test('restored', async (t) => {
        const headers = loginAs(t, admin);
        const stall = savedStall(t, { isActive: false });
        t.mock.method(Stall, 'exists', async () => null);
        const base = await startServer(t);

        const response = await send(`${base}/api/admin/stalls/${STALL_ID}/restore`, 'POST', headers);

        assert.equal(response.status, 200);
        assert.equal(stall.isActive, true);
    });

    await t.test('name taken', async (t) => {
        const headers = loginAs(t, admin);
        const stall = savedStall(t, { isActive: false });
        t.mock.method(Stall, 'exists', async () => ({ _id: 'another-stall' }));
        const base = await startServer(t);

        const response = await send(`${base}/api/admin/stalls/${STALL_ID}/restore`, 'POST', headers);

        assert.equal(response.status, 409);
        assert.equal(stall.save.mock.callCount(), 0);
    });
});

test('GET /api/admin/reports says who sent each report and how many flagged it', async (t) => {
    const headers = loginAs(t, admin);
    const now = Date.now();
    const find = t.mock.method(StatusReport, 'find', () => ({
        sort() { return this; },
        limit() { return this; },
        populate() { return this; },
        lean: async () => [{
            _id: REPORT_ID,
            status: 'LONG_QUEUE',
            user: { _id: user._id, name: 'Diner', email: 'diner@example.com' },
            flaggedBy: ['a', 'b', 'c'],
            createdAt: new Date(now - 60 * 1000),
            expiresAt: new Date(now + 60 * 1000)
        }]
    }));
    const base = await startServer(t);

    const body = await (await send(`${base}/api/admin/reports?flagged=true`, 'GET', headers)).json();

    assert.deepEqual(find.mock.calls[0].arguments[0], { 'flaggedBy.0': { $exists: true } });
    const [report] = body.data.reports;
    assert.equal(report.user.email, 'diner@example.com');
    assert.equal(report.flagCount, 3);
    assert.equal(report.hidden, true);
    assert.equal(report.live, false);
    assert.equal(report.flaggedBy, undefined); // only the count is sent
});

test('DELETE /api/reports/:id lets an admin delete a report', async (t) => {
    const headers = loginAs(t, admin);
    const remove = t.mock.method(StatusReport, 'findByIdAndDelete', async () => ({ _id: REPORT_ID }));
    const base = await startServer(t);

    const response = await send(`${base}/api/reports/${REPORT_ID}`, 'DELETE', headers);

    assert.equal(response.status, 200);
    assert.equal(remove.mock.calls[0].arguments[0], REPORT_ID);
});

test('DELETE /api/reports/:id gives 404 for a missing report and 400 for a bad id', async (t) => {
    const headers = loginAs(t, admin);
    t.mock.method(StatusReport, 'findByIdAndDelete', async () => null);
    const base = await startServer(t);

    assert.equal((await send(`${base}/api/reports/${REPORT_ID}`, 'DELETE', headers)).status, 404);
    assert.equal((await send(`${base}/api/reports/not-an-id`, 'DELETE', headers)).status, 400);
});
