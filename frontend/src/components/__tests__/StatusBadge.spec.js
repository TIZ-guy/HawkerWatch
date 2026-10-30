import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/StatusBadge.vue'

describe('StatusBadge', () => {
  it.each([
    ['OPEN', 'Open', 'hw-q-open'],
    ['LONG_QUEUE', 'Long queue', 'hw-q-long'],
    ['TEMPORARILY_CLOSED', 'Temporarily closed', 'hw-q-shut']
  ])('shows %s as "%s" with a %s dot', (status, label, colourClass) => {
    const wrapper = mount(StatusBadge, { props: { status } })

    expect(wrapper.text()).toBe(label)
    expect(wrapper.classes()).toContain('hw-q')
    expect(wrapper.classes()).toContain(colourClass)
  })

  // The coloured dot replaces the icon, and the label is always there (status is never colour alone)
  it('has no icon, only the dot and the label', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'SHORT_QUEUE' } })

    expect(wrapper.find('i').exists()).toBe(false)
    expect(wrapper.text()).toBe('Short queue')
  })

  it('can show a soft pill instead of a dot', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'MODERATE_QUEUE', variant: 'pill' } })

    expect(wrapper.classes()).toContain('hw-pill')
    expect(wrapper.classes()).toContain('hw-pill-mod')
    expect(wrapper.text()).toBe('Moderate queue')
  })

  // A status the frontend doesn't know yet (e.g. added on the backend first) shouldn't break the page
  it('falls back to "Unknown" for a status it does not recognise', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'SOMETHING_NEW' } })

    expect(wrapper.text()).toBe('Unknown')
    expect(wrapper.classes()).toContain('hw-q-shut')
  })

  it('updates when the status prop changes', async () => {
    const wrapper = mount(StatusBadge, { props: { status: 'OPEN' } })

    await wrapper.setProps({ status: 'MODERATE_QUEUE' })

    expect(wrapper.text()).toBe('Moderate queue')
  })
})
