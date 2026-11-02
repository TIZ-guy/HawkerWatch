import { describe, it, expect } from 'vitest'
import { clockTime, dueReminders, reminderKey } from '@/utils/reminders.js'

// Thursday 29 Oct 2026, 12:05 pm (local time)
const NOW = new Date(2026, 9, 29, 12, 5)
const THURSDAY = 4

const favourite = (name, alert) => ({ target: { name }, alert })

describe('dueReminders', () => {
  it('groups favourites that share a time into one reminder, earliest first', () => {
    const favourites = [
      favourite('Sample Laksa', { enabled: true, days: [THURSDAY], time: '12:00' }),
      favourite('Kampong Food Centre', { enabled: true, days: [THURSDAY], time: '11:30' }),
      favourite('Chicken Rice', { enabled: true, days: [THURSDAY], time: '12:00' })
    ]

    expect(dueReminders(favourites, NOW)).toEqual([
      { time: '11:30', names: ['Kampong Food Centre'] },
      { time: '12:00', names: ['Sample Laksa', 'Chicken Rice'] }
    ])
  })

  it('leaves out reminders that are later today, on other days or switched off', () => {
    const favourites = [
      favourite('Later today', { enabled: true, days: [THURSDAY], time: '18:00' }),
      favourite('Fridays only', { enabled: true, days: [5], time: '09:00' }),
      favourite('Switched off', { enabled: false, days: [THURSDAY], time: '09:00' }),
      favourite('No alert set', undefined)
    ]

    expect(dueReminders(favourites, NOW)).toEqual([])
  })

  it('skips favourites whose stall or centre was removed', () => {
    const removed = { target: null, alert: { enabled: true, days: [THURSDAY], time: '09:00' } }

    expect(dueReminders([removed], NOW)).toEqual([])
  })
})

describe('clockTime and reminderKey', () => {
  it('pads hours and minutes to two digits', () => {
    expect(clockTime(new Date(2026, 9, 29, 9, 5))).toBe('09:05')
  })

  it('gives a different key for the same time on another day', () => {
    const tomorrow = new Date(2026, 9, 30, 12, 5)

    expect(reminderKey(NOW, '12:00')).toBe('2026-10-29-12:00')
    expect(reminderKey(tomorrow, '12:00')).not.toBe(reminderKey(NOW, '12:00'))
  })
})
