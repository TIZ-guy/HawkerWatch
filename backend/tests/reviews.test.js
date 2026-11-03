// Calls the real review routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './startServer.js';
import Review from '../models/Review.js';
import ReviewPhoto from '../models/ReviewPhoto.js';
import Stall from '../models/Stall.js';
import HawkerCentre from '../models/HawkerCentre.js';
import User from '../models/User.js';
import AdminAction from '../models/AdminAction.js';
import { AUTH_COOKIE, signToken } from '../utils/authToken.js';
import { REVIEW_TEXT_MAX_LENGTH, MAX_PHOTO_BYTES } from '../utils/constants.js';
import { reviewExpiresAt } from '../utils/reviewUtils.js';
import { addReview } from '../controllers/reviewController.js';

process.env.JWT_SECRET = 'test-secret';

const STALL_ID = '64b7f0c2a1b2c3d4e5f60719';
const REVIEW_ID = '64b7f0c2a1b2c3d4e5f60721';

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

// A saved 3-star review by `author` with no photos, with fake save() and deleteOne() that record being called.
// Deleting a review also deletes its photos, so ReviewPhoto.deleteMany is faked too.
function savedReview(t) {
    const review = {
        _id: REVIEW_ID,
        stall: STALL_ID,
        user: author._id,
        rating: 3,
        text: 'Old text',
        photos: [],
        save: t.mock.fn(async () => {}),
        deleteOne: t.mock.fn(async () => {})
    };
    t.mock.method(Review, 'findById', async () => review);
    t.mock.method(ReviewPhoto, 'deleteMany', async () => ({}));
    return review;
}

// The first bytes of a PNG file, which is all the type check looks at
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

// Uploads `files` (Buffers) as multipart/form-data in the "photos" field, like the browser does
function uploadPhotos(url, headers, files) {
    const form = new FormData();
    for (const bytes of files) {
        form.append('photos', new Blob([bytes]), 'photo.png');
    }
    return fetch(url, { method: 'POST', headers: headers, body: form });
}

function send(url, method, headers, body) {
    return fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body && JSON.stringify(body)
    });
}


test('GET /api/stalls/:id/reviews returns the average, the count and the reviews', async (t) => {
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'find', () => fakeQuery([
        { _id: REVIEW_ID, rating: 5, text: 'Great', user: { _id: author._id, name: 'Author', email: 'secret@example.com' } },
        { _id: '64b7f0c2a1b2c3d4e5f60722', rating: 4, text: '', user: null }
    ]));

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/stalls/${STALL_ID}/reviews`)).json();

    assert.equal(body.data.average, 4.5);
    assert.equal(body.data.count, 2);
    assert.deepEqual(body.data.reviews[0].user, { _id: author._id, name: 'Author' }); // no email
    assert.equal(body.data.reviews[1].user, null); // the author's account was deleted
});

test('GET /api/stalls/:id/reviews gives a null average when there are no reviews', async (t) => {
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'find', () => fakeQuery([]));

    const base = await startServer(t);
    const body = await (await fetch(`${base}/api/stalls/${STALL_ID}/reviews`)).json();

    assert.deepEqual(body.data, { average: null, count: 0, reviews: [] });
});

test('GET /api/stalls/:id/reviews gives 404 when the stall is missing', async (t) => {
    t.mock.method(Stall, 'exists', async () => null);
    const base = await startServer(t);

    const response = await fetch(`${base}/api/stalls/${STALL_ID}/reviews`);
    assert.equal(response.status, 404);
});

test('POST /api/stalls/:id/reviews needs a login', async (t) => {
    const base = await startServer(t);

    const response = await send(`${base}/api/stalls/${STALL_ID}/reviews`, 'POST', {}, { rating: 4 });
    assert.equal(response.status, 401);
});

test('POST /api/stalls/:id/reviews rejects bad ratings and bad text', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'exists', async () => null);
    const create = t.mock.method(Review, 'create', async () => ({}));
    const base = await startServer(t);
    const url = `${base}/api/stalls/${STALL_ID}/reviews`;

    const badBodies = [
        {},
        { rating: 0 },
        { rating: 6 },
        { rating: 3.5 },
        { rating: '4' },
        { rating: 4, text: 'x'.repeat(REVIEW_TEXT_MAX_LENGTH + 1) },
        { rating: 4, text: { $ne: '' } }
    ];
    for (const body of badBodies) {
        const response = await send(url, 'POST', headers, body);
        assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.equal(create.mock.callCount(), 0);
});

test('POST /api/stalls/:id/reviews saves the rating and trimmed text as the logged-in user', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'exists', async () => null);
    t.mock.method(Review, 'findOneAndDelete', async () => null);
    const create = t.mock.method(Review, 'create', async (fields) => ({ _id: REVIEW_ID, ...fields }));
    const base = await startServer(t);

    const response = await send(`${base}/api/stalls/${STALL_ID}/reviews`, 'POST', headers, { rating: 4, text: '  Nice  ' });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(create.mock.calls[0].arguments[0].rating, 4);
    assert.equal(create.mock.calls[0].arguments[0].text, 'Nice');
    assert.equal(String(create.mock.calls[0].arguments[0].user), author._id);
    assert.deepEqual(body.data.user, { _id: author._id, name: 'Author' });
});

test('POST /api/stalls/:id/reviews allows a rating with no text', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'exists', async () => null);
    t.mock.method(Review, 'findOneAndDelete', async () => null);
    const create = t.mock.method(Review, 'create', async (fields) => ({ _id: REVIEW_ID, ...fields }));
    const base = await startServer(t);

    const response = await send(`${base}/api/stalls/${STALL_ID}/reviews`, 'POST', headers, { rating: 5 });

    assert.equal(response.status, 201);
    assert.equal(create.mock.calls[0].arguments[0].text, '');
});

test('POST /api/stalls/:id/reviews gives 409 when the user already reviewed the stall', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'exists', async () => ({ _id: REVIEW_ID }));
    const create = t.mock.method(Review, 'create', async () => ({}));
    const base = await startServer(t);

    const response = await send(`${base}/api/stalls/${STALL_ID}/reviews`, 'POST', headers, { rating: 4 });

    assert.equal(response.status, 409);
    assert.equal(create.mock.callCount(), 0);
});

test('PATCH /api/reviews/:id lets the author change the rating and text', async (t) => {
    const headers = loginAs(t, author);
    const review = savedReview(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/reviews/${REVIEW_ID}`, 'PATCH', headers, { rating: 5, text: 'New text' });

    assert.equal(response.status, 200);
    assert.equal(review.rating, 5);
    assert.equal(review.text, 'New text');
    assert.ok(review.editedAt instanceof Date); // shown as "edited"
    assert.equal(review.save.mock.callCount(), 1);
});

