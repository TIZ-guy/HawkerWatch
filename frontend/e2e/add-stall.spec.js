// Journey 7: a logged-in diner adds a stall that isn't listed yet. It waits for an admin to approve it
// (on the Admin page) before it shows on the centre page.
import { test, expect, logInAsNewUser, openCentre, uniqueId } from './support/helpers.js'
import { BETA } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 7: add a stall to a hawker centre', () => {
  const stallRow = (page, name) => page.getByTestId('stall-row').filter({ hasText: name })

  async function submitStall(page, name) {
    await page.getByTestId('add-stall-button').click()
    await page.getByTestId('stall-form-name').fill(name)
    await page.getByTestId('stall-form-speciality').fill('Fish soup')
    await page.getByTestId('stall-form-cuisine').selectOption('Chinese')
    await page.getByTestId('stall-form-submit').click()
  }

  test('a new stall is sent for approval instead of appearing straight away', async ({ page }) => {
    const stallName = `E2E Fish Soup ${uniqueId()}`
    const listedCount = page.getByTestId('centre-listed-count')
    let countBefore

    await test.step('Log in and open the centre', async () => {
      await logInAsNewUser(page)
      await openCentre(page, BETA.name)
      await expect(page.getByTestId('stall-row').first()).toBeVisible()
      countBefore = Number(await listedCount.textContent())
    })

    await test.step('Fill in the form and add the stall', async () => {
      await submitStall(page, stallName)
    })

    await test.step('Be told it is waiting for an admin', async () => {
      await expect(page.getByTestId('stall-added-message')).toContainText(stallName)
      await expect(page.getByTestId('stall-added-message')).toContainText('approved')
      await expect(stallRow(page, stallName)).toHaveCount(0)
      await expect(listedCount).toHaveText(String(countBefore))
    })

    await test.step('Reload and see it is still not listed', async () => {
      await page.reload()
      await expect(page.getByTestId('stall-row').first()).toBeVisible()
      await expect(stallRow(page, stallName)).toHaveCount(0)
    })
  })

  test('the same stall name cannot be added twice, even while the first waits for approval', async ({ page }) => {
    const stallName = `E2E Duplicate ${uniqueId()}`

    await test.step('Add a stall', async () => {
      await logInAsNewUser(page)
      await openCentre(page, BETA.name)
      await submitStall(page, stallName)
      await expect(page.getByTestId('stall-added-message')).toContainText(stallName)
    })

    await test.step('Add it again and see the error', async () => {
      await submitStall(page, stallName)
      await expect(page.getByTestId('stall-form-error')).toBeVisible()
    })
  })

  test('a logged-out visitor is sent to log in first', async ({ page }) => {
    await test.step('Select Add a stall while logged out', async () => {
      await openCentre(page, BETA.name)
      await page.getByTestId('add-stall-button').click()
    })

    await test.step('Arrive at the login page', async () => {
      await expect(page).toHaveURL(/\/login\?redirect=/)
    })
  })
})
