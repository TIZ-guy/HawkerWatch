// Journey 8: an admin approves a stall a diner added, deletes the diner's comment, suspends the diner
// (who then can't post), and finds all of it in the activity log.
import { request as playwrightRequest } from '@playwright/test'
import { test, expect, newUser, uniqueId } from './support/helpers.js'
import { API_URL } from './support/env.js'
import { ADMIN_USER, BETA } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 8: admin page', () => {
  let diner // a separate API session with its own login cookie, standing in for the diner's phone
  let dinerUser
  let centreId

  test.beforeEach(async () => {
    diner = await playwrightRequest.newContext()
    dinerUser = newUser()
    expect((await diner.post(`${API_URL}/auth/register`, { data: dinerUser })).ok()).toBe(true)
    const centres = await (await diner.get(`${API_URL}/hawker-centres`, { params: { search: BETA.name } })).json()
    centreId = centres.data[0]._id
  })

  test.afterEach(async () => {
    await diner.dispose()
  })

  test('approve, moderate, suspend, and see it all in the activity log', async ({ page }) => {
    const stallName = `E2E Pending ${uniqueId()}`
    const commentText = `E2E spam comment ${uniqueId()}`

    await test.step('The diner adds a stall and posts a comment', async () => {
      const stall = await diner.post(`${API_URL}/hawker-centres/${centreId}/stalls`, { data: { name: stallName } })
      expect((await stall.json()).data.pendingApproval).toBe(true)
      expect((await diner.post(`${API_URL}/hawker-centres/${centreId}/comments`, { data: { text: commentText } })).ok()).toBe(true)
    })

    await test.step('The admin logs in and sees the Admin link', async () => {
      expect((await page.request.post(`${API_URL}/auth/login`, { data: ADMIN_USER })).ok()).toBe(true)
      await page.goto('/')
      await page.getByTestId('nav-admin').click()
      await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()
    })

    await test.step('Approve the stall', async () => {
      const row = page.getByTestId('admin-pending-stall').filter({ hasText: stallName })
      await row.getByRole('button', { name: 'Approve' }).click()
      await expect(page.getByRole('status')).toContainText(`${stallName} is now listed`)
      await expect(row).toHaveCount(0)
    })

    await test.step('Delete the comment from the moderation queue', async () => {
      await page.getByRole('tab', { name: 'Moderation' }).click()
      await page.getByRole('group', { name: 'What to moderate' }).getByRole('button', { name: 'Comments' }).click()
      const row = page.getByTestId('admin-moderation-item').filter({ hasText: commentText })
      await row.getByRole('button', { name: 'Delete' }).click()
      await row.getByRole('group').getByRole('button', { name: 'Delete' }).click()
      await expect(row).toHaveCount(0)
    })

    await test.step('Open the author from Users and suspend them for 7 days', async () => {
      await page.getByRole('tab', { name: 'Users' }).click()
      await page.getByRole('searchbox').fill(dinerUser.email)
      const row = page.getByTestId('admin-user').filter({ hasText: dinerUser.email })
      await expect(row).toHaveCount(1)
      await row.getByRole('button', { name: 'Suspend' }).click()
      await row.getByPlaceholder('Reason, shown to the user (optional)').fill('Spam comments')
      await row.getByRole('group', { name: /Stop .* posting/ }).getByRole('button', { name: 'Suspend' }).click()
      await expect(row).toContainText('Suspended until')
      await expect(row).toContainText('Reason: Spam comments')
    })

    await test.step('The suspended diner can no longer post, and is told why', async () => {
      const response = await diner.post(`${API_URL}/hawker-centres/${centreId}/comments`, { data: { text: 'Another one' } })
      expect(response.status()).toBe(403)
      expect((await response.json()).message).toContain('Reason: Spam comments')
    })

    await test.step('The activity log has all three actions, newest first', async () => {
      await page.getByRole('tab', { name: 'Activity log' }).click()
      const entries = page.getByTestId('admin-activity-entry')
      await expect(entries.nth(0)).toContainText(`Suspended ${dinerUser.name}`)
      await expect(entries.nth(1)).toContainText(`Deleted a comment: "${commentText}"`)
      await expect(entries.nth(2)).toContainText(`Approved stall "${stallName}"`)
    })
  })

  test('action buttons line up on every row, however long the details are', async ({ page }) => {
    await diner.post(`${API_URL}/hawker-centres/${centreId}/stalls`, {
      data: { name: `E2E Long ${uniqueId()}`, speciality: 'Char siew and roast pork rice with extra sauce', cuisine: 'Chinese', unitNumber: '01-99' }
    })
    await diner.post(`${API_URL}/hawker-centres/${centreId}/stalls`, { data: { name: `E2E Short ${uniqueId()}` } })

    await page.setViewportSize({ width: 900, height: 900 })
    expect((await page.request.post(`${API_URL}/auth/login`, { data: ADMIN_USER })).ok()).toBe(true)
    await page.goto('/admin')

    const buttons = page.getByTestId('admin-pending-stall').getByRole('button', { name: 'Reject' })
    await expect(buttons.nth(1)).toBeVisible()
    const boxes = await Promise.all([0, 1].map((index) => buttons.nth(index).boundingBox()))
    const rows = await Promise.all([0, 1].map((index) => page.getByTestId('admin-pending-stall').nth(index).boundingBox()))

    // Same distance from the left of the page, and at the top of each row
    expect(Math.abs(boxes[0].x - boxes[1].x)).toBeLessThan(1)
    for (const index of [0, 1]) expect(boxes[index].y - rows[index].y).toBeLessThan(30)
  })
})