test('PATCH /api/reviews/:id with nothing changed does not mark the review as edited', async (t) => {
    const headers = loginAs(t, author);
    const review = savedReview(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/reviews/${REVIEW_ID}`, 'PATCH', headers, { rating: 3, text: 'Old text' });

    assert.equal(response.status, 200);
    assert.equal(review.editedAt, undefined);
});

test('PATCH /api/reviews/:id refuses someone else\'s review, even for an admin', async (t) => {
    for (const user of [otherUser, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const review = savedReview(t);
            const base = await startServer(t);

            const response = await send(`${base}/api/reviews/${REVIEW_ID}`, 'PATCH', headers, { rating: 1 });

            assert.equal(response.status, 403);
            assert.equal(review.rating, 3);
            assert.equal(review.save.mock.callCount(), 0);
        });
    }
});

test('DELETE /api/reviews/:id works for the author and for an admin', async (t) => {
    for (const user of [author, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const review = savedReview(t);
            const log = t.mock.method(AdminAction, 'create', async (fields) => fields);
            const base = await startServer(t);

            const response = await send(`${base}/api/reviews/${REVIEW_ID}`, 'DELETE', headers);

            assert.equal(response.status, 200);
            assert.equal(review.deleteOne.mock.callCount(), 1);
            // Only an admin deleting someone else's review goes in the activity log
            assert.equal(log.mock.callCount(), user === admin ? 1 : 0);
        });
    }
});

test('DELETE /api/reviews/:id refuses another user\'s review', async (t) => {
    const headers = loginAs(t, otherUser);
    const review = savedReview(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/reviews/${REVIEW_ID}`, 'DELETE', headers);

    assert.equal(response.status, 403);
    assert.equal(review.deleteOne.mock.callCount(), 0);
});

test('PATCH and DELETE /api/reviews/:id give 404 when the review is missing', async (t) => {
    const headers = loginAs(t, author);
    t.mock.method(Review, 'findById', async () => null);
    const base = await startServer(t);

    const edit = await send(`${base}/api/reviews/${REVIEW_ID}`, 'PATCH', headers, { rating: 4 });
    const remove = await send(`${base}/api/reviews/${REVIEW_ID}`, 'DELETE', headers);

    assert.equal(edit.status, 404);
    assert.equal(remove.status, 404);
});


test('DELETE /api/reviews/:id also deletes the review\'s photos', async (t) => {
    const headers = loginAs(t, author);
    savedReview(t);
    const base = await startServer(t);

    await send(`${base}/api/reviews/${REVIEW_ID}`, 'DELETE', headers);

    assert.equal(String(ReviewPhoto.deleteMany.mock.calls[0].arguments[0].review), REVIEW_ID);
});

