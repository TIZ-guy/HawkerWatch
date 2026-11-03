// Small text helpers for the Admin page.

// "Jane Tan (jane@example.com)", or 'a deleted user' when the account is gone
export function personText(user) {
  return user ? `${user.name} (${user.email})` : 'a deleted user'
}

// Who added a stall. Stalls loaded by pnpm import:stalls have no addedBy.
export function addedByText(stall) {
  return stall.addedBy ? personText(stall.addedBy) : 'the stall import'
}

// "Chicken rice · Chinese · #01-23"
export function stallDetails(stall) {
  return [stall.speciality, stall.cuisine, stall.unitNumber && `#${stall.unitNumber}`].filter(Boolean).join(' · ')
}

// "5 Nov 2026, 3:15 pm"
export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A permanent ban is stored as a date in the year 9999 (backend/utils/banUtils.js)
export function banText(user) {
  if (!user.banned) return ''
  return user.permanentBan ? 'Banned' : `Suspended until ${formatDateTime(user.bannedUntil)}`
}

// Icon for each kind of entry in the activity log (backend/models/AdminAction.js)
export const ACTION_ICONS = {
  'stall.approve': 'bi-check-circle',
  'stall.reject': 'bi-x-circle',
  'stall.remove': 'bi-trash',
  'stall.restore': 'bi-arrow-counterclockwise',
  'report.delete': 'bi-megaphone',
  'foodUpdate.delete': 'bi-egg-fried',
  'review.delete': 'bi-star',
  'comment.delete': 'bi-chat-left-text',
  'user.ban': 'bi-slash-circle',
  'user.unban': 'bi-person-check',
  'user.role': 'bi-shield-lock',
  'centres.import': 'bi-cloud-download'
}
