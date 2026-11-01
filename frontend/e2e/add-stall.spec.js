// Journey 7: a logged-in diner adds a stall that isn't listed yet and sees it on the centre page.
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

  test('a new stall appears in the list and stays after a reload', async ({ page }) => {
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

    await test.step('See the stall in the list straight away', async () => {
      await expect(page.getByTestId('stall-added-message')).toContainText(stallName)
      await expect(stallRow(page, stallName)).toContainText('Fish soup')
      await expect(listedCount).toHaveText(String(countBefore + 1))
    })

    await test.step('Reload and see that it was saved', async () => {
      await page.reload()
      await expect(stallRow(page, stallName)).toBeVisible()
    })
  })

  test('the same stall name cannot be added twice', async ({ page }) => {
    const stallName = `E2E Duplicate ${uniqueId()}`

    await test.step('Add a stall', async () => {
      await logInAsNewUser(page)
      await openCentre(page, BETA.name)
      await submitStall(page, stallName)
      await expect(stallRow(page, stallName)).toBeVisible()
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