test('POST /api/reviews/:id/photos saves the photos and adds them to the review', async (t) => {
    const headers = loginAs(t, author);
    const review = savedReview(t);
    const insertMany = t.mock.method(ReviewPhoto, 'insertMany', async (photos) =>
        photos.map((photo, index) => ({ _id: `64b7f0c2a1b2c3d4e5f6074${index}`, ...photo })));
    const base = await startServer(t);

    const response = await uploadPhotos(`${base}/api/reviews/${REVIEW_ID}/photos`, headers, [PNG_BYTES, PNG_BYTES]);
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(insertMany.mock.calls[0].arguments[0][0].contentType, 'image/png'); // worked out from the bytes
    assert.equal(review.photos.length, 2);
    assert.equal(review.save.mock.callCount(), 1);
    assert.deepEqual(body.data.photos, ['64b7f0c2a1b2c3d4e5f60740', '64b7f0c2a1b2c3d4e5f60741']);
});

test('POST /api/reviews/:id/photos refuses files that are not images', async (t) => {
    const headers = loginAs(t, author);
    savedReview(t);
    const insertMany = t.mock.method(ReviewPhoto, 'insertMany', async () => []);
    const base = await startServer(t);

    const notAnImage = Buffer.from('<script>alert(1)</script> pretending to be a picture');
    const response = await uploadPhotos(`${base}/api/reviews/${REVIEW_ID}/photos`, headers, [notAnImage]);

    assert.equal(response.status, 400);
    assert.equal(insertMany.mock.callCount(), 0);
});

test('POST /api/reviews/:id/photos refuses photos over the size limit', async (t) => {
    const headers = loginAs(t, author);
    savedReview(t);
    const base = await startServer(t);

    const tooBig = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_PHOTO_BYTES)]);
    const response = await uploadPhotos(`${base}/api/reviews/${REVIEW_ID}/photos`, headers, [tooBig]);

    assert.equal(response.status, 400);
    assert.match((await response.json()).message, /2 MB/);
});

test('POST /api/reviews/:id/photos refuses more than 4 photos on one review', async (t) => {
    const headers = loginAs(t, author);
    const review = savedReview(t);
    review.photos = ['64b7f0c2a1b2c3d4e5f60750', '64b7f0c2a1b2c3d4e5f60751', '64b7f0c2a1b2c3d4e5f60752'];
    const insertMany = t.mock.method(ReviewPhoto, 'insertMany', async () => []);
    const base = await startServer(t);

    const response = await uploadPhotos(`${base}/api/reviews/${REVIEW_ID}/photos`, headers, [PNG_BYTES, PNG_BYTES]);

    assert.equal(response.status, 400);
    assert.equal(insertMany.mock.callCount(), 0);
});

test('POST /api/reviews/:id/photos is only for the review\'s author', async (t) => {
    const headers = loginAs(t, otherUser);
    savedReview(t);
    const base = await startServer(t);

    const response = await uploadPhotos(`${base}/api/reviews/${REVIEW_ID}/photos`, headers, [PNG_BYTES]);
    assert.equal(response.status, 403);
});

test('DELETE /api/reviews/:id/photos/:photoId removes the photo for the author and for an admin', async (t) => {
    const PHOTO_ID = '64b7f0c2a1b2c3d4e5f60750';
    for (const user of [author, admin]) {
        await t.test(user.name, async (t) => {
            const headers = loginAs(t, user);
            const review = savedReview(t);
            review.photos = [PHOTO_ID];
            const deleteOne = t.mock.method(ReviewPhoto, 'deleteOne', async () => ({}));
            const base = await startServer(t);

            const response = await send(`${base}/api/reviews/${REVIEW_ID}/photos/${PHOTO_ID}`, 'DELETE', headers);

            assert.equal(response.status, 200);
            assert.deepEqual(review.photos, []);
            assert.equal(deleteOne.mock.callCount(), 1);
        });
    }
});

test('DELETE /api/reviews/:id/photos/:photoId gives 404 for a photo that is not on the review', async (t) => {
    const headers = loginAs(t, author);
    savedReview(t);
    const base = await startServer(t);

    const response = await send(`${base}/api/reviews/${REVIEW_ID}/photos/64b7f0c2a1b2c3d4e5f60799`, 'DELETE', headers);
    assert.equal(response.status, 404);
});

