import Comment from '../models/Comment.js';
import HawkerCentre from '../models/HawkerCentre.js';
import { COMMENT_MAX_LENGTH } from '../utils/constants.js';
import { logAdminAction, quote } from '../utils/adminLog.js';

// Every response is { success: true, data } or { success: false, message }.
// Errors are passed to next(error) so errorMiddleware.js builds the error response.
// Routes that change comments run Kia's `protect` first, so req.user is the logged-in user.


// Returns the trimmed text, or an error message when the text can't be used.
// Checking the type stops objects like { "$ne": "" } from being saved.
function checkText(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return { message: 'Comment text is required.' };
    }
    if (text.trim().length > COMMENT_MAX_LENGTH) {
        return { message: `Comments can be at most ${COMMENT_MAX_LENGTH} characters.` };
    }
    return { text: text.trim() };
}

// What the frontend gets for each comment. Only the author's id and name are sent, not their email.
// user is null when the author's account has been deleted.
function toPublicComment(comment, user = comment.user) {
    return {
        _id: comment._id,
        hawkerCentre: comment.hawkerCentre,
        text: comment.text,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: user ? { _id: user._id, name: user.name } : null
    };
}

const isAuthor = (comment, user) => String(comment.user) === String(user._id);


// ============================================================
// GET /api/hawker-centres/:id/comments
// Newest first, each with the author's name.
// ============================================================

export const getCentreComments = async (req, res, next) => {
    try {
        const id = req.params.id;

        if (!await HawkerCentre.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const comments = await Comment
            .find({ hawkerCentre: id })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: comments.map((comment) => toPublicComment(comment)) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// POST /api/hawker-centres/:id/comments
// Login required. Body: { text }
// ============================================================

export const addComment = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { text, message } = checkText(req.body?.text);

        if (message) {
            res.status(400).json({ success: false, message });
            return;
        }

        if (!await HawkerCentre.exists({ _id: id })) {
            res.status(404).json({ success: false, message: 'Hawker centre not found.' });
            return;
        }

        const comment = await Comment.create({ hawkerCentre: id, user: req.user._id, text });

        res.status(201).json({ success: true, data: toPublicComment(comment, req.user) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// PATCH /api/comments/:id
// Login required. Only the author can edit. Body: { text }
// ============================================================

export const updateComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            res.status(404).json({ success: false, message: 'Comment not found.' });
            return;
        }
        if (!isAuthor(comment, req.user)) {
            res.status(403).json({ success: false, message: 'You can only edit your own comments.' });
            return;
        }

        const { text, message } = checkText(req.body?.text);

        if (message) {
            res.status(400).json({ success: false, message });
            return;
        }

        comment.text = text;
        await comment.save();

        res.status(200).json({ success: true, data: toPublicComment(comment, req.user) });
    } catch (error) {
        next(error);
    }
};


// ============================================================
// DELETE /api/comments/:id
// Login required. The author or an admin can delete.
// ============================================================

export const deleteComment = async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            res.status(404).json({ success: false, message: 'Comment not found.' });
            return;
        }
        if (!isAuthor(comment, req.user) && req.user.role !== 'admin') {
            res.status(403).json({ success: false, message: 'You can only delete your own comments.' });
            return;
        }

        await comment.deleteOne();

        // Admins deleting someone else's comment goes in the admin activity log
        if (!isAuthor(comment, req.user)) {
            await logAdminAction(req.user, 'comment.delete', `Deleted a comment: ${quote(comment.text)}`, {
                type: 'Comment', id: comment._id, user: comment.user
            });
        }

        res.status(200).json({ success: true, data: { id: comment._id } });
    } catch (error) {
        next(error);
    }
};
