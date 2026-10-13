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

export function closureDates(closure) {
  const start = formatDate(closure.startDate)
  const end = formatDate(closure.endDate)
  return start === end ? start : `${start} – ${end}`
}

export function currentClosure(closures = [], now = new Date()) {
  return closures.find(
    (closure) => startOfDay(closure.startDate) <= now && endOfDay(closure.endDate) >= now
  ) || null
}

export function upcomingClosures(closures = [], now = new Date()) {
  return closures
    .filter((closure) => startOfDay(closure.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
}

export function daysUntil(date, now = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000))
}
