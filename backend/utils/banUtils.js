// Suspending and banning users. A banned user can still log in, browse and manage their favourites,
// but can't post anything (reports, food updates, reviews, comments or stalls) until the ban ends.
// A permanent ban is stored as a date far in the future, so every ban is just "bannedUntil is later than now".

export const PERMANENT_BAN = new Date('9999-12-31T00:00:00Z')
export const BAN_REASON_MAX_LENGTH = 200
// Longest suspension an admin can choose, in days (longer than this is a permanent ban)
export const MAX_BAN_DAYS = 365

export function isBanned(user, now = new Date()) {
  return Boolean(user?.bannedUntil && new Date(user.bannedUntil) > now)
}

export function isPermanentBan(user) {
  return Boolean(user?.bannedUntil && new Date(user.bannedUntil) >= PERMANENT_BAN)
}

// The message a banned user sees when they try to post
export function banMessage(user) {
  const reason = user.banReason ? ` Reason: ${user.banReason}` : ''
  if (isPermanentBan(user)) return `Your account has been banned from posting.${reason}`
  const until = new Date(user.bannedUntil).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  })
  return `Your account is suspended from posting until ${until}.${reason}`
}
