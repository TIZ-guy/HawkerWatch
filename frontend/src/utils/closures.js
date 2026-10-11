// Official NEA closure helpers. Closure dates count as whole days: a closure that
// starts or ends at any time today means the centre is closed today.
import { formatDate } from './time.js'

export const CLOSURE_TYPE_LABELS = {
  CLEANING: 'Cleaning',
  OTHER_WORKS: 'Repair works'
}

const startOfDay = (date) => new Date(new Date(date).setHours(0, 0, 0, 0))
const endOfDay = (date) => new Date(new Date(date).setHours(23, 59, 59, 999))

export function closureLabel(closure) {
  return CLOSURE_TYPE_LABELS[closure.type] || 'Closure'
}

// "Fri, 16 Oct" or "Fri, 16 Oct – Sun, 18 Oct"
export function closureDates(closure) {
  const start = formatDate(closure.startDate)
  const end = formatDate(closure.endDate)
  return start === end ? start : `${start} – ${end}`
}

// The closure covering today, or null.
export function currentClosure(closures = [], now = new Date()) {
  return closures.find(
    (closure) => startOfDay(closure.startDate) <= now && endOfDay(closure.endDate) >= now
  ) || null
}

// Closures that start after today, soonest first.
export function upcomingClosures(closures = [], now = new Date()) {
  return closures
    .filter((closure) => startOfDay(closure.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
}

// Whole days from today until the date: 0 = today, 1 = tomorrow.
export function daysUntil(date, now = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000))
}
