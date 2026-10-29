// Consolidated reminders: one notification per reminder time, listing every favourite due then.
// Worked out in the browser from the favourites the store already has, so it needs no extra
// request and no scheduled job on the server. It only shows while HawkerWatch is open.

const pad = (number) => String(number).padStart(2, '0')

// "11:30" for a Date, in the user's own time zone
export const clockTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

// "2026-10-29-11:30": one key per reminder per day, so dismissing today's doesn't hide tomorrow's
export const reminderKey = (date, time) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${time}`

// Today's reminders that are already due, grouped by time, earliest first.
// e.g. [{ time: '11:30', names: ['Sample Laksa', 'Kampong Food Centre'] }]
export function dueReminders(favourites, now = new Date()) {
  const today = now.getDay() // 0 = Sunday, the same numbering the alert days use
  const current = clockTime(now)
  const groups = {}

  for (const favourite of favourites) {
    const alert = favourite.alert
    if (!alert?.enabled || !alert.time || !alert.days?.includes(today)) continue
    // "HH:mm" strings sort like times, so "11:30" > "09:00" works without converting
    if (alert.time > current) continue
    const name = favourite.target?.name
    if (!name) continue // the stall or centre was removed

    if (!groups[alert.time]) groups[alert.time] = []
    groups[alert.time].push(name)
  }

  return Object.keys(groups)
    .sort()
    .map((time) => ({ time, names: groups[time] }))
}
