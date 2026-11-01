// Journey 3: a diner opens a hawker centre from the home page and reads its details,
// stalls, live queue status and official closures.
import { test, expect, openCentre } from './support/helpers.js'
import { ALPHA, GAMMA, QUIET_STALL, REPORTED_STALL } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 3: open a hawker centre page', () => {
  const stallRow = (page, name) => page.getByTestId('stall-row').filter({ hasText: name })

  test('a centre page shows its details, stalls and live status', async ({ page }) => {
    await test.step('Open the centre from the home page', async () => {
      await openCentre(page, ALPHA.name)
      await expect(page).toHaveURL(/\/hawker-centres\/[0-9a-f]{24}$/)
    })

    await test.step('See the address and the map', async () => {
      await expect(page.getByTestId('centre-header')).toContainText(ALPHA.address)
      await expect(page.getByTestId('centre-map')).toBeVisible()
    })

    await test.step('See the stalls and the live queue status', async () => {
      await expect(stallRow(page, REPORTED_STALL.name)).toContainText('Long queue')
      await expect(stallRow(page, QUIET_STALL.name)).toContainText('No reports')
    })
  })

  test('searching within a centre narrows its stalls', async ({ page }) => {
    await test.step('Open the centre', async () => {
      await openCentre(page, ALPHA.name)
    })

    await test.step('Search for a dish', async () => {
      await page.getByRole('searchbox', { name: 'Search this centre' }).fill(QUIET_STALL.speciality)
    })

    await test.step('Only the matching stall is left', async () => {
      await expect(page.getByTestId('stall-row')).toHaveCount(1)
      await expect(page.getByTestId('stall-row')).toContainText(QUIET_STALL.name)
    })
  })

  test('a closed centre shows the official closure', async ({ page }) => {
    await test.step('Open the closed centre', async () => {
      await openCentre(page, GAMMA.name)
    })

    await test.step('See the closure notice', async () => {
      await expect(page.getByTestId('centre-closure-alert')).toContainText('Closed today for cleaning')
    })
  })
})
