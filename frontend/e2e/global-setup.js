// Runs once before the tests: resets hawker-watch-e2e to the fixed data in backend/scripts/e2eFixtures.js.
// The script checks the database name itself, before connecting.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { E2E_DB_NAME } from './support/env.js'

export default function globalSetup() {
  execFileSync(process.execPath, ['scripts/seedE2e.js'], {
    cwd: fileURLToPath(new URL('../../backend', import.meta.url)),
    env: { ...process.env, MONGO_DB_NAME: E2E_DB_NAME, NODE_ENV: 'development' },
    stdio: 'inherit'
  })
}
