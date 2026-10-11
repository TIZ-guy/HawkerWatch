import { REPORT_TTL_MINUTES, DUPLICATE_WINDOW_MINUTES } from './constants.js'

// Business rules for community reports. These are plain functions (no database),
// so the controller and the tests can both use them.

const MINUTE = 60 * 1000

// A report is hidden once this many different users have flagged it.
export const FLAG_HIDE_THRESHOLD = 3

// How many live reports we want before we are fully confident in a status.
export const FULL_CONFIDENCE_REPORTS = 3

// Has the report passed its expiry time?
export function isExpired(report, now = new Date()) {
  const expiresAt = report.expiresAt
    ? new Date(report.expiresAt)
    : new Date(new Date(report.createdAt).getTime() + REPORT_TTL_MINUTES * MINUTE)
  return expiresAt <= now
}

// Has the report been flagged by enough users to hide it?
export function isHidden(report) {
  return (report.flaggedBy?.length ?? 0) >= FLAG_HIDE_THRESHOLD
}

// A live report is not expired and not hidden by flags.
export function isLive(report, now = new Date()) {
  return !isExpired(report, now) && !isHidden(report)
}

// Reports created at or after this time count as duplicates of a new report
// from the same user on the same stall.
export function duplicateCutoff(now = new Date()) {
  return new Date(now.getTime() - DUPLICATE_WINDOW_MINUTES * MINUTE)
}

// Work out a stall's current status and how much to trust it.
// Takes the stall's reports (any age) and returns null if none are live.
// Each live report is one vote, and newer reports count for more.
export function calculateConfidence(reports, now = new Date()) {
  const live = reports
    .filter((r) => isLive(r, now))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // newest first
  if (live.length === 0) return null

  const weightByStatus = {}
  let totalWeight = 0
  for (const r of live) {
    const ageMinutes = (now - new Date(r.createdAt)) / MINUTE
    // 1 when brand new, falling towards 0 as it nears expiry (never below 0.1)
    const weight = Math.max(0.1, 1 - ageMinutes / REPORT_TTL_MINUTES)
    weightByStatus[r.status] = (weightByStatus[r.status] || 0) + weight
    totalWeight += weight
  }

  // The status with the most weight wins. Keys are in newest-first order and we
  // only replace on a strictly higher weight, so a tie goes to the newest report.
  let status = null
  let best = -1
  for (const [s, w] of Object.entries(weightByStatus)) {
    if (w > best) {
      status = s
      best = w
    }
  }

  const agreement = best / totalWeight // 0 to 1: how much the reports agree
  const volume = Math.min(1, live.length / FULL_CONFIDENCE_REPORTS) // few reports = less sure
  const confidence = Math.round(agreement * volume * 100)
  const level = confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low'

  return {
    status,
    confidence,
    level,
    reportCount: live.length,
    lastReportedAt: live[0].createdAt
  }
}