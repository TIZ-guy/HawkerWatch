// The only database the E2E seed may touch. It clears every collection, so anything else must be refused.
export const E2E_DB_NAME = 'hawker-watch-e2e'

export function assertE2eDatabase(name) {
  if (name !== E2E_DB_NAME) {
    throw new Error(`Refusing to run: the E2E seed only works on "${E2E_DB_NAME}", not "${name}"`)
  }
}
