// Stall approvals and the admin page's routes, called over HTTP. The database calls are replaced
// with fakes, so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './startServer.js';
import HawkerCentre from '../models/HawkerCentre.js';
import Stall from '../models/Stall.js';
import StatusReport from '../models/StatusReport.js';
import FoodUpdate from '../models/FoodUpdate.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import AdminAction from '../models/AdminAction.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';
import { PERMANENT_BAN } from '../utils/banUtils.js';

process.env.JWT_SECRET = 'test-secret';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';
const REPORT_ID = '64b7f0c2a1b2c3d4e5f60720';

const user = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Diner', role: 'user' };
const admin = { _id: '64b7f0c2a1b2c3d4e5f60732', name: 'Admin', role: 'admin' };

// Logs `who` in: protect() looks the user up again, so User.findById returns them.
// Also replaces the activity log with a fake; t.log.mock.calls holds what was logged.
function loginAs(t, who) {
    t.mock.method(User, 'findById', () => ({ select: async () => who }));
    t.log = t.mock.method(AdminAction, 'create', async (fields) => fields);
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
    assert.deepEqual(
        { action: t.log.mock.calls[0].arguments[0].action, admin: t.log.mock.calls[0].arguments[0].admin },
        { action: 'stall.approve', admin: admin._id }
    );
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
    const remove = t.mock.method(StatusReport, 'findByIdAndDelete', () => ({
        populate: async () => ({ _id: REPORT_ID, status: 'LONG_QUEUE', stall: { name: 'Ah Hock' }, user: user._id })
    }));
    const base = await startServer(t);

    const response = await send(`${base}/api/reports/${REPORT_ID}`, 'DELETE', headers);

    assert.equal(response.status, 200);
    assert.equal(remove.mock.calls[0].arguments[0], REPORT_ID);
    assert.equal(t.log.mock.calls[0].arguments[0].summary, 'Deleted a long queue report on "Ah Hock"');
});

test('DELETE /api/reports/:id gives 404 for a missing report and 400 for a bad id', async (t) => {
    const headers = loginAs(t, admin);
    t.mock.method(StatusReport, 'findByIdAndDelete', () => ({ populate: async () => null }));
    const base = await startServer(t);

    assert.equal((await send(`${base}/api/reports/${REPORT_ID}`, 'DELETE', headers)).status, 404);
    assert.equal((await send(`${base}/api/reports/not-an-id`, 'DELETE', headers)).status, 400);
});


// ---------- Users: bans and roles ----------

const TARGET_ID = '64b7f0c2a1b2c3d4e5f60740';

// A user the admin acts on. User.findById returns it for TARGET_ID, and the logged-in user otherwise.
function targetUser(t, who, fields) {
    const target = {
        _id: TARGET_ID,
        name: 'Spammer',
        email: 'spam@example.com',
        role: 'user',
        bannedUntil: null,
        banReason: '',
        ...fields,
        save: t.mock.fn(async () => {}),
        toJSON() { return { _id: this._id, name: this.name, role: this.role, bannedUntil: this.bannedUntil, banReason: this.banReason }; }
    };
    // protect() calls findById(id).select(...); the admin routes await findById(id) directly
    t.mock.method(User, 'findById', (id) => {
        const found = String(id) === TARGET_ID ? target : who;
        return { select: async () => found, then: (resolve, reject) => Promise.resolve(found).then(resolve, reject) };
    });
    return target;
}

