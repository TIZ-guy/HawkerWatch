import Review from '../models/Review.js';
import HawkerCentre from '../models/HawkerCentre.js';
import ReviewPhoto from '../models/ReviewPhoto.js';
import Stall from '../models/Stall.js';
import { REVIEW_TEXT_MAX_LENGTH, MAX_REVIEW_PHOTOS } from '../utils/constants.js';
import { detectImageType } from '../utils/photoUtils.js';
import { currentReviewFilter, expiredReviewFilter, reviewExpiresAt } from '../utils/reviewUtils.js';
import { LISTED_STALL } from '../utils/stallUtils.js';
import { logAdminAction, quote } from '../utils/adminLog.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.
// Routes that change reviews run Kia's `protect` first, so req.user is the logged-in user.


// Checks the rating and text sent in the request body.
// Returns { rating, text } when they are fine, or { message } explaining what is wrong.
// The text is optional; checking the types stops objects like { "$ne": "" } from being saved.
function checkReview(body) {
    const rating = body?.rating;
    let text = body?.text;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { message: 'Rating must be a whole number from 1 to 5.' };
    }

    if (text === undefined || text === null) {
        text = '';
    }
    if (typeof text !== 'string') {
        return { message: 'Review text must be text.' };
    }
    if (text.trim().length > REVIEW_TEXT_MAX_LENGTH) {
        return { message: `Reviews can be at most ${REVIEW_TEXT_MAX_LENGTH} characters.` };
    }

    return { rating: rating, text: text.trim() };
}

// What the frontend gets for each review. Only the author's id and name are sent, not their email.
// user is null when the author's account has been deleted.
function toPublicReview(review, user) {
    return {
        _id: review._id,
        stall: review.stall,
        rating: review.rating,
        text: review.text,
        photos: (review.photos || []).map(photoId => String(photoId)), // ids; images are at /api/review-photos/:id
        createdAt: review.createdAt,
        editedAt: review.editedAt || null, // when the stars or text were last changed, or null
        expiresAt: reviewExpiresAt(review), // 3 months after it was posted or last edited
        user: user ? { _id: user._id, name: user.name } : null
    };
}

function isAuthor(review, user) {
    return String(review.user) === String(user._id);
}


// ============================================================
// GET /api/hawker-centres/:id/reviews
// The newest current reviews across all of a centre's stalls (at most 20), each with its stall's
// name. Used by the centre page's Reviews tab and photo strip. { count, reviews }
// ============================================================

const CENTRE_REVIEWS_LIMIT = 20;

export const getCentreReviews = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await HawkerCentre.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const stalls = await Stall.find({ hawkerCentre: id, ...LISTED_STALL }).select('name').lean();
        const stallNames = {};
        for (const stall of stalls) {
            stallNames[String(stall._id)] = stall.name;
        }

        const reviews = await Review
            .find({ stall: { $in: stalls.map(stall => stall._id) }, ...currentReviewFilter() })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(CENTRE_REVIEWS_LIMIT)
            .lean();

        const publicReviews = [];
        for (const review of reviews) {
            publicReviews.push({
                ...toPublicReview(review, review.user),
                stall: { _id: review.stall, name: stallNames[String(review.stall)] }
            });
        }

        res.status(200).json({ success: true, data: { count: publicReviews.length, reviews: publicReviews } });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/stalls/:id/reviews
// The stall's average rating, number of reviews, and the reviews newest first.
// Only current reviews count: expired ones (over 3 months since posted or edited) are left out.
// ============================================================

export const getStallReviews = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await Stall.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        const reviews = await Review
            .find({ stall: id, ...currentReviewFilter() })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Add up the ratings to work out the average
        let total = 0;
        for (const review of reviews) {
            total += review.rating;
        }
        const average = reviews.length ? Math.round((total / reviews.length) * 10) / 10 : null;

        const publicReviews = [];
        for (const review of reviews) {
            publicReviews.push(toPublicReview(review, review.user));
        }

        res.status(200).json({
            success: true,
            data: { average: average, count: reviews.length, reviews: publicReviews }
        });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/stalls/:id/reviews
// Login required. Body: { rating: 1-5, text (optional) }
// Each user has one current review per stall (409 if they already have; edit it instead).
// A review that has expired is replaced, since it is hidden and can't be edited from the page.
// ============================================================

