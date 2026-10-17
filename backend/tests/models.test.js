// Validation tests that run without a database: validateSync() checks a document against its schema.
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import User from '../models/User.js'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import Favourite from '../models/Favourite.js'
import Review from '../models/Review.js'
import Comment from '../models/Comment.js'
import { errorHandler } from '../middleware/errorMiddleware.js'
import { REPORT_TTL_MINUTES } from '../utils/constants.js'

const id = () => new mongoose.Types.ObjectId()
const errorPaths = (doc) => Object.keys(doc.validateSync()?.errors || {})

test('User lowercases email, rejects unknown roles and hides passwordHash in JSON', () => {
  const user = new User({ name: 'A', email: 'A@Example.com', passwordHash: 'x', role: 'superuser' })
  assert.equal(user.email, 'a@example.com')
  assert.deepEqual(errorPaths(user), ['role'])
  assert.equal(user.toJSON().passwordHash, undefined)
})

test('HawkerCentre checks postal code, coordinates and closure dates', () => {
  const centre = new HawkerCentre({
    name: 'C',
    address: 'A',
    postalCode: '123',
    location: { coordinates: [103.8] },
    closures: [{ type: 'CLEANING', startDate: new Date('2026-01-02'), endDate: new Date('2026-01-01') }]
  })
  assert.deepEqual(errorPaths(centre).sort(), ['closures.0.endDate', 'location.coordinates', 'postalCode'])
})

test('Stall requires a centre and a name', () => {
  assert.deepEqual(errorPaths(new Stall({})).sort(), ['hawkerCentre', 'name'])
})

test('StatusReport rejects unknown statuses', () => {
  const report = new StatusReport({ stall: id(), hawkerCentre: id(), user: id(), status: 'BUSY' })
  assert.deepEqual(errorPaths(report), ['status'])
})

test('StatusReport expires after the configured number of minutes', () => {
  const report = new StatusReport({ stall: id(), hawkerCentre: id(), user: id(), status: 'OPEN' })
  const minutesLeft = (report.expiresAt - Date.now()) / 60000
  assert.ok(Math.abs(minutesLeft - REPORT_TTL_MINUTES) < 1)
})

test('Favourite rejects invalid alert times and days', () => {
  const favourite = new Favourite({
    user: id(),
    targetType: 'Stall',
    target: id(),
    alert: { enabled: true, days: [7], time: '25:00' }
  })
  assert.deepEqual(errorPaths(favourite).sort(), ['alert.days.0', 'alert.time'])
})

test('Review needs a whole-number rating from 1 to 5, and text is limited to 500 characters', () => {
  assert.deepEqual(errorPaths(new Review({ stall: id(), user: id(), rating: 4 })), [])
  assert.deepEqual(errorPaths(new Review({ stall: id(), user: id() })), ['rating'])
  for (const rating of [0, 6, 3.5]) {
    assert.deepEqual(errorPaths(new Review({ stall: id(), user: id(), rating })), ['rating'])
  }
  assert.deepEqual(errorPaths(new Review({ stall: id(), user: id(), rating: 4, text: 'a'.repeat(501) })), ['text'])
  const fivePhotos = [id(), id(), id(), id(), id()]
  assert.deepEqual(errorPaths(new Review({ stall: id(), user: id(), rating: 4, photos: fivePhotos })), ['photos'])
})

// A tiny stand-in for Express's res object that records what was sent.
function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

test('errorHandler turns validation errors into 400 responses', () => {
  const res = fakeRes()
  errorHandler(new Stall({}).validateSync(), {}, res, () => {})
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.success, false)
})

test('errorHandler turns duplicate keys into 409 responses', () => {
  const res = fakeRes()
  errorHandler({ code: 11000, keyValue: { email: 'a@example.com' } }, {}, res, () => {})
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.message, 'Duplicate value for email')
})

test('Comment text is limited to 500 characters', () => {
  const comment = new Comment({ hawkerCentre: id(), user: id(), text: 'a'.repeat(501) })
  assert.deepEqual(errorPaths(comment), ['text'])
})