test('a banned user can still log in but cannot post, and is told why and until when', async (t) => {
    const banned = { ...user, bannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), banReason: 'Fake reports' };
    const headers = loginAs(t, banned);
    const create = t.mock.method(Comment, 'create', async () => ({}));
    const base = await startServer(t);

    const posts = [
        ['/api/reports', { stallId: STALL_ID, status: 'OPEN' }],
        [`/api/hawker-centres/${CENTRE_ID}/comments`, { text: 'Hello' }],
        [`/api/hawker-centres/${CENTRE_ID}/stalls`, { name: 'Ah Hock' }],
        [`/api/stalls/${STALL_ID}/reviews`, { rating: 1 }],
        ['/api/food-updates', { stallId: STALL_ID, type: 'SOLD_OUT' }]
    ];
    for (const [path, body] of posts) {
        const response = await send(`${base}${path}`, 'POST', headers, body);
        assert.equal(response.status, 403, path);
        assert.match((await response.json()).message, /suspended from posting until .*Reason: Fake reports/);
    }
    assert.equal(create.mock.callCount(), 0);
});

test('a ban that has ended no longer stops the user posting', async (t) => {
    const headers = loginAs(t, { ...user, bannedUntil: new Date(Date.now() - 1000) });
    const base = await startServer(t);

    // Gets past the ban check to the normal checks (a missing stall id gives 400, not 403)
    const response = await send(`${base}/api/reports`, 'POST', headers, { status: 'OPEN' });
    assert.equal(response.status, 400);
});

test('POST /api/admin/users/:id/ban suspends for a number of days, or bans for good with days null', async (t) => {
    await t.test('7 days', async (t) => {
        const headers = loginAs(t, admin);
        const target = targetUser(t, admin);
        const base = await startServer(t);

        const response = await send(`${base}/api/admin/users/${TARGET_ID}/ban`, 'POST', headers, { days: 7, reason: ' Fake reports ' });

        assert.equal(response.status, 200);
        const days = (target.bannedUntil - Date.now()) / (24 * 60 * 60 * 1000);
        assert.ok(days > 6.99 && days <= 7);
        assert.equal(target.banReason, 'Fake reports');
        assert.equal(t.log.mock.calls[0].arguments[0].summary, 'Suspended Spammer (spam@example.com) for 7 days: Fake reports');
    });

    await t.test('permanent', async (t) => {
        const headers = loginAs(t, admin);
        const target = targetUser(t, admin);
        const base = await startServer(t);

        const response = await send(`${base}/api/admin/users/${TARGET_ID}/ban`, 'POST', headers, { days: null });

        assert.equal(response.status, 200);
        assert.deepEqual(target.bannedUntil, PERMANENT_BAN);
        assert.equal((await response.json()).data.permanentBan, true);
    });
});

test('POST /api/admin/users/:id/ban refuses bad days, an admin, and yourself', async (t) => {
    const headers = loginAs(t, admin);
    const target = targetUser(t, admin, { role: 'admin' });
    const base = await startServer(t);

    for (const days of [0, 1.5, 366, '7']) {
        assert.equal((await send(`${base}/api/admin/users/${TARGET_ID}/ban`, 'POST', headers, { days })).status, 400, `days ${days}`);
    }
    const adminResponse = await send(`${base}/api/admin/users/${TARGET_ID}/ban`, 'POST', headers, { days: 7 });
    assert.match((await adminResponse.json()).message, /Remove their admin role first/);
    assert.equal((await send(`${base}/api/admin/users/${admin._id}/ban`, 'POST', headers, { days: 7 })).status, 400);
    assert.equal(target.save.mock.callCount(), 0);
});

test('POST /api/admin/users/:id/unban lifts a ban', async (t) => {
    const headers = loginAs(t, admin);
    const target = targetUser(t, admin, { bannedUntil: PERMANENT_BAN, banReason: 'Spam' });
    const base = await startServer(t);

    const response = await send(`${base}/api/admin/users/${TARGET_ID}/unban`, 'POST', headers);

    assert.equal(response.status, 200);
    assert.equal(target.bannedUntil, null);
    assert.equal(target.banReason, '');
    assert.equal(t.log.mock.calls[0].arguments[0].action, 'user.unban');
});

