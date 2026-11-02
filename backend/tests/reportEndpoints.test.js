// Report endpoints: validation and duplicate rule on submit, listing, and flagging. No database: model calls are replaced.
// (The location check and the recent feed are in reportLocation.test.js.)
import test from 'node:test'
import assert from 'node:assert/strict'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import { submitReport, listReports, flagReport } from '../controllers/reportController.js'

const STALL_ID = '64b7f0c2a1b2c3d4e5f60719'
const CENTRE_ID = '64b7f0c2a1b2c3d4e5f60718'
const REPORT_ID = '64b7f0c2a1b2c3d4e5f60720'
const HERE = { lat: 1.3521, lng: 103.8198 }
const CENTRE = { _id: CENTRE_ID, name: 'Kampong Demo Food Centre', location: { coordinates: [103.8198, 1.3521] } }

const MINUTE = 60 * 1000

function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; this.statusCode ??= 200; return this }
  }
}

// ---------- submitReport ----------

function mockStall(t, { found = true, duplicate = null } = {}) {
  t.mock.method(Stall, 'findById', () => ({
    select: () => ({ populate: async () => (found ? { _id: STALL_ID, hawkerCentre: CENTRE } : null) })
  }))
  const exists = t.mock.method(StatusReport, 'exists', async () => duplicate)
  const create = t.mock.method(StatusReport, 'create', async (fields) => ({ ...fields, _id: 'new-report', flaggedBy: [] }))
  return { exists, create }
}

async function submit(body) {
  const res = fakeRes()
  await submitReport({ body: { stallId: STALL_ID, status: 'OPEN', ...HERE, ...body }, user: { _id: 'user-1' } }, res)
  return res
}

test('a valid report is saved for the stall, the centre and the user, and answers 201 without who flagged it', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const { create } = mockStall(t)

  const res = await submit({ status: 'LONG_QUEUE' })

  assert.equal(res.statusCode, 201)
  assert.deepEqual(create.mock.calls[0].arguments[0], { stall: STALL_ID, hawkerCentre: CENTRE_ID, user: 'user-1', status: 'LONG_QUEUE' })
  assert.equal(res.body.data.report.status, 'LONG_QUEUE')
  assert.equal(res.body.data.report.flagCount, 0)
  assert.equal('flaggedBy' in res.body.data.report, false)
})

test('a missing or odd stallId is refused before the database is asked', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const { create } = mockStall(t)

  for (const stallId of [undefined, '', 'not-an-id', 123, { $ne: null }]) {
    const res = await submit({ stallId })
    assert.equal(res.statusCode, 400, `stallId ${JSON.stringify(stallId)}`)
  }
  assert.equal(Stall.findById.mock.callCount(), 0)
  assert.equal(create.mock.callCount(), 0)
})

test('a missing or unknown status is refused and the message lists the allowed ones', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const { create } = mockStall(t)

  for (const status of [undefined, 'NOT_A_STATUS', 'open', 5, ['OPEN'], { $ne: null }]) {
    const res = await submit({ status })
    assert.equal(res.statusCode, 400, `status ${JSON.stringify(status)}`)
    assert.match(res.body.message, /OPEN.*LONG_QUEUE/)
  }
  assert.equal(create.mock.callCount(), 0)
})

test('a report with no body at all gives 400, not a crash', async () => {
  const res = fakeRes()
  await submitReport({ user: { _id: 'user-1' } }, res)
  assert.equal(res.statusCode, 400)
})

test('a report for an unknown stall gives 404', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const { create } = mockStall(t, { found: false })

  const res = await submit({})

  assert.equal(res.statusCode, 404)
  assert.equal(create.mock.callCount(), 0)
})

test('a second report on the same stall within 15 minutes gives 409 and is not saved', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const { exists, create } = mockStall(t, { duplicate: { _id: 'earlier' } })
  const before = Date.now()

  const res = await submit({})

  assert.equal(res.statusCode, 409)
  assert.match(res.body.message, /15 minutes/)
  assert.equal(create.mock.callCount(), 0)
  // The check is for this user, this stall, and only the last 15 minutes
  const query = exists.mock.calls[0].arguments[0]
  assert.equal(query.user, 'user-1')
  assert.equal(String(query.stall), STALL_ID)
  const cutoff = query.createdAt.$gte.getTime()
  assert.ok(cutoff >= before - 15 * MINUTE && cutoff <= Date.now() - 15 * MINUTE + 1000)
})

// ---------- listReports ----------

const live = new Date(Date.now() + 30 * MINUTE)
const justNow = new Date(Date.now() - 2 * MINUTE)

function mockFind(t, reports) {
  let filter
  const query = { sort: () => query, limit: () => query, lean: async () => reports }
  t.mock.method(StatusReport, 'find', (f) => { filter = f; return query })
  return () => filter
}

test('listing needs a stallId or a hawkerCentreId, and both must be real ids', async (t) => {
  mockFind(t, [])

  for (const query of [{}, { stallId: 'nope' }, { hawkerCentreId: 'nope' }, { stallId: { $ne: null } }, { hawkerCentreId: ['a'] }]) {
    const res = fakeRes()
    await listReports({ query }, res)
    assert.equal(res.statusCode, 400, JSON.stringify(query))
  }
  assert.equal(StatusReport.find.mock.callCount(), 0)
})

