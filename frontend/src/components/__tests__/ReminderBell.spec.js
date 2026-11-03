import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReminderBell from '@/components/ReminderBell.vue'
import { useFavouriteStore } from '@/stores/useFavouriteStore.js'

// Pretend backend, so mounting the bell never calls a real server
vi.mock('@/services/favouriteService.js', () => ({ getFavourites: vi.fn() }))

const THURSDAY = 4
const due = (name, targetType = 'Stall') => ({
  _id: name,
  targetType,
  target: { _id: name, name },
  alert: { enabled: true, days: [THURSDAY], time: '11:30' }
})

function mountBell(items) {
  const favourites = useFavouriteStore()
  favourites.items = items
  // RouterLink is stubbed because these tests don't load the router (RouterLinkStub still shows the link text)
  return mount(ReminderBell, { global: { stubs: { RouterLink: RouterLinkStub } } })
}

describe('ReminderBell', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 29, 12, 0)) // Thursday 12:00 pm
  })

  afterEach(() => vi.useRealTimers())

  it('shows one reminder listing every favourite due at that time, one per line', async () => {
    // A centre name with a comma in it, like the real NEA names
    const wrapper = mountBell([due('Aljunied Ave 2 (Blk 117, Market)', 'HawkerCentre'), due('Chicken Rice')])

    expect(wrapper.find('.badge').text()).toBe('2') // two favourites due
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('11:30 am reminder')
    const lines = wrapper.findAll('li').map((line) => line.text())
    expect(lines).toEqual(['Aljunied Ave 2 (Blk 117, Market)', 'Chicken Rice'])
  })

  it('hides a reminder once dismissed, even after a refresh', async () => {
    const wrapper = mountBell([due('Sample Laksa')])
    await wrapper.find('button').trigger('click')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Dismiss')
      .trigger('click')

    expect(wrapper.find('.badge').exists()).toBe(false)
    expect(
      mountBell([due('Sample Laksa')])
        .find('.badge')
        .exists()
    ).toBe(false)
  })

  it('appears once the reminder time arrives', async () => {
    vi.setSystemTime(new Date(2026, 9, 29, 11, 29, 50))
    const wrapper = mountBell([due('Sample Laksa')])
    expect(wrapper.find('.badge').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(30 * 1000) // the bell checks the clock every 30 seconds

    expect(wrapper.find('.badge').text()).toBe('1')
  })
})
