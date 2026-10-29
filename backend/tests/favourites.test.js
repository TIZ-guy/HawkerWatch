// Calls the real favourites routes over HTTP. The database calls are replaced with fakes,
// so these tests run without MongoDB (the same way CI runs them).
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import app from '../app.js'
import Favourite from '../models/Favourite.js'
import Stall from '../models/Stall.js'
import User from '../models/User.js'
import { AUTH_COOKIE, signToken } from '../utils/authToken.js'

process.env.JWT_SECRET = 'test-secret'

const STALL_ID = '64b7f0c2a1b2c3d4e5f60718'
const FAVOURITE_ID = '64b7f0c2a1b2c3d4e5f60721'
const user = { _id: '64b7f0c2a1b2c3d4e5f60730', name: 'Diner', role: 'user' }

// A stand-in for a mongoose query: chaining returns itself, awaiting gives the result
function fakeQuery(result) {
  return {
    populate() { return this },
    sort() { return this },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject) }
  }
}

// Starts the real app on a free port
async function startServer(t) {
  const server = app.listen(0)
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  return `http://127.0.0.1:${server.address().port}`
}

// protect() looks the user up again, so User.findById returns them
function loginAs(t) {
  t.mock.method(User, 'findById', async () => user)
  return { Cookie: `${AUTH_COOKIE}=${signToken(user)}` }
}

const send = (url, method, headers, body) => fetch(url, {
  method,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body && JSON.stringify(body)
})

test('every favourites route needs a login', async (t) => {
  const base = await startServer(t)
  const calls = [
    ['GET', '/api/favourites'],
    ['POST', '/api/favourites'],
    ['PATCH', `/api/favourites/${FAVOURITE_ID}/alert`],
    ['DELETE', `/api/favourites/${FAVOURITE_ID}`]
  ]

  for (const [method, path] of calls) {
    const response = await send(`${base}${path}`, method, {})
    assert.equal(response.status, 401, `${method} ${path}`)
  }
})

test('GET /api/favourites lists only the logged-in user\'s favourites', async (t) => {
  const headers = loginAs(t)
  const find = t.mock.method(Favourite, 'find', () => fakeQuery([{ _id: FAVOURITE_ID, targetType: 'Stall' }]))

  const base = await startServer(t)
  const body = await (await send(`${base}/api/favourites`, 'GET', headers)).json()

  assert.equal(body.success, true)
  assert.equal(body.data.length, 1)
  // The filter is what stops one user seeing another user's list
  assert.equal(String(find.mock.calls[0].arguments[0].user), user._id)
})

test('POST /api/favourites rejects a bad targetType or a missing target', async (t) => {
  const headers = loginAs(t)
  const base = await startServer(t)

  const badType = await send(`${base}/api/favourites`, 'POST', headers, { targetType: 'Shop', target: STALL_ID })
  assert.equal(badType.status, 400)

  const noTarget = await send(`${base}/api/favourites`, 'POST', headers, { targetType: 'Stall' })
  assert.equal(noTarget.status, 400)
})

test('POST /api/favourites gives 404 for a stall that does not exist or was removed', async (t) => {
  const headers = loginAs(t)
  const exists = t.mock.method(Stall, 'exists', async () => null)

  const base = await startServer(t)
  const response = await send(`${base}/api/favourites`, 'POST', headers, { targetType: 'Stall', target: STALL_ID })

  assert.equal(response.status, 404)
  // Removed stalls (isActive: false) can't be favourited
  assert.equal(exists.mock.calls[0].arguments[0].isActive, true)
})

test('POST /api/favourites saves the favourite for the logged-in user', async (t) => {
  const headers = loginAs(t)
  t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }))
  const create = t.mock.method(Favourite, 'create', async (doc) => ({ _id: FAVOURITE_ID, ...doc }))

  const base = await startServer(t)
  const response = await send(`${base}/api/favourites`, 'POST', headers, { targetType: 'Stall', target: STALL_ID })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.data.targetType, 'Stall')
  // The owner comes from the login cookie, never from the request body
  assert.equal(String(create.mock.calls[0].arguments[0].user), user._id)
})

test('POST /api/favourites gives 409 when it is already a favourite', async (t) => {
  const headers = loginAs(t)
  t.mock.method(Stall, 'exists', async () => ({ _id: STALL_ID }))
  // The unique index on user + target makes MongoDB throw error code 11000
  t.mock.method(Favourite, 'create', async () => {
    throw Object.assign(new Error('duplicate'), { code: 11000, keyValue: { target: STALL_ID } })
  })

  const base = await startServer(t)
  const response = await send(`${base}/api/favourites`, 'POST', headers, { targetType: 'Stall', target: STALL_ID })

  assert.equal(response.status, 409)
})

test('PATCH /api/favourites/:id/alert only changes the fields that were sent', async (t) => {
  const headers = loginAs(t)
  const update = t.mock.method(Favourite, 'findOneAndUpdate', async () => ({
    _id: FAVOURITE_ID,
    alert: { enabled: false, days: [1, 5], time: '11:30' }
  }))

  const base = await startServer(t)
  const response = await send(`${base}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { enabled: false })

  assert.equal(response.status, 200)
  const [filter, changes] = update.mock.calls[0].arguments
  assert.equal(String(filter.user), user._id) // only your own favourite
  assert.deepEqual(changes, { $set: { 'alert.enabled': false } }) // saved days and time are kept
})

test('PATCH /api/favourites/:id/alert gives 400 for an invalid time', async (t) => {
  const headers = loginAs(t)
  t.mock.method(Favourite, 'findOneAndUpdate', async () => {
    const err = new mongoose.Error.ValidationError()
    err.addError('alert.time', new mongoose.Error.ValidatorError({ message: 'Alert time must be HH:mm' }))
    throw err
  })

  const base = await startServer(t)
  const response = await send(`${base}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { time: '25:00' })
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.message, 'Alert time must be HH:mm')
})

test('PATCH and DELETE give 404 for a favourite that is not yours or does not exist', async (t) => {
  const headers = loginAs(t)
  t.mock.method(Favourite, 'findOneAndUpdate', async () => null)
  t.mock.method(Favourite, 'findOneAndDelete', async () => null)

  const base = await startServer(t)
  const patch = await send(`${base}/api/favourites/${FAVOURITE_ID}/alert`, 'PATCH', headers, { enabled: true })
  const remove = await send(`${base}/api/favourites/${FAVOURITE_ID}`, 'DELETE', headers)

  assert.equal(patch.status, 404)
  assert.equal(remove.status, 404)
})

test('DELETE /api/favourites/:id removes your favourite and returns its id', async (t) => {
  const headers = loginAs(t)
  const remove = t.mock.method(Favourite, 'findOneAndDelete', async () => ({ _id: FAVOURITE_ID }))

  const base = await startServer(t)
  const body = await (await send(`${base}/api/favourites/${FAVOURITE_ID}`, 'DELETE', headers)).json()

  assert.deepEqual(body, { success: true, data: { id: FAVOURITE_ID } })
  assert.equal(String(remove.mock.calls[0].arguments[0].user), user._id)
})
