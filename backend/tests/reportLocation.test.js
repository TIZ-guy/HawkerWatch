// Location check for reports and the recent-reports feed. No database: model calls are replaced.
import test from 'node:test'
import assert from 'node:assert/strict'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import { submitReport, recentReports, reportSettings } from '../controllers/reportController.js'
import { distanceMetres, formatMetres } from '../utils/geo.js'

const STALL_ID = '64b7f0c2a1b2c3d4e5f60719'
const CENTRE = { _id: '64b7f0c2a1b2c3d4e5f60718', name: 'Kampong Demo Food Centre', location: { coordinates: [103.8198, 1.3521] } }

function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; this.statusCode ??= 200; return this }
  }
}

function mockStallAndSave(t) {
  t.mock.method(Stall, 'findById', () => ({ select: () => ({ populate: async () => ({ _id: STALL_ID, hawkerCentre: CENTRE }) }) }))
  t.mock.method(StatusReport, 'exists', async () => null)
  return t.mock.method(StatusReport, 'create', async (fields) => ({ ...fields, _id: 'new-report', flaggedBy: [] }))
}

async function report(body) {
  const res = fakeRes()
  await submitReport({ body: { stallId: STALL_ID, status: 'OPEN', ...body }, user: { _id: 'user-1' } }, res)
  return res
}

test('distanceMetres measures straight-line distance', () => {
  assert.equal(Math.round(distanceMetres({ lat: 1.3521, lng: 103.8198 }, [103.8198, 1.3521])), 0)
  const oneHundredMetresNorth = distanceMetres({ lat: 1.3521 + 0.0009, lng: 103.8198 }, [103.8198, 1.3521])
  assert.ok(oneHundredMetresNorth > 95 && oneHundredMetresNorth < 105)
  assert.equal(formatMetres(150.4), '150 m')
  assert.equal(formatMetres(3240), '3.2 km')
})

test('a report from within 200 m of the centre is saved, without storing the position', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStallAndSave(t)
  const res = await report({ lat: 1.3521 + 0.001, lng: 103.8198 }) // about 110 m away
  assert.equal(res.statusCode, 201)
  const saved = create.mock.calls[0].arguments[0]
  assert.equal(saved.hawkerCentre, CENTRE._id)
  assert.equal('lat' in saved || 'lng' in saved, false)
})

test('a report from more than 200 m away is refused with the distance', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStallAndSave(t)
  const res = await report({ lat: 1.3621, lng: 103.8198 }) // about 1.1 km away
  assert.equal(res.statusCode, 403)
  assert.match(res.body.message, /Kampong Demo Food Centre.*1\.1 km/)
  assert.equal(create.mock.callCount(), 0)
})

test('a report without a location is refused while the check is on', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  mockStallAndSave(t)
  assert.equal((await report({})).statusCode, 400)
  assert.equal((await report({ lat: '1.35', lng: '103.8' })).statusCode, 400)
})

test('REPORT_LOCATION_CHECK=off lets reports through from anywhere', async (t) => {
  process.env.REPORT_LOCATION_CHECK = 'off'
  t.after(() => { delete process.env.REPORT_LOCATION_CHECK })
  mockStallAndSave(t)
  assert.equal((await report({})).statusCode, 201)

  const settings = fakeRes()
  reportSettings({}, settings)
  assert.deepEqual(settings.body.data, { locationCheck: false, maxDistanceMetres: 200 })
})

test('the recent feed skips expired and hidden reports and can filter by status', async (t) => {
  let filter
  const query = { sort: () => query, limit: () => query, populate: () => query, lean: async () => [
    { _id: 'r1', stall: { name: 'Sample Laksa' }, hawkerCentre: { name: 'Kampong' }, status: 'OPEN', flaggedBy: [] },
    { _id: 'r2', stall: null, hawkerCentre: { name: 'Kampong' }, status: 'OPEN', flaggedBy: [] }
  ] }
  t.mock.method(StatusReport, 'find', (f) => { filter = f; return query })

  const res = fakeRes()
  await recentReports({ query: { status: 'OPEN' } }, res)
  assert.equal(filter.status, 'OPEN')
  assert.ok(filter.expiresAt.$gt instanceof Date)
  assert.deepEqual(filter['flaggedBy.2'], { $exists: false })
  assert.deepEqual(res.body.data.reports.map((r) => r.id), ['r1']) // the report whose stall was deleted is left out

  const bad = fakeRes()
  await recentReports({ query: { status: 'NOT_A_STATUS' } }, bad)
  assert.equal(bad.statusCode, 400)
})
