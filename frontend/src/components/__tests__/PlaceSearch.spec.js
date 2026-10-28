import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlaceSearch from '@/components/PlaceSearch.vue'
import { searchPlaces } from '@/services/locationService.js'

// The real searchPlaces asks the backend (and OneMap); here it is replaced with a fake
vi.mock('@/services/locationService.js', () => ({ searchPlaces: vi.fn() }))

const ADAM = { name: 'ADAM FOOD CENTRE', address: '2 ADAM ROAD ADAM FOOD CENTRE SINGAPORE 289876', postalCode: '289876', lat: 1.3241, lng: 103.8141 }
const BEDOK_MRT = { name: 'BEDOK MRT STATION', address: '315 NEW UPPER CHANGI ROAD', postalCode: '467347', lat: 1.324, lng: 103.93 }
const BEDOK_CAMP = { name: 'BEDOK CAMP', address: '1 BEDOK NORTH ROAD', postalCode: null, lat: 1.33, lng: 103.94 }

async function searchFor(wrapper, text) {
  await wrapper.find('input').setValue(text)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('PlaceSearch', () => {
  beforeEach(() => {
    searchPlaces.mockReset()
  })

  it('picks the place straight away for a postal code', async () => {
    searchPlaces.mockResolvedValue([ADAM])
    const wrapper = mount(PlaceSearch)

    await searchFor(wrapper, ' 289876 ')

    expect(searchPlaces).toHaveBeenCalledWith('289876')
    expect(wrapper.emitted('picked')[0][0]).toMatchObject({ lat: 1.3241, lng: 103.8141, label: 'ADAM FOOD CENTRE (289876)' })
  })

  it('lets the user choose when a place name has several matches', async () => {
    searchPlaces.mockResolvedValue([BEDOK_MRT, BEDOK_CAMP])
    const wrapper = mount(PlaceSearch)

    await searchFor(wrapper, 'bedok')
    expect(wrapper.emitted('picked')).toBeUndefined()

    const choices = wrapper.findAll('.list-group-item')
    expect(choices).toHaveLength(2)
    await choices[1].trigger('click')

    // A place without a postal code is labelled by its name only
    expect(wrapper.emitted('picked')[0][0]).toMatchObject({ name: 'BEDOK CAMP', label: 'BEDOK CAMP' })
  })

  it('says so when nothing matches, and does not search for 1 character', async () => {
    searchPlaces.mockResolvedValue([])
    const wrapper = mount(PlaceSearch)

    await searchFor(wrapper, 'x')
    expect(searchPlaces).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toContain('Enter a postal code')

    await searchFor(wrapper, 'zzzz')
    expect(wrapper.find('[role="alert"]').text()).toContain('No place in Singapore matches "zzzz"')
  })

  it('shows the chosen place with a Clear button instead of the search box', async () => {
    const wrapper = mount(PlaceSearch, { props: { place: { ...ADAM, label: 'ADAM FOOD CENTRE (289876)' } } })

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('ADAM FOOD CENTRE (289876)')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('cleared')).toHaveLength(1)
  })
})
