import { FLAG_HIDE_THRESHOLD } from './reportUtils.js'

// Business rules for food updates. Plain functions (no database), so the model, controller and tests can all use them.

const HOUR = 60 * 60 * 1000
const SINGAPORE_OFFSET = 8 * HOUR // Singapore is UTC+8 all year

// The next midnight in Singapore, when a food update stops showing.
export function endOfDay(now = new Date()) {
  const local = new Date(now.getTime() + SINGAPORE_OFFSET)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1)
  return new Date(midnight - SINGAPORE_OFFSET)
}

// Has the update passed its expiry time?
export function isExpired(update, now = new Date()) {
  const expiresAt = update.expiresAt ? new Date(update.expiresAt) : endOfDay(new Date(update.createdAt))
  return expiresAt <= now
}

// Flagged by enough different users to hide it? Same threshold as status reports.
export function isHidden(update) {
  return (update.flaggedBy?.length ?? 0) >= FLAG_HIDE_THRESHOLD
}

// Shows while it is not expired and not hidden by flags.
export function isLive(update, now = new Date()) {
  return !isExpired(update, now) && !isHidden(update)
}

// Trims the note; an empty note becomes null. Returns undefined when the note isn't text.
export function cleanNote(note) {
  if (note === undefined || note === null) return null
  if (typeof note !== 'string') return undefined
  return note.trim() || null
}