test('GET /api/review-photos/:id sends the image with its type, and lets other sites show it', async (t) => {
    t.mock.method(ReviewPhoto, 'findById', () => ({
        select: async () => ({ contentType: 'image/png', data: PNG_BYTES })
    }));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/review-photos/64b7f0c2a1b2c3d4e5f60750`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG_BYTES);
});

test('GET /api/review-photos/:id gives 404 when the photo is missing', async (t) => {
    t.mock.method(ReviewPhoto, 'findById', () => ({ select: async () => null }));
    const base = await startServer(t);

    const response = await fetch(`${base}/api/review-photos/64b7f0c2a1b2c3d4e5f60750`);
    assert.equal(response.status, 404);
});

const DAY = 24 * 60 * 60 * 1000;

test('GET /api/stalls/:id/reviews only asks for reviews posted or edited in the last 3 months', async (t) => {
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    const find = t.mock.method(Review, 'find', () => fakeQuery([]));
    const base = await startServer(t);

    await fetch(`${base}/api/stalls/${STALL_ID}/reviews`);

    const filter = find.mock.calls[0].arguments[0];
    const cutoff = filter.$or[0].createdAt.$gt;
    assert.deepEqual(filter.$or[1], { editedAt: { $gt: cutoff } });
    const daysAgo = (Date.now() - cutoff.getTime()) / DAY;
    assert.ok(daysAgo > 89.9 && daysAgo < 90.1, `cutoff is ${daysAgo} days ago`);
});

// Calls addReview directly: the HTTP tests above already use up the review rate limit for this test run.
test('addReview replaces the user\'s expired review and its photos', async (t) => {
    t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }));
    t.mock.method(Review, 'exists', async () => null); // no current review
    const findOneAndDelete = t.mock.method(Review, 'findOneAndDelete', async () => ({ _id: 'expired-review' }));
    const deletePhotos = t.mock.method(ReviewPhoto, 'deleteMany', async () => ({}));
    const create = t.mock.method(Review, 'create', async (fields) => ({ _id: REVIEW_ID, ...fields }));
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

    await addReview({ params: { id: STALL_ID }, body: { rating: 2 }, user: author }, res, (error) => { throw error; });

    assert.equal(res.statusCode, 201);
    assert.ok(findOneAndDelete.mock.calls[0].arguments[0].createdAt.$lte instanceof Date);
    assert.deepEqual(deletePhotos.mock.calls[0].arguments[0], { review: 'expired-review' });
    assert.equal(create.mock.calls[0].arguments[0].rating, 2);
});

test('reviewExpiresAt is 90 days after the last edit, or after posting if never edited', () => {
    const posted = new Date('2026-01-01T00:00:00Z');
    const edited = new Date('2026-02-01T00:00:00Z');
    assert.equal(reviewExpiresAt({ createdAt: posted, editedAt: null }).toISOString(), '2026-04-01T00:00:00.000Z');
    assert.equal(reviewExpiresAt({ createdAt: posted, editedAt: edited }).toISOString(), '2026-05-02T00:00:00.000Z');
});


test('GET /api/hawker-centres/:id/reviews lists the newest reviews across the centre, with stall names', async (t) => {
    const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718';
    t.mock.method(HawkerCentre, 'exists', async () => ({ _id: CENTRE_ID }));
    t.mock.method(Stall, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: STALL_ID, name: 'Hock Lam Chicken Rice' }] }));
    const find = t.mock.method(Review, 'find', () => ({
        populate() { return this; },
        sort() { return this; },
        limit() { return this; },
        lean: async () => [{ _id: REVIEW_ID, stall: STALL_ID, rating: 5, text: 'Great', photos: ['64b7f0c2a1b2c3d4e5f60740'], user: { _id: author._id, name: 'Author' } }]
    }));
    const base = await startServer(t);

    const body = await (await fetch(`${base}/api/hawker-centres/${CENTRE_ID}/reviews`)).json();

    assert.equal(body.data.count, 1);
    assert.deepEqual(body.data.reviews[0].stall, { _id: STALL_ID, name: 'Hock Lam Chicken Rice' });
    assert.deepEqual(body.data.reviews[0].photos, ['64b7f0c2a1b2c3d4e5f60740']);
    assert.deepEqual(body.data.reviews[0].user, { _id: author._id, name: 'Author' });
    // Only reviews of that centre's stalls
    assert.deepEqual(find.mock.calls[0].arguments[0].stall.$in, [STALL_ID]);
});

test('GET /api/hawker-centres/:id/reviews gives 404 when the centre is missing', async (t) => {
    t.mock.method(HawkerCentre, 'exists', async () => null);
    const base = await startServer(t);

    const response = await fetch(`${base}/api/hawker-centres/64b7f0c2a1b2c3d4e5f60718/reviews`);
    assert.equal(response.status, 404);
});
