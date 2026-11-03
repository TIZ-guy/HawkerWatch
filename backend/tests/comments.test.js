// Calls the real comment routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './startServer.js';
import Comment from '../models/Comment.js';
import HawkerCentre from '../models/HawkerCentre.js';
import User from '../models/User.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';
import { COMMENT_MAX_LENGTH } from '../utils/constants.js';

process.env.JWT_SECRET = 'test-secret';

const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
const COMMENT_ID = '64b7f0c2a1b2c3d4e5f60721';

const author = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Author', role: 'user' };
const otherUser = { _id: '64b7f0c2a1b2c3d4e5f60731', name: 'Someone Else', role: 'user' };
const admin = { _id: '64b7f0c2a1b2c3d4e5f60732', name: 'Admin', role: 'admin' };

// A stand-in for a mongoose query: chaining methods return itself and awaiting gives the result.
function fakeQuery(result) {
    return {
        sort() { return this; },
        populate() { return this; },
        lean() { return this; },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
}

// Logs `user` in: protect() looks the user up again, so User.findById returns them.
function loginAs(t, user) {
    t.mock.method(User, 'findById', () => ({ select: async () => user }));
    return { Cookie: `${AUTH_COOKIE}=${signToken(user)}` };
}

// A saved comment by `author`, with fake save() and deleteOne() that record being called.
function savedComment(t) {
    const comment = {
        _id: COMMENT_ID,
        hawkerCentre: CENTRE_ID,
        user: author._id,
        text: 'Old text',
        createdAt: new Date('2026-10-01T04:00:00Z'),
        updatedAt: new Date('2026-10-01T04:00:00Z'),
        save: t.mock.fn(async () => {}),
        deleteOne: t.mock.fn(async () => {})
    };
    t.mock.method(Comment, 'findById', async () => comment);
    return comment;
}

const send = (url, method, headers, body) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body && JSON.stringify(body)
});


test('GET /api/hawker-centres/:id/comments returns comments with the author\'s name only', async (t) => {
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Comment, 'find', () => fakeQuery([
        { _id: COMMENT_ID, text: 'Go early', user: { _id: author._id, name: 'Author', email: 'secret@example.com' } },
        { _id: '64b7f0c2a1b2c3d4e5f60722', text: 'Nice', user: null }
    ]));

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/hawker-centres/${CENTRE_ID}/comments`)).json();

    assert.equal(body.success, true);
    assert.deepEqual(body.data[0].user, { _id: author._id, name: 'Author' });
    assert.equal(body.data[1].user, null); // the author's account was deleted
});

test('GET /api/hawker-centres/:id/comments gives 404 when the centre is missing', async (t) => {
    t.mock.method(HawkerCentre, 'exists', async () => null);
    const base = await startServer(t);

    const response = await fetch(`${base}/api/hawker-centres/${CENTRE_ID}/comments`);
    assert.equal(response.status, 404);
});

test('POST /api/hawker-centres/:id/comments needs a login', async (t) => {
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/comments`, 'POST', {}, { text: 'Hello' });
    assert.equal(response.status, 401);
});

test('POST /api/hawker-centres/:id/comments rejects empty, too long or non-text comments', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    const create = t.mock.method(Comment, 'create', async () => ({}));
    const base = await startServer(t);
    const url = `${base}/api/hawker-centres/${CENTRE_ID}/comments`;

    for (const text of ['   ', 'x'.repeat(COMMENT_MAX_LENGTH + 1), { $ne: '' }, undefined]) {
        const response = await send(url, 'POST', headers, { text });
        assert.equal(response.status, 400);
    }
    assert.equal(create.mock.callCount(), 0);
});

test('POST /api/hawker-centres/:id/comments saves trimmed text as the logged-in user', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    const create = t.mock.method(Comment, 'create', async (fields) => ({ _id: COMMENT_ID, ...fields }));
    const base = await startServer(t);

    const response = await send(`${base}/api/hawker-centres/${CENTRE_ID}/comments`, 'POST', headers, { text: '  Go early  ' });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(create.mock.calls[0].arguments[0].text, 'Go early');
    assert.equal(String(create.mock.calls[0].arguments[0].user), author._id);
    assert.deepEqual(body.data.user, { _id: author._id, name: 'Author' });
});

test('PATCH /api/comments/:id lets the author edit their comment', async (t) => {
    const headers = loginAs(t, author);
    const comment = savedComment(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/comments/${COMMENT_ID}`, 'PATCH', headers, { text: 'New text' });

    assert.equal(response.status, 200);
    assert.equal(comment.text, 'New text');
    assert.equal(comment.save.mock.callCount(), 1);
});

test('PATCH /api/comments/:id refuses someone else\'s comment, even for an admin', async (t) => {
    for (const user of [otherUser, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const comment = savedComment(t);
            const base = await startServer(t);

            const response = await send(`${base}/api/comments/${COMMENT_ID}`, 'PATCH', headers, { text: 'Hacked' });

            assert.equal(response.status, 403);
            assert.equal(comment.text, 'Old text');
            assert.equal(comment.save.mock.callCount(), 0);
        });
    }
});

test('DELETE /api/comments/:id works for the author and for an admin', async (t) => {
    for (const user of [author, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const comment = savedComment(t);
            const base = await startServer(t);

            const response = await send(`${base}/api/comments/${COMMENT_ID}`, 'DELETE', headers);

            assert.equal(response.status, 200);
            assert.equal(comment.deleteOne.mock.callCount(), 1);
        });
    }
});

test('DELETE /api/comments/:id refuses another user\'s comment', async (t) => {
    const headers = loginAs(t, otherUser);
    const comment = savedComment(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/comments/${COMMENT_ID}`, 'DELETE', headers);

    assert.equal(response.status, 403);
    assert.equal(comment.deleteOne.mock.callCount(), 0);
});

test('PATCH and DELETE /api/comments/:id give 404 when the comment is missing', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Comment, 'findById', async () => null);
    const base = await startServer(t);

    const edit = await send(`${base}/api/comments/${COMMENT_ID}`, 'PATCH', headers, { text: 'New text' });
    const remove = await send(`${base}/api/comments/${COMMENT_ID}`, 'DELETE', headers);

    assert.equal(edit.status, 404);
    assert.equal(remove.status, 404);
});
