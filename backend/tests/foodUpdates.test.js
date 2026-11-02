// Food updates: the end-of-day rule, the submit checks, listing and flagging. No database: model calls are replaced.
import test from 'node:test'
import assert from 'node:assert/strict'
import Stall from '../models/Stall.js'
import FoodUpdate from '../models/FoodUpdate.js'
import { submitFoodUpdate, listFoodUpdates, flagFoodUpdate } from '../controllers/foodUpdateController.js'
import { endOfDay, isExpired, isHidden, isLive, cleanNote } from '../utils/foodUpdateUtils.js'

const STALL_ID = '64b7f0c2a1b2c3d4e5f60719'
const UPDATE_ID = '64b7f0c2a1b2c3d4e5f60720'
const CENTRE = { _id: '64b7f0c2a1b2c3d4e5f60718', name: 'Kampong Demo Food Centre', location: { coordinates: [103.8198, 1.3521] } }
const HERE = { lat: 1.3521, lng: 103.8198 }

function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; this.statusCode ??= 200; return this }
  }
}

function mockStall(t, { duplicate = null } = {}) {
  t.mock.method(Stall, 'findById', () => ({ select: () => ({ populate: async () => ({ _id: STALL_ID, hawkerCentre: CENTRE }) }) }))
  t.mock.method(FoodUpdate, 'exists', async () => duplicate)
  return t.mock.method(FoodUpdate, 'create', async (fields) => ({ ...fields, _id: 'new-update', flaggedBy: [] }))
}

async function submit(body) {
  const res = fakeRes()
  await submitFoodUpdate({ body: { stallId: STALL_ID, type: 'SOLD_OUT', ...HERE, ...body }, user: { _id: 'user-1' } }, res)
  return res
}

test('an update lasts until midnight Singapore time', () => {
  // 11:30 pm in Singapore on 3 Nov is 15:30 UTC; it ends at 16:00 UTC, half an hour later
  assert.equal(endOfDay(new Date('2026-11-03T15:30:00Z')).toISOString(), '2026-11-03T16:00:00.000Z')
  // 12:05 am on 4 Nov in Singapore is 16:05 UTC on 3 Nov; it lasts nearly a full day
  assert.equal(endOfDay(new Date('2026-11-03T16:05:00Z')).toISOString(), '2026-11-04T16:00:00.000Z')
  assert.equal(endOfDay(new Date('2026-11-03T02:00:00Z')).toISOString(), '2026-11-03T16:00:00.000Z')
})

test('live means not expired and not flagged by 3 users', () => {
  const now = new Date('2026-11-03T05:00:00Z')
  const fresh = { createdAt: '2026-11-03T04:00:00Z', expiresAt: '2026-11-03T16:00:00Z', flaggedBy: [] }
  assert.equal(isLive(fresh, now), true)
  assert.equal(isExpired({ ...fresh, expiresAt: '2026-11-03T04:30:00Z' }, now), true)
  assert.equal(isExpired({ createdAt: '2026-11-02T04:00:00Z' }, now), true) // no expiresAt: worked out from the day it was made
  assert.equal(isHidden({ flaggedBy: ['a', 'b'] }), false)
  assert.equal(isLive({ ...fresh, flaggedBy: ['a', 'b', 'c'] }, now), false)
})

test('cleanNote trims, treats empty as no note and rejects non-text', () => {
  assert.equal(cleanNote('  no fish balls '), 'no fish balls')
  assert.equal(cleanNote('   '), null)
  assert.equal(cleanNote(undefined), null)
  assert.equal(cleanNote(5), undefined)
})

test('a food update from the centre is saved with its note and without the position', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStall(t)
  const res = await submit({ type: 'SOME_SOLD_OUT', note: '  No more fish balls ' })
  assert.equal(res.statusCode, 201)
  const saved = create.mock.calls[0].arguments[0]
  assert.equal(saved.type, 'SOME_SOLD_OUT')
  assert.equal(saved.note, 'No more fish balls')
  assert.equal(saved.hawkerCentre, CENTRE._id)
  assert.equal('lat' in saved || 'lng' in saved, false)
  assert.equal(res.body.data.foodUpdate.flagCount, 0)
})

test('a bad stall id, type or note is refused', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStall(t)
  assert.equal((await submit({ stallId: { $ne: null } })).statusCode, 400)
  assert.equal((await submit({ type: 'OPEN' })).statusCode, 400)
  assert.equal((await submit({ note: 42 })).statusCode, 400)
  assert.equal((await submit({ note: 'x'.repeat(141) })).statusCode, 400)
  assert.equal(create.mock.callCount(), 0)
})

