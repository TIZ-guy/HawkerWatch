// Journey 6: a diner opens the map, sees a marker for each hawker centre and picks one.
import { test, expect } from './support/helpers.js'
import { ALPHA, CENTRES } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 6: map page', () => {
  test('the map shows a marker for every centre and a centre can be selected', async ({ page }) => {
    await test.step('Open the map', async () => {
      await page.goto('/')
      await page.getByRole('link', { name: 'Map', exact: true }).click()
      await expect(page).toHaveURL('/map')
    })

    await test.step('See one marker and one list entry per centre', async () => {
      // Leaflet draws the markers itself, so they can't carry a data-testid
      const markers = page.getByTestId('map-container').locator('path.leaflet-interactive')
      await expect(markers).toHaveCount(CENTRES.length)
      await expect(page.getByTestId('map-centre-item')).toHaveCount(CENTRES.length)
    })

    await test.step('Select a centre from the list and see its details', async () => {
      await page.getByTestId('map-centre-item').filter({ hasText: ALPHA.name }).click()
      await expect(page.getByTestId('centre-card')).toContainText(ALPHA.name)
    })

    await test.step('Follow the card to the centre page', async () => {
      await page.getByTestId('centre-card-link').click()
      await expect(page.getByTestId('centre-name')).toHaveText(ALPHA.name)
    })
  })
})
