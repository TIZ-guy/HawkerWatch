import test from 'node:test'
import assert from 'node:assert/strict'
import { dbName, DEFAULT_DB_NAME } from '../config/db.js'

test('dbName uses the shared database unless MONGO_DB_NAME is set', (t) => {
  const original = process.env.MONGO_DB_NAME
  t.after(() => {
    if (original === undefined) delete process.env.MONGO_DB_NAME
    else process.env.MONGO_DB_NAME = original
  })

  delete process.env.MONGO_DB_NAME
  assert.equal(dbName(), DEFAULT_DB_NAME)

  process.env.MONGO_DB_NAME = '  '
  assert.equal(dbName(), DEFAULT_DB_NAME)

  process.env.MONGO_DB_NAME = 'hawker-watch-ryan'
  assert.equal(dbName(), 'hawker-watch-ryan')
})
