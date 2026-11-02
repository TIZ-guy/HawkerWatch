import test from 'node:test'
import assert from 'node:assert/strict'
import { assertE2eDatabase, E2E_DB_NAME } from '../utils/e2eGuard.js'

test('the E2E guard accepts only the exact E2E database name', () => {
  assert.doesNotThrow(() => assertE2eDatabase(E2E_DB_NAME))

  for (const name of ['hawker-watch', 'hawker-watch-e2e ', 'HAWKER-WATCH-E2E', 'hawker-watch-e2e-2', '', undefined]) {
    assert.throws(() => assertE2eDatabase(name), /Refusing to run/, `should refuse ${JSON.stringify(name)}`)
  }
})
