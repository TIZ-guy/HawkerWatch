import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ReportStatusForm from '@/components/ReportStatusForm.vue'
import { getReportSettings, submitReport } from '@/services/reportService.js'
import { getCurrentPosition } from '@/services/locationService.js'

// The real services talk to the backend and the browser's location; here they are replaced with fakes.
// distanceKm and formatDistance stay real, so the "too far" check is the real one.
vi.mock('@/services/reportService.js', () => ({ getReportSettings: vi.fn(), submitReport: vi.fn() }))
vi.mock('@/services/locationService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCurrentPosition: vi.fn()
}))

const STALL = { _id: 'stall-1', name: 'Sample Laksa' }
const CENTRE = { name: 'Kampong Demo Food Centre', location: { coordinates: [103.8198, 1.3521] } }
const NEAR = { lat: 1.3521, lng: 103.8198, accuracy: 10 }
const FAR = { lat: 1.3621, lng: 103.8198, accuracy: 10 } // about 1.1 km away

async function mountForm() {
  const wrapper = mount(ReportStatusForm, { props: { stall: STALL, centre: CENTRE } })
  await flushPromises() // lets the settings request finish
  return wrapper
}

async function submitWith(wrapper, status) {
  if (status) await wrapper.find(`input[value="${status}"]`).setValue()
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('ReportStatusForm', () => {
  beforeEach(() => {
    getReportSettings.mockReset().mockResolvedValue({ locationCheck: true, maxDistanceMetres: 200 })
    submitReport.mockReset()
    getCurrentPosition.mockReset()
  })

  it('asks the user to choose a status before doing anything else', async () => {
    const wrapper = await mountForm()

    await submitWith(wrapper)

    expect(wrapper.text()).toContain('Choose what you see at the stall.')
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(submitReport).not.toHaveBeenCalled()
  })

  it('submits the report with the position when the user is near the centre', async () => {
    getCurrentPosition.mockResolvedValue(NEAR)
    const report = { id: 'r1', status: 'LONG_QUEUE' }
    submitReport.mockResolvedValue(report)
    const wrapper = await mountForm()

    await submitWith(wrapper, 'LONG_QUEUE')

    expect(submitReport).toHaveBeenCalledWith('stall-1', 'LONG_QUEUE', NEAR)
    expect(wrapper.emitted('submitted')[0][0]).toEqual(report)
  })

  it('shows the too-far message and sends nothing when the user is away from the centre', async () => {
    getCurrentPosition.mockResolvedValue(FAR)
    const wrapper = await mountForm()

    await submitWith(wrapper, 'OPEN')

    expect(wrapper.find('[role="alert"]').text()).toMatch(/Kampong Demo Food Centre.*1\.1 km/)
    expect(submitReport).not.toHaveBeenCalled()
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })

  it('warns that a poor location reading may be wrong', async () => {
    getCurrentPosition.mockResolvedValue({ ...FAR, accuracy: 2500 })
    const wrapper = await mountForm()

    await submitWith(wrapper, 'OPEN')

    expect(wrapper.find('[role="alert"]').text()).toContain('only accurate to about 2.5 km')
  })

  it('shows the location error and sends nothing when the position is unavailable', async () => {
    getCurrentPosition.mockRejectedValue(new Error('Location permission is blocked.'))
    const wrapper = await mountForm()

    await submitWith(wrapper, 'OPEN')

    expect(wrapper.find('[role="alert"]').text()).toBe('Location permission is blocked.')
    expect(submitReport).not.toHaveBeenCalled()
  })

  it('skips the location check when the backend has it turned off', async () => {
    getReportSettings.mockResolvedValue({ locationCheck: false, maxDistanceMetres: 200 })
    submitReport.mockResolvedValue({ id: 'r1' })
    const wrapper = await mountForm()

    await submitWith(wrapper, 'OPEN')

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(submitReport).toHaveBeenCalledWith('stall-1', 'OPEN', null)
  })
})