test('PATCH /api/admin/users/:id/role makes a user an admin (lifting any ban), but not your own role', async (t) => {
    const headers = loginAs(t, admin);
    const target = targetUser(t, admin, { bannedUntil: PERMANENT_BAN });
    const base = await startServer(t);

    assert.equal((await send(`${base}/api/admin/users/${TARGET_ID}/role`, 'PATCH', headers, { role: 'owner' })).status, 400);
    assert.equal((await send(`${base}/api/admin/users/${admin._id}/role`, 'PATCH', headers, { role: 'user' })).status, 400);

    const response = await send(`${base}/api/admin/users/${TARGET_ID}/role`, 'PATCH', headers, { role: 'admin' });

    assert.equal(response.status, 200);
    assert.equal(target.role, 'admin');
    assert.equal(target.bannedUntil, null);
    assert.equal(t.log.mock.calls[0].arguments[0].summary, 'Made Spammer (spam@example.com) an admin');
});

test('GET /api/admin/users shows who is banned and how much each user has posted', async (t) => {
    const headers = loginAs(t, admin);
    const find = t.mock.method(User, 'find', () => ({
        select() { return this; },
        sort() { return this; },
        limit() { return this; },
        lean: async () => [{ _id: TARGET_ID, name: 'Spammer', role: 'user', bannedUntil: PERMANENT_BAN }]
    }));
    t.mock.method(StatusReport, 'aggregate', async () => [{ _id: TARGET_ID, count: 40 }]);
    t.mock.method(Review, 'aggregate', async () => []);
    t.mock.method(Comment, 'aggregate', async () => [{ _id: TARGET_ID, count: 2 }]);
    const base = await startServer(t);

    const body = await (await send(`${base}/api/admin/users?filter=banned&search=spam`, 'GET', headers)).json();

    const filter = find.mock.calls[0].arguments[0];
    assert.ok(filter.bannedUntil.$gt instanceof Date);
    assert.ok(filter.$or[1].email.test('spam@example.com'));
    assert.deepEqual(body.data[0].posts, { reports: 40, reviews: 0, comments: 2 });
    assert.equal(body.data[0].banned, true);
    assert.equal(body.data[0].permanentBan, true);
});


// ---------- Moderation and the activity log ----------

test('DELETE /api/food-updates/:id is for admins, and is logged', async (t) => {
    await t.test('a normal user gets 403', async (t) => {
        const headers = loginAs(t, user);
        const base = await startServer(t);
        assert.equal((await send(`${base}/api/food-updates/${REPORT_ID}`, 'DELETE', headers)).status, 403);
    });

    await t.test('an admin deletes it', async (t) => {
        const headers = loginAs(t, admin);
        t.mock.method(FoodUpdate, 'findByIdAndDelete', () => ({
            populate: async () => ({ _id: REPORT_ID, type: 'SOLD_OUT', note: 'All gone', stall: { name: 'Ah Hock' }, user: user._id })
        }));
        const base = await startServer(t);

        const response = await send(`${base}/api/food-updates/${REPORT_ID}`, 'DELETE', headers);

        assert.equal(response.status, 200);
        const entry = t.log.mock.calls[0].arguments[0];
        assert.equal(entry.summary, 'Deleted a sold out food update on "Ah Hock": "All gone"');
        assert.equal(entry.subjectUser, user._id);
    });
});

test('GET /api/admin/activity lists the log newest first, with the admins named', async (t) => {
    const headers = loginAs(t, admin);
    const populated = [];
    t.mock.method(AdminAction, 'find', () => ({
        sort(order) { assert.deepEqual(order, { createdAt: -1 }); return this; },
        limit() { return this; },
        populate(path) { populated.push(path); return this; },
        lean: async () => [{ action: 'stall.approve', summary: 'Approved stall "Ah Hock"', admin: { name: 'Admin' } }]
    }));
    const base = await startServer(t);

    const body = await (await send(`${base}/api/admin/activity`, 'GET', headers)).json();

    assert.equal(body.data[0].summary, 'Approved stall "Ah Hock"');
    assert.deepEqual(populated, ['admin', 'subjectUser']);
});
