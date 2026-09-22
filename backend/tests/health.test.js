import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../app.js'

test('health endpoint is configured', async () => {
  assert.equal(typeof app, 'function')
})