test('listing by stall asks for that stall\'s unexpired reports and includes the summary', async (t) => {
  const filterUsed = mockFind(t, [
    { _id: 'r1', stall: STALL_ID, hawkerCentre: CENTRE_ID, status: 'LONG_QUEUE', createdAt: justNow, expiresAt: live, flaggedBy: ['a'] },
    { _id: 'r2', stall: STALL_ID, hawkerCentre: CENTRE_ID, status: 'LONG_QUEUE', createdAt: justNow, expiresAt: live, flaggedBy: [] }
  ])

  const res = fakeRes()
  await listReports({ query: { stallId: STALL_ID } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(filterUsed().stall, STALL_ID)
  assert.equal('hawkerCentre' in filterUsed(), false)
  assert.ok(filterUsed().expiresAt.$gt instanceof Date)
  assert.deepEqual(res.body.data.reports.map((r) => r.id), ['r1', 'r2'])
  assert.equal(res.body.data.reports[0].flagCount, 1)
  assert.equal('flaggedBy' in res.body.data.reports[0], false)
  assert.equal(res.body.data.summary.status, 'LONG_QUEUE')
  assert.equal(res.body.data.summary.reportCount, 2)
})

test('listing by centre filters on the centre and has no summary', async (t) => {
  const filterUsed = mockFind(t, [
    { _id: 'r1', stall: STALL_ID, hawkerCentre: CENTRE_ID, status: 'OPEN', createdAt: justNow, expiresAt: live, flaggedBy: [] }
  ])

  const res = fakeRes()
  await listReports({ query: { hawkerCentreId: CENTRE_ID } }, res)

  assert.equal(filterUsed().hawkerCentre, CENTRE_ID)
  assert.equal('stall' in filterUsed(), false)
  assert.equal(res.body.data.reports.length, 1)
  assert.equal('summary' in res.body.data, false)
})

test('listing leaves out reports flagged by 3 users, and the summary is null when none are left', async (t) => {
  mockFind(t, [
    { _id: 'r1', stall: STALL_ID, hawkerCentre: CENTRE_ID, status: 'OPEN', createdAt: justNow, expiresAt: live, flaggedBy: ['a', 'b', 'c'] }
  ])

  const res = fakeRes()
  await listReports({ query: { stallId: STALL_ID } }, res)

  assert.deepEqual(res.body.data.reports, [])
  assert.equal(res.body.data.summary, null)
})

// ---------- flagReport ----------

function mockReport(t, report) {
  t.mock.method(StatusReport, 'findById', async () => report)
  return t.mock.method(StatusReport, 'findByIdAndUpdate', async (_id, change) => ({
    flaggedBy: [...report.flaggedBy, change.$addToSet.flaggedBy]
  }))
}

async function flag(userId, params = { id: REPORT_ID }) {
  const res = fakeRes()
  await flagReport({ params, user: { _id: userId } }, res)
  return res
}

test('a flag is counted once and the report stays until a third user flags it', async (t) => {
  const update = mockReport(t, { user: 'owner', flaggedBy: ['a'], expiresAt: live })

  const res = await flag('b')

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.data, { flagCount: 2, hidden: false })
  assert.deepEqual(update.mock.calls[0].arguments[1], { $addToSet: { flaggedBy: 'b' } })
})

test('the third different user to flag hides the report', async (t) => {
  mockReport(t, { user: 'owner', flaggedBy: ['a', 'b'], expiresAt: live })

  const res = await flag('c')

  assert.deepEqual(res.body.data, { flagCount: 3, hidden: true })
})

test('you cannot flag your own report', async (t) => {
  const update = mockReport(t, { user: 'owner', flaggedBy: [], expiresAt: live })

  const res = await flag('owner')

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /own report/)
  assert.equal(update.mock.callCount(), 0)
})

test('you cannot flag the same report twice', async (t) => {
  const update = mockReport(t, { user: 'owner', flaggedBy: ['b'], expiresAt: live })

  const res = await flag('b')

  assert.equal(res.statusCode, 409)
  assert.equal(update.mock.callCount(), 0)
})

test('an expired report cannot be flagged', async (t) => {
  const update = mockReport(t, { user: 'owner', flaggedBy: [], expiresAt: new Date(Date.now() - MINUTE) })

  const res = await flag('b')

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /expired/)
  assert.equal(update.mock.callCount(), 0)
})

test('flagging a report that does not exist gives 404, and a bad id gives 400', async (t) => {
  t.mock.method(StatusReport, 'findById', async () => null)

  assert.equal((await flag('b')).statusCode, 404)
  for (const params of [{ id: 'nope' }, {}, { id: '64b7f0c2a1b2c3d4e5f6071' }]) {
    assert.equal((await flag('b', params)).statusCode, 400, JSON.stringify(params))
  }
  assert.equal(StatusReport.findById.mock.callCount(), 1) // only the well-formed id reached the database
})
