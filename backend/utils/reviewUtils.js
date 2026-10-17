import { REVIEW_TTL_DAYS } from './constants.js'

const DAY = 24 * 60 * 60 * 1000

// Reviews last updated before this are expired.
export const reviewCutoff = (now = new Date()) => new Date(now.getTime() - REVIEW_TTL_DAYS * DAY)

// Matches reviews that are still current: posted, or with stars or text edited, within REVIEW_TTL_DAYS.
export function currentReviewFilter(now = new Date()) {
  const cutoff = reviewCutoff(now)
  return { $or: [{ createdAt: { $gt: cutoff } }, { editedAt: { $gt: cutoff } }] }
}

// The opposite of currentReviewFilter. editedAt is null until the first edit.
export function expiredReviewFilter(now = new Date()) {
  const cutoff = reviewCutoff(now)
  return { createdAt: { $lte: cutoff }, $or: [{ editedAt: null }, { editedAt: { $lte: cutoff } }] }
}

// When a review stops counting, or null if it has no dates yet.
export function reviewExpiresAt(review) {
  const lastUpdate = review.editedAt || review.createdAt
  return lastUpdate ? new Date(new Date(lastUpdate).getTime() + REVIEW_TTL_DAYS * DAY) : null
}
