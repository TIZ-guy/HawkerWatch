import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import app from '../app.js'
import { errorHandler } from '../middleware/errorMiddleware.js'

// A tiny stand-in for Express's res object that records what was sent.
function fakeRes() {
  return {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

test('errorHandler turns a bad id into a 400 naming the field', () => {
  const res = fakeRes()
  const err = new mongoose.Error.CastError('ObjectId', 'not-an-id', 'stall')
  errorHandler(err, {}, res, () => {})
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { success: false, message: 'Invalid stall' })
})

test('errorHandler hides 500 details in production only', (t) => {
  t.mock.method(console, 'error', () => {}) // keep the test output clean
  const original = process.env.NODE_ENV
  t.after(() => {
    if (original === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = original
  })

  process.env.NODE_ENV = 'production'
  const hidden = fakeRes()
  errorHandler(new Error('database password in here'), {}, hidden, () => {})
  assert.equal(hidden.statusCode, 500)
  assert.equal(hidden.body.message, 'Something went wrong')

  process.env.NODE_ENV = 'development'
  const shown = fakeRes()
  errorHandler(new Error('database password in here'), {}, shown, () => {})
  assert.equal(shown.body.message, 'database password in here')
})

// Starts the real app on a free port and calls it over HTTP, so no extra packages are needed.
test('the app answers unknown routes and bad JSON in the shared error shape', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  const missing = await fetch(`${base}/api/does-not-exist`)
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { success: false, message: 'Route not found' })

  const badJson = await fetch(`${base}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json'
  })
  assert.equal(badJson.status, 400)
  const body = await badJson.json()
  assert.equal(body.success, false)
  assert.equal(typeof body.message, 'string')
})
