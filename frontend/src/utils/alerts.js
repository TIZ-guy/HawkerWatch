export const WEEK_DAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' }
]

const WEEKDAYS = [1, 2, 3, 4, 5]
const sameDays = (a, b) => a.length === b.length && b.every((day) => a.includes(day))

export function formatDays(days = []) {
  if (sameDays(days, [0, ...WEEKDAYS, 6])) return 'Every day'
  if (sameDays(days, WEEKDAYS)) return 'Weekdays'
  if (sameDays(days, [0, 6])) return 'Weekends'
  return WEEK_DAYS.filter((day) => days.includes(day.value)).map((day) => day.short).join(', ')
}

export function formatAlertTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours < 12 ? 'am' : 'pm'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function formatAlert(alert) {
  if (!alert?.enabled || !alert.days?.length || !alert.time) return ''
  return `${formatDays(alert.days)} at ${formatAlertTime(alert.time)}`
}
