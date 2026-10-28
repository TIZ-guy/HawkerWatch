import { describe, it, expect } from 'vitest'
import { formatAlert, formatAlertTime, formatDays } from '@/utils/alerts.js'

describe('formatDays', () => {
  it.each([
    [[1, 2, 3, 4, 5], 'Weekdays'],
    [[0, 1, 2, 3, 4, 5, 6], 'Every day'],
    [[6, 0], 'Weekends'],
    [[5, 1, 3], 'Mon, Wed, Fri'],
    [[0, 1], 'Mon, Sun'] // the week is shown Monday first
  ])('%j reads "%s"', (days, text) => {
    expect(formatDays(days)).toBe(text)
  })

  it('reads as nothing when no days are picked', () => {
    expect(formatDays([])).toBe('')
  })
})

describe('formatAlertTime', () => {
  it.each([
    ['00:05', '12:05 am'],
    ['11:30', '11:30 am'],
    ['12:00', '12:00 pm'],
    ['23:45', '11:45 pm'],
    ['', '']
  ])('"%s" reads "%s"', (time, text) => {
    expect(formatAlertTime(time)).toBe(text)
  })
})

describe('formatAlert', () => {
  it('combines the days and the time', () => {
    expect(formatAlert({ enabled: true, days: [1, 2, 3, 4, 5], time: '11:30' })).toBe('Weekdays at 11:30 am')
  })

  it.each([
    ['turned off', { enabled: false, days: [1], time: '11:30' }],
    ['no days picked', { enabled: true, days: [], time: '11:30' }],
    ['no time set', { enabled: true, days: [1] }],
    ['no reminder at all', undefined]
  ])('is empty when %s', (_reason, alert) => {
    expect(formatAlert(alert)).toBe('')
  })
})
