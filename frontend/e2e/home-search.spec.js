// Journey 2: a diner searches and filters hawker centres on the home page.
import { test, expect } from './support/helpers.js'
import { ALPHA, BETA, BETA_STALL, CENTRES, GAMMA, REPORTED_STALL } from '../../backend/scripts/e2eFixtures.js'

test.describe('Journey 2: search and filter hawker centres', () => {
  const cards = (page) => page.getByTestId('centre-card')
  const quickFilter = (page, name) => page.getByTestId('home-quick-filters').getByRole('button', { name })

  async function search(page, text) {
    await page.getByTestId('home-search').getByRole('searchbox').fill(text)
    await page.getByTestId('home-search-button').click()
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(cards(page)).toHaveCount(CENTRES.length)
  })

  test('searching by name or address narrows the list', async ({ page }) => {
    await test.step('Search by centre name', async () => {
      await search(page, BETA.name)
      await expect(cards(page)).toHaveCount(1)
      await expect(cards(page)).toContainText(BETA.name)
    })

    await test.step('Search by address', async () => {
      await search(page, GAMMA.address)
      await expect(cards(page)).toHaveCount(1)
      await expect(cards(page)).toContainText(GAMMA.name)
    })
  })

  test('searching for a dish finds the stall that sells it', async ({ page }) => {
    await test.step('Search for a dish', async () => {
      await search(page, BETA_STALL.speciality)
    })

    await test.step('See the matching stall', async () => {
      await expect(page.getByTestId('home-stall-results')).toContainText(BETA_STALL.name)
    })
  })

  test('a search with no matches shows a message and can be cleared', async ({ page }) => {
    await test.step('Search for something that does not exist', async () => {
      await search(page, 'No such centre anywhere')
      await expect(page.getByTestId('home-no-results')).toBeVisible()
    })

    await test.step('Clear the filters', async () => {
      await page.getByRole('button', { name: 'Clear filters' }).click()
      await expect(cards(page)).toHaveCount(CENTRES.length)
    })
  })

  test('Open today hides a centre that is closed today', async ({ page }) => {
    await test.step('Turn on Open today', async () => {
      await quickFilter(page, 'Open today').click()
    })

    await test.step('The closed centre is gone', async () => {
      await expect(cards(page)).toHaveCount(CENTRES.length - 1)
      await expect(cards(page).filter({ hasText: GAMMA.name })).toHaveCount(0)
    })
  })

  test('Has live updates shows only centres with a live report', async ({ page }) => {
    await test.step('Turn on Has live updates', async () => {
      await quickFilter(page, 'Has live updates').click()
    })

    await test.step('Only the reported centre is left', async () => {
      await expect(cards(page)).toHaveCount(1)
      await expect(cards(page)).toContainText(ALPHA.name)
    })
  })

  test('a cuisine chip shows only centres with that cuisine', async ({ page }) => {
    await test.step('Choose Thai', async () => {
      await page.getByTestId('home-cuisine-filters').getByRole('button', { name: 'Thai' }).click()
    })

    await test.step('Only the centre with a Thai stall is left', async () => {
      await expect(cards(page)).toHaveCount(1)
      await expect(cards(page)).toContainText(GAMMA.name)
    })
  })
})

// Stall results are sorted by distance from the diner, with Playwright's geolocation standing in for the phone's.
test.describe('Journey 2b: stall results nearest first', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: BETA.lat, longitude: BETA.lng } })

  test('stalls at the closest centre come first, and A to Z sorts by name', async ({ page }) => {
    const stallCards = page.getByTestId('home-stall-results').getByRole('article')

    await test.step('Search for something every centre sells', async () => {
      await page.goto('/')
      await page.getByTestId('home-search').getByRole('searchbox').fill('a')
      await page.getByTestId('home-search-button').click()
    })

    await test.step('The stall at Beta Market, where the diner is, comes first with its distance', async () => {
      await expect(stallCards.first()).toContainText(BETA_STALL.name)
      await expect(stallCards.first().getByTestId('stall-distance')).toContainText('0 m')
      await expect(page.getByTestId('home-stall-results')).toContainText('Nearest first, from your location')
    })

    await test.step('A to Z puts the stalls in name order', async () => {
      await page.getByTestId('home-stall-sort').getByRole('button', { name: 'A to Z' }).click()
      await expect(stallCards.first()).toContainText(REPORTED_STALL.name)
    })
  })
})
