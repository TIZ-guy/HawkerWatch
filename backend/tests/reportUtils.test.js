import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isExpired,
  isHidden,
  isLive,
  duplicateCutoff,
  calculateConfidence
} from '../utils/reportUtils.js'

const NOW = new Date('2026-10-11T12:00:00Z')
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000)
const report = (status, ageMinutes, extra = {}) => ({
  status,
  createdAt: minutesAgo(ageMinutes),
  expiresAt: new Date(minutesAgo(ageMinutes).getTime() + 60 * 60 * 1000),
  flaggedBy: [],
  ...extra
})

test('isExpired: false inside 60 minutes, true after', () => {
  assert.equal(isExpired(report('OPEN', 59), NOW), false)
  assert.equal(isExpired(report('OPEN', 61), NOW), true)
})

test('isExpired: works from createdAt when expiresAt is missing', () => {
  assert.equal(isExpired({ createdAt: minutesAgo(61) }, NOW), true)
  assert.equal(isExpired({ createdAt: minutesAgo(10) }, NOW), false)
})

test('isHidden: hidden at 3 flags, not at 2', () => {
  assert.equal(isHidden({ flaggedBy: ['a', 'b'] }), false)
  assert.equal(isHidden({ flaggedBy: ['a', 'b', 'c'] }), true)
})

test('isLive: expired or hidden reports are not live', () => {
  assert.equal(isLive(report('OPEN', 5), NOW), true)
  assert.equal(isLive(report('OPEN', 70), NOW), false)
  assert.equal(isLive(report('OPEN', 5, { flaggedBy: ['a', 'b', 'c'] }), NOW), false)
})

test('duplicateCutoff: 15 minutes before now', () => {
  assert.equal(duplicateCutoff(NOW).getTime(), minutesAgo(15).getTime())
})

test('calculateConfidence: null when there are no live reports', () => {
  assert.equal(calculateConfidence([], NOW), null)
  assert.equal(calculateConfidence([report('OPEN', 90)], NOW), null)
})

test('calculateConfidence: three fresh agreeing reports is high', () => {
  const result = calculateConfidence(
    [report('LONG_QUEUE', 1), report('LONG_QUEUE', 2), report('LONG_QUEUE', 3)],
    NOW
  )
  assert.equal(result.status, 'LONG_QUEUE')
  assert.equal(result.level, 'high')
  assert.equal(result.reportCount, 3)
})

test('calculateConfidence: a single report is low confidence', () => {
  const result = calculateConfidence([report('OPEN', 1)], NOW)
  assert.equal(result.status, 'OPEN')
  assert.equal(result.level, 'low')
})

test('calculateConfidence: the majority status wins', () => {
  const result = calculateConfidence(
    [report('SHORT_QUEUE', 5), report('SHORT_QUEUE', 6), report('LONG_QUEUE', 7)],
    NOW
  )
  assert.equal(result.status, 'SHORT_QUEUE')
})

test('calculateConfidence: a tie goes to the newest report', () => {
  const result = calculateConfidence([report('OPEN', 10), report('TEMPORARILY_CLOSED', 2)], NOW)
  assert.equal(result.status, 'TEMPORARILY_CLOSED')
})

test('calculateConfidence: ignores expired and flagged reports', () => {
  const result = calculateConfidence(
    [
      report('LONG_QUEUE', 1, { flaggedBy: ['a', 'b', 'c'] }),
      report('LONG_QUEUE', 80),
      report('OPEN', 4)
    ],
    NOW
  )
  assert.equal(result.status, 'OPEN')
  assert.equal(result.reportCount, 1)
})