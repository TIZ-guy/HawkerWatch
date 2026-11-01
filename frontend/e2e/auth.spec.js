// Journey 1: a new diner registers, logs out and logs back in.
// Also covers the error messages and the login-only pages.
import { test, expect, newUser } from './support/helpers.js'
import { DEMO_USER } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 1: register, log in and log out', () => {
  test('a new user can register, log out and log back in', async ({ page }) => {
    const user = newUser()

    await test.step('Register a new account', async () => {
      await page.goto('/register')
      await page.getByTestId('register-name').fill(user.name)
      await page.getByTestId('register-email').fill(user.email)
      await page.getByTestId('register-password').fill(user.password)
      await page.getByTestId('register-confirm').fill(user.password)
      await page.getByTestId('register-submit').click()
    })

    await test.step('Land on the home page, logged in', async () => {
      await expect(page).toHaveURL('/')
      await expect(page.getByTestId('nav-user-name')).toHaveText(user.name)
    })

    await test.step('Log out', async () => {
      await page.getByTestId('nav-logout').click()
      await expect(page.getByTestId('nav-login')).toBeVisible()
      await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
    })

    await test.step('Log back in with the same details', async () => {
      await page.getByTestId('nav-login').click()
      await page.getByTestId('login-email').fill(user.email)
      await page.getByTestId('login-password').fill(user.password)
      await page.getByTestId('login-submit').click()
      await expect(page.getByTestId('nav-user-name')).toHaveText(user.name)
    })

    await test.step('The profile shows the account', async () => {
      await page.getByRole('link', { name: 'Profile' }).click()
      await expect(page.getByTestId('profile-email')).toHaveText(user.email)
    })
  })

  test('a wrong password is refused', async ({ page }) => {
    await test.step('Log in with the wrong password', async () => {
      await page.goto('/login')
      await page.getByTestId('login-email').fill(DEMO_USER.email)
      await page.getByTestId('login-password').fill('Wrong#Password1')
      await page.getByTestId('login-submit').click()
    })

    await test.step('See the error and stay logged out', async () => {
      await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password')
      await expect(page.getByTestId('nav-login')).toBeVisible()
    })
  })

  test('an email that already has an account cannot register again', async ({ page }) => {
    await test.step('Register with the seeded user\'s email', async () => {
      const user = newUser()
      await page.goto('/register')
      await page.getByTestId('register-name').fill(user.name)
      await page.getByTestId('register-email').fill(DEMO_USER.email)
      await page.getByTestId('register-password').fill(user.password)
      await page.getByTestId('register-confirm').fill(user.password)
      await page.getByTestId('register-submit').click()
    })

    await test.step('See the error', async () => {
      await expect(page.getByTestId('register-error')).toHaveText('An account with this email already exists')
    })
  })

  test('a logged-out visitor is sent to log in and returned afterwards', async ({ page }) => {
    await test.step('Open a login-only page', async () => {
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/login\?redirect=/)
    })

    await test.step('Log in and return to that page', async () => {
      await page.getByTestId('login-email').fill(DEMO_USER.email)
      await page.getByTestId('login-password').fill(DEMO_USER.password)
      await page.getByTestId('login-submit').click()
      await expect(page).toHaveURL('/profile')
      await expect(page.getByTestId('profile-email')).toHaveText(DEMO_USER.email)
    })
  })
})
