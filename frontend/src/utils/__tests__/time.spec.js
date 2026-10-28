import { describe, it, expect } from 'vitest'
import { formatDate, timeAgo, timeUntil } from '@/utils/time.js'

// A fixed "now" (local time), so the results don't depend on when the tests run
const NOW = new Date(2026, 9, 27, 12, 0).getTime()
const minutesFromNow = (minutes) => new Date(NOW + minutes * 60 * 1000)

describe('timeAgo', () => {
  it.each([
    [0, 'just now'],
    [5, '5 min ago'],
    [59, '59 min ago'],
    [120, '2 h ago'],
    [24 * 60, '1 day ago'],
    [3 * 24 * 60, '3 days ago']
  ])('%i minutes ago reads "%s"', (minutes, text) => {
    expect(timeAgo(minutesFromNow(-minutes), NOW)).toBe(text)
  })
})

describe('timeUntil', () => {
  it.each([
    [-1, 'expired'],
    [0, 'expired'],
    [40, 'in 40 min'],
    [60, 'in 1 h'],
    [90, 'in 2 h']
  ])('%i minutes ahead reads "%s"', (minutes, text) => {
    expect(timeUntil(minutesFromNow(minutes), NOW)).toBe(text)
  })
})

describe('formatDate', () => {
  it('shows the weekday, day and short month', () => {
    expect(formatDate(new Date(2026, 9, 16))).toBe('Fri, 16 Oct')
  })
})
