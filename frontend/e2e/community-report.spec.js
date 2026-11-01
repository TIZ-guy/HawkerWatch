// Journey 4: a logged-in diner standing at a hawker centre reports a stall's queue,
// and other diners can see it. Playwright's geolocation stands in for the phone's location.
import { test, expect, logInAsNewUser, openCentre } from './support/helpers.js'
import { ALPHA, BETA, QUIET_STALL, REPORT_TARGET_STALL } from '../../backend/scripts/e2eFixtures.js'

// About 50 m from the centre, inside the 200 m limit
const AT_THE_CENTRE = { latitude: ALPHA.lat + 0.0004, longitude: ALPHA.lng + 0.0002 }
const FAR_AWAY = { latitude: BETA.lat, longitude: BETA.lng }

test.describe('Journey 4: submit a community report', () => {
  test.use({ permissions: ['geolocation'], geolocation: AT_THE_CENTRE })

  async function fillInReport(page, stall) {
    await page.getByTestId('report-stall-select').selectOption({ label: `${stall.name} (#${stall.unitNumber})` })
    await page.getByTestId('report-status-SHORT_QUEUE').click()
    await page.getByTestId('report-submit').click()
  }

  test.beforeEach(async ({ page }) => {
    await logInAsNewUser(page)
    await openCentre(page, ALPHA.name)
  })

  test('a diner at the centre can report a queue and everyone can see it', async ({ page }) => {
    await test.step('Choose a stall and a status, then submit', async () => {
      await fillInReport(page, REPORT_TARGET_STALL)
    })

    await test.step('See the thank-you and the new status on the stall', async () => {
      await expect(page.getByTestId('report-thanks')).toContainText(REPORT_TARGET_STALL.name)
      await expect(page.getByTestId('stall-row').filter({ hasText: REPORT_TARGET_STALL.name })).toContainText('Short queue')
    })

    await test.step('See the report on the Community reports page', async () => {
      await page.getByRole('link', { name: 'Reports' }).click()
      // Newest first, and other diners may have reported this stall too
      const report = page.getByTestId('report-feed-item').filter({ hasText: REPORT_TARGET_STALL.name }).first()
      await expect(report).toContainText('Short queue')
      await expect(report).toContainText(ALPHA.name)
    })
  })

  test('a diner more than 200 m away is refused', async ({ page, context }) => {
    await test.step('Move far from the centre', async () => {
      await context.setGeolocation(FAR_AWAY)
    })

    await test.step('Try to submit a report', async () => {
      await fillInReport(page, QUIET_STALL)
    })

    await test.step('See why it was refused, with nothing saved', async () => {
      await expect(page.getByTestId('report-error')).toContainText(`You need to be at ${ALPHA.name}`)
      await expect(page.getByTestId('stall-row').filter({ hasText: QUIET_STALL.name })).toContainText('No reports')
    })
  })
})
