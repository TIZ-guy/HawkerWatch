import { test as base } from '@playwright/test'
import { API_URL } from './env.js'

// Every spec imports this `test`. Outside requests (map tiles, web fonts) are blocked, so results
// don't depend on the internet or on those services being up.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route((url) => url.hostname !== 'localhost', (route) => route.abort())
    await use(page)
  }
})

export { expect } from '@playwright/test'

let userCount = 0

// Text that is different on every run, so reruns against the same database still pass
export const uniqueId = () => `${Date.now()}-${++userCount}`

export function newUser() {
  const id = uniqueId()
  return { name: `E2E Diner ${id}`, email: `e2e-${id}@example.com`, password: 'Hawker#Run1' }
}

// Creates an account and logs the page in through the API, for journeys that aren't about logging in.
// page.request shares cookies with the page, so the app sees this user as logged in.
export async function logInAsNewUser(page) {
  const user = newUser()
  const response = await page.request.post(`${API_URL}/auth/register`, { data: user })
  if (!response.ok()) throw new Error(`Could not create the test user: ${response.status()}`)
  return user
}

// Opens a seeded centre the way a diner would: from a search on the home page.
export async function openCentre(page, name) {
  await page.goto('/')
  await page.getByTestId('home-search').getByRole('searchbox').fill(name)
  await page.getByTestId('home-search-button').click()
  await page.getByTestId('centre-card-link').filter({ hasText: name }).click()
  await base.expect(page.getByTestId('centre-name')).toHaveText(name)
}