export const addReview = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { rating, text, message } = checkReview(req.body);

        if (message) {
            res.status(400).json({ success: false, message: message });
            return;
        }

        if (!await Stall.exists({ _id: id, ...LISTED_STALL })) {
            res.status(404).json({ success: false, message: 'Stall not found.' });
            return;
        }

        if (await Review.exists({ stall: id, user: req.user._id, ...currentReviewFilter() })) {
            res.status(409).json({ success: false, message: 'You have already reviewed this stall. Edit your review instead.' });
            return;
        }

        // An expired review is hidden, so the user can't see it to edit it. Replace it (and its photos) instead.
        const expired = await Review.findOneAndDelete({ stall: id, user: req.user._id, ...expiredReviewFilter() });
        if (expired) {
            await ReviewPhoto.deleteMany({ review: expired._id });
        }

        const review = await Review.create({ stall: id, user: req.user._id, rating: rating, text: text });

        res.status(201).json({ success: true, data: toPublicReview(review, req.user) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// PATCH /api/reviews/:id
// Login required. Only the author can edit. Body: { rating: 1-5, text (optional) }
// ============================================================

export const updateReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            res.status(404).json({ success: false, message: 'Review not found.' });
            return;
        }
        if (!isAuthor(review, req.user)) {
            res.status(403).json({ success: false, message: 'You can only edit your own review.' });
            return;
        }

        const { rating, text, message } = checkReview(req.body);

        if (message) {
            res.status(400).json({ success: false, message: message });
            return;
        }

        // Only count it as edited if something actually changed
        if (review.rating !== rating || review.text !== text) {
            review.editedAt = new Date();
        }
        review.rating = rating;
        review.text = text;
        await review.save();

        res.status(200).json({ success: true, data: toPublicReview(review, req.user) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/reviews/:id/photos
// Login required. Only the author can add photos. multipart/form-data with the files in "photos".
// multer (reviewRoutes.js) has already read the files into req.files and checked their size and number.
// ============================================================

export const addReviewPhotos = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        const files = req.files || [];

        if (!review) {
            res.status(404).json({ success: false, message: 'Review not found.' });
            return;
        }
        if (!isAuthor(review, req.user)) {
            res.status(403).json({ success: false, message: 'You can only add photos to your own review.' });
            return;
        }
        if (files.length === 0) {
            res.status(400).json({ success: false, message: 'Choose at least one photo.' });
            return;
        }
        if (review.photos.length + files.length > MAX_REVIEW_PHOTOS) {
            res.status(400).json({ success: false, message: `A review can have at most ${MAX_REVIEW_PHOTOS} photos.` });
            return;
        }

        // Check every file is really an image before saving any of them
        const photos = [];
        for (const file of files) {
            const contentType = detectImageType(file.buffer);
            if (!contentType) {
                res.status(400).json({ success: false, message: 'Photos must be JPEG, PNG or WebP images.' });
                return;
            }
            photos.push({ review: review._id, stall: review.stall, contentType: contentType, data: file.buffer });
        }

        const saved = await ReviewPhoto.insertMany(photos);
        for (const photo of saved) {
            review.photos.push(photo._id);
        }
        await review.save();

        res.status(201).json({ success: true, data: toPublicReview(review, req.user) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// DELETE /api/reviews/:id/photos/:photoId
// Login required. The author or an admin can remove a photo.
// ============================================================

export const deleteReviewPhoto = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        const photoId = req.params.photoId;

        if (!review) {
            res.status(404).json({ success: false, message: 'Review not found.' });
            return;
        }
        if (!isAuthor(review, req.user) && req.user.role !== 'admin') {
            res.status(403).json({ success: false, message: 'You can only remove photos from your own review.' });
            return;
        }

        const remaining = review.photos.filter(id => String(id) !== photoId);
        if (remaining.length === review.photos.length) {
            res.status(404).json({ success: false, message: 'Photo not found on this review.' });
            return;
        }

        review.photos = remaining;
        await review.save();
        await ReviewPhoto.deleteOne({ _id: photoId, review: review._id });

        res.status(200).json({ success: true, data: { id: photoId } });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// GET /api/review-photos/:id
// The image itself (not JSON), so it can be used directly in <img src="...">.
// ============================================================

export const getReviewPhoto = async (req, res, next) => {
    try {
        const photo = await ReviewPhoto.findById(req.params.id).select('+data');

        if (!photo) {
            res.status(404).json({ success: false, message: 'Photo not found.' });
            return;
        }

        res.set('Content-Type', photo.contentType);
        // A photo never changes once uploaded, so browsers can keep it for a year
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        // The frontend and API are on different sites when deployed; this lets <img> load the photo there
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.status(200).send(photo.data);
    } catch (error) {
        next(error);
    }
};


// ============================================================
// DELETE /api/reviews/:id
// Login required. The author or an admin can delete.
// ============================================================

export const deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            res.status(404).json({ success: false, message: 'Review not found.' });
            return;
        }
        if (!isAuthor(review, req.user) && req.user.role !== 'admin') {
            res.status(403).json({ success: false, message: 'You can only delete your own review.' });
            return;
        }

        await ReviewPhoto.deleteMany({ review: review._id }); // the photos go with the review
        await review.deleteOne();

        // Admins deleting someone else's review goes in the admin activity log
        if (!isAuthor(review, req.user)) {
            const text = review.text ? `: ${quote(review.text)}` : '';
            await logAdminAction(req.user, 'review.delete', `Deleted a ${review.rating}-star review${text}`, {
                type: 'Review', id: review._id, user: review.user
            });
        }

        res.status(200).json({ success: true, data: { id: review._id } });
    } catch (error) {
        next(error);
    }
};
