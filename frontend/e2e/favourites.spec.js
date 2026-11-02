// Journey 5: a diner saves a hawker centre, sets a reminder, then finds both on the
// Saved and Profile pages.
import { test, expect, logInAsNewUser, openCentre } from './support/helpers.js'
import { BETA } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 5: favourite a centre and set a reminder', () => {
  const headerButton = (page) => page.getByTestId('centre-header').getByTestId('favourite-button')

  test('a saved centre and its reminder appear on Saved and Profile', async ({ page }) => {
    await test.step('Log in and start with nothing saved', async () => {
      await logInAsNewUser(page)
      await page.goto('/favourites')
      await expect(page.getByTestId('favourites-empty')).toBeVisible()
    })

    await test.step('Save the centre', async () => {
      await openCentre(page, BETA.name)
      await headerButton(page).click()
      await expect(headerButton(page)).toHaveAttribute('aria-pressed', 'true')
    })

    await test.step('Set a reminder for Monday and Wednesday at 11:30 am', async () => {
      const reminder = page.getByTestId('centre-reminder')
      await reminder.getByTestId('reminder-enabled').check()
      await reminder.getByTestId('reminder-day-1').click()
      await reminder.getByTestId('reminder-day-3').click()
      await reminder.getByTestId('reminder-time').fill('11:30')
      await reminder.getByTestId('reminder-save').click()
      await expect(reminder.getByTestId('reminder-message')).toHaveText('Saved: Mon, Wed at 11:30 am')
    })

    await test.step('See the centre and reminder on the Saved page', async () => {
      await page.goto('/favourites')
      const card = page.getByTestId('centre-card').filter({ hasText: BETA.name })
      await expect(card.getByTestId('favourite-reminder')).toContainText('Mon, Wed at 11:30 am')
    })

    await test.step('See the same reminder on the Profile page', async () => {
      await page.goto('/profile')
      const reminder = page.getByTestId('profile-reminders').getByTestId('reminder-editor')
      await expect(reminder).toContainText(BETA.name)
      await expect(reminder.getByTestId('reminder-enabled')).toBeChecked()
      await expect(reminder.getByTestId('reminder-time')).toHaveValue('11:30')
    })
  })

  test('a reminder needs at least one day and a time', async ({ page }) => {
    await test.step('Save the centre', async () => {
      await logInAsNewUser(page)
      await openCentre(page, BETA.name)
      await headerButton(page).click()
    })

    await test.step('Turn the reminder on without choosing a day or time', async () => {
      const reminder = page.getByTestId('centre-reminder')
      await reminder.getByTestId('reminder-enabled').check()
      await reminder.getByTestId('reminder-save').click()
      await expect(reminder.getByRole('alert')).toHaveText('Pick at least one day and a time, or turn the reminder off.')
    })
  })

  test('removing a favourite takes it off the Saved page', async ({ page }) => {
    await test.step('Save the centre, then remove it', async () => {
      await logInAsNewUser(page)
      await openCentre(page, BETA.name)
      await headerButton(page).click()
      await expect(headerButton(page)).toHaveAttribute('aria-pressed', 'true')
      await headerButton(page).click()
      await expect(headerButton(page)).toHaveAttribute('aria-pressed', 'false')
    })

    await test.step('The Saved page is empty', async () => {
      await page.goto('/favourites')
      await expect(page.getByTestId('favourites-empty')).toBeVisible()
    })
  })

  test('a logged-out visitor is sent to log in when saving', async ({ page }) => {
    await test.step('Select the heart while logged out', async () => {
      await openCentre(page, BETA.name)
      await headerButton(page).click()
    })

    await test.step('Arrive at the login page', async () => {
      await expect(page).toHaveURL(/\/login\?redirect=/)
    })
  })
})