test('an update from more than 200 m away is refused, and one with no location too', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStall(t)
  const far = await submit({ lat: 1.3621, lng: 103.8198 })
  assert.equal(far.statusCode, 403)
  assert.match(far.body.message, /Kampong Demo Food Centre.*1\.1 km/)
  assert.equal((await submit({ lat: undefined, lng: undefined })).statusCode, 400)
  assert.equal(create.mock.callCount(), 0)
})

test('REPORT_LOCATION_CHECK=off lets food updates through from anywhere', async (t) => {
  process.env.REPORT_LOCATION_CHECK = 'off'
  t.after(() => { delete process.env.REPORT_LOCATION_CHECK })
  mockStall(t)
  assert.equal((await submit({ lat: undefined, lng: undefined })).statusCode, 201)
})

test('a second update on the same stall within 15 minutes is refused', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  const create = mockStall(t, { duplicate: { _id: 'earlier' } })
  const res = await submit({})
  assert.equal(res.statusCode, 409)
  assert.equal(create.mock.callCount(), 0)
})

test('an unknown stall gives 404', async (t) => {
  delete process.env.REPORT_LOCATION_CHECK
  t.mock.method(Stall, 'findById', () => ({ select: () => ({ populate: async () => null }) }))
  assert.equal((await submit({})).statusCode, 404)
})

test('the list needs a valid id, skips expired and hidden updates, and never sends who flagged', async (t) => {
  let filter
  const query = { sort: () => query, limit: () => query, lean: async () => [
    { _id: 'u1', type: 'SOLD_OUT', note: 'All gone', flaggedBy: ['a'], expiresAt: new Date(Date.now() + 60000) },
    { _id: 'u2', type: 'SOLD_OUT', flaggedBy: ['a', 'b', 'c'], expiresAt: new Date(Date.now() + 60000) }
  ] }
  t.mock.method(FoodUpdate, 'find', (f) => { filter = f; return query })

  const res = fakeRes()
  await listFoodUpdates({ query: { stallId: STALL_ID } }, res)
  assert.equal(filter.stall, STALL_ID)
  assert.ok(filter.expiresAt.$gt instanceof Date)
  assert.deepEqual(res.body.data.foodUpdates.map((u) => u.id), ['u1'])
  assert.equal(res.body.data.foodUpdates[0].flagCount, 1)
  assert.equal('flaggedBy' in res.body.data.foodUpdates[0], false)

  for (const bad of [{}, { stallId: 'nope' }, { hawkerCentreId: { $ne: null } }]) {
    const badRes = fakeRes()
    await listFoodUpdates({ query: bad }, badRes)
    assert.equal(badRes.statusCode, 400)
  }
})

function mockUpdate(t, update) {
  t.mock.method(FoodUpdate, 'findById', async () => update)
  return t.mock.method(FoodUpdate, 'findByIdAndUpdate', async (_id, change) => ({ flaggedBy: [...update.flaggedBy, change.$addToSet.flaggedBy] }))
}

async function flag(userId) {
  const res = fakeRes()
  await flagFoodUpdate({ params: { id: UPDATE_ID }, user: { _id: userId } }, res)
  return res
}

test('flagging counts once, hides at 3, and refuses own, repeat and expired updates', async (t) => {
  const live = new Date(Date.now() + 60 * 60 * 1000)

  mockUpdate(t, { user: 'owner', flaggedBy: ['a'], expiresAt: live })
  const ok = await flag('b')
  assert.deepEqual(ok.body.data, { flagCount: 2, hidden: false })
  t.mock.restoreAll()

  mockUpdate(t, { user: 'owner', flaggedBy: ['a', 'b'], expiresAt: live })
  assert.deepEqual((await flag('c')).body.data, { flagCount: 3, hidden: true })
  t.mock.restoreAll()

  mockUpdate(t, { user: 'owner', flaggedBy: [], expiresAt: live })
  assert.equal((await flag('owner')).statusCode, 400)
  t.mock.restoreAll()

  mockUpdate(t, { user: 'owner', flaggedBy: ['b'], expiresAt: live })
  assert.equal((await flag('b')).statusCode, 409)
  t.mock.restoreAll()

  mockUpdate(t, { user: 'owner', flaggedBy: [], expiresAt: new Date(Date.now() - 1000) })
  assert.equal((await flag('b')).statusCode, 400)
  t.mock.restoreAll()

  t.mock.method(FoodUpdate, 'findById', async () => null)
  assert.equal((await flag('b')).statusCode, 404)
})
