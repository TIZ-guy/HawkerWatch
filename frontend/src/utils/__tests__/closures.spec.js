import { describe, it, expect } from 'vitest'
import { closureDates, closureLabel, currentClosure, daysUntil, upcomingClosures } from '@/utils/closures.js'

// Tuesday 27 Oct 2026, midday (local time)
const NOW = new Date(2026, 9, 27, 12, 0)
const day = (date, hour = 0) => new Date(2026, 9, date, hour)

const pastWorks = { type: 'OTHER_WORKS', startDate: day(1), endDate: day(2) }
const cleaningToday = { type: 'CLEANING', startDate: day(27), endDate: day(28) }
const laterCleaning = { type: 'CLEANING', startDate: day(30), endDate: day(31) }
const soonWorks = { type: 'OTHER_WORKS', startDate: day(29), endDate: day(29) }

describe('currentClosure', () => {
  it('finds the closure covering today', () => {
    expect(currentClosure([pastWorks, cleaningToday, laterCleaning], NOW)).toEqual(cleaningToday)
  })

  it('counts whole days, so a closure ending at midnight today still covers today', () => {
    const endsThisMorning = { type: 'CLEANING', startDate: day(25), endDate: day(27, 0) }
    expect(currentClosure([endsThisMorning], NOW)).toEqual(endsThisMorning)
  })

  it('is null when nothing covers today', () => {
    expect(currentClosure([pastWorks, laterCleaning], NOW)).toBeNull()
    expect(currentClosure(undefined, NOW)).toBeNull()
  })
})

describe('upcomingClosures', () => {
  it('lists only closures starting after today, soonest first', () => {
    expect(upcomingClosures([laterCleaning, pastWorks, cleaningToday, soonWorks], NOW)).toEqual([soonWorks, laterCleaning])
  })
})

describe('daysUntil', () => {
  it.each([
    [day(27, 23), 0],
    [day(28, 1), 1],
    [new Date(2026, 10, 3), 7]
  ])('%s is %i day(s) away', (date, days) => {
    expect(daysUntil(date, NOW)).toBe(days)
  })
})

describe('closure labels and dates', () => {
  it('names the closure type', () => {
    expect(closureLabel(cleaningToday)).toBe('Cleaning')
    expect(closureLabel(pastWorks)).toBe('Repair works')
    expect(closureLabel({ type: 'SOMETHING_NEW' })).toBe('Closure')
  })

  it('shows one date for a one-day closure, otherwise a range', () => {
    expect(closureDates(soonWorks)).toBe('Thu, 29 Oct')
    expect(closureDates(laterCleaning)).toBe('Fri, 30 Oct – Sat, 31 Oct')
  })
})
