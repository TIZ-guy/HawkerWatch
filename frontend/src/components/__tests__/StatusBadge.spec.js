import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/StatusBadge.vue'

describe('StatusBadge', () => {
  it.each([
    ['OPEN', 'Open', 'text-bg-success'],
    ['LONG_QUEUE', 'Long queue', 'text-bg-danger'],
    ['TEMPORARILY_CLOSED', 'Temporarily closed', 'text-bg-secondary']
  ])('shows %s as "%s" in %s', (status, label, colourClass) => {
    const wrapper = mount(StatusBadge, { props: { status } })

    expect(wrapper.text()).toBe(label)
    expect(wrapper.classes()).toContain(colourClass)
  })

  it('shows the matching icon', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'SHORT_QUEUE' } })

    expect(wrapper.find('i').classes()).toContain('bi-person')
  })

  // A status the frontend doesn't know yet (e.g. added on the backend first) shouldn't break the page
  it('falls back to "Unknown" for a status it does not recognise', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'SOMETHING_NEW' } })

    expect(wrapper.text()).toBe('Unknown')
    expect(wrapper.classes()).toContain('text-bg-light')
  })

  it('updates when the status prop changes', async () => {
    const wrapper = mount(StatusBadge, { props: { status: 'OPEN' } })

    await wrapper.setProps({ status: 'MODERATE_QUEUE' })

    expect(wrapper.text()).toBe('Moderate queue')
  })
})
