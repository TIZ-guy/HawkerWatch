import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import FoodUpdateForm from '@/components/FoodUpdateForm.vue'
import { getReportSettings } from '@/services/reportService.js'
import { submitFoodUpdate } from '@/services/foodUpdateService.js'
import { getCurrentPosition } from '@/services/locationService.js'

// The real services talk to the backend and the browser's location; here they are replaced with fakes.
// distanceKm and formatDistance stay real, so the "too far" check is the real one.
vi.mock('@/services/reportService.js', () => ({ getReportSettings: vi.fn() }))
vi.mock('@/services/foodUpdateService.js', () => ({ submitFoodUpdate: vi.fn() }))
vi.mock('@/services/locationService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCurrentPosition: vi.fn()
}))

const STALL = { _id: 'stall-1', name: 'Sample Laksa' }
const CENTRE = { name: 'Kampong Demo Food Centre', location: { coordinates: [103.8198, 1.3521] } }
const NEAR = { lat: 1.3521, lng: 103.8198, accuracy: 10 }
const FAR = { lat: 1.3621, lng: 103.8198, accuracy: 10 } // about 1.1 km away

async function mountForm() {
  const wrapper = mount(FoodUpdateForm, { props: { stall: STALL, centre: CENTRE } })
  await flushPromises() // lets the settings request finish
  return wrapper
}

async function submitWith(wrapper, { type, note } = {}) {
  if (type) await wrapper.find(`input[value="${type}"]`).setValue()
  if (note !== undefined) await wrapper.find('input[type="text"]').setValue(note)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('FoodUpdateForm', () => {
  beforeEach(() => {
    getReportSettings.mockReset().mockResolvedValue({ locationCheck: true, maxDistanceMetres: 200 })
    submitFoodUpdate.mockReset()
    getCurrentPosition.mockReset()
  })

  it('asks the user to choose what the food is like before doing anything else', async () => {
    const wrapper = await mountForm()

    await submitWith(wrapper)

    expect(wrapper.text()).toContain('Choose what the food is like.')
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(submitFoodUpdate).not.toHaveBeenCalled()
  })

  it('sends the update with a trimmed note when the user is at the centre', async () => {
    getCurrentPosition.mockResolvedValue(NEAR)
    const update = { id: 'u1', type: 'SOME_SOLD_OUT' }
    submitFoodUpdate.mockResolvedValue(update)
    const wrapper = await mountForm()

    await submitWith(wrapper, { type: 'SOME_SOLD_OUT', note: '  No more fish balls ' })

    expect(submitFoodUpdate).toHaveBeenCalledWith('stall-1', 'SOME_SOLD_OUT', 'No more fish balls', NEAR)
    expect(wrapper.emitted('submitted')[0][0]).toEqual(update)
  })

  it('leaves the note out when it is blank', async () => {
    getCurrentPosition.mockResolvedValue(NEAR)
    submitFoodUpdate.mockResolvedValue({ id: 'u1' })
    const wrapper = await mountForm()

    await submitWith(wrapper, { type: 'SOLD_OUT', note: '   ' })

    expect(submitFoodUpdate).toHaveBeenCalledWith('stall-1', 'SOLD_OUT', undefined, NEAR)
  })

  it('shows the too-far message and sends nothing when the user is away from the centre', async () => {
    getCurrentPosition.mockResolvedValue(FAR)
    const wrapper = await mountForm()

    await submitWith(wrapper, { type: 'SOLD_OUT' })

    expect(wrapper.find('[role="alert"]').text()).toMatch(/Kampong Demo Food Centre.*1\.1 km/)
    expect(submitFoodUpdate).not.toHaveBeenCalled()
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })

  it('skips the location check when the backend has it turned off', async () => {
    getReportSettings.mockResolvedValue({ locationCheck: false, maxDistanceMetres: 200 })
    submitFoodUpdate.mockResolvedValue({ id: 'u1' })
    const wrapper = await mountForm()

    await submitWith(wrapper, { type: 'SOLD_OUT' })

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(submitFoodUpdate).toHaveBeenCalledWith('stall-1', 'SOLD_OUT', undefined, null)
  })

  it("shows the backend's message when the update is refused", async () => {
    getCurrentPosition.mockResolvedValue(NEAR)
    submitFoodUpdate.mockRejectedValue(new Error("You already updated this stall's food in the last 15 minutes"))
    const wrapper = await mountForm()

    await submitWith(wrapper, { type: 'SOLD_OUT' })

    expect(wrapper.find('[role="alert"]').text()).toContain('You already updated this stall')
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })
})
