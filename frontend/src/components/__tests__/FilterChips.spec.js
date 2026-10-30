import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChips from '@/components/FilterChips.vue'

const OPTIONS = [
  { value: 'chinese', label: 'Chinese', icon: 'bi-egg-fried' },
  { value: 'malay', label: 'Malay' },
  { value: 'indian', label: 'Indian' }
]

// The value the parent's v-model would receive from the latest click
const lastEmitted = (wrapper) => wrapper.emitted('update:modelValue').at(-1)[0]

describe('FilterChips', () => {
  it('shows one button per option', () => {
    const wrapper = mount(FilterChips, { props: { options: OPTIONS } })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)
    expect(buttons.map((button) => button.text())).toEqual(['Chinese', 'Malay', 'Indian'])
  })

  it('shows an icon only for options that have one', () => {
    const wrapper = mount(FilterChips, { props: { options: OPTIONS } })

    expect(wrapper.findAll('i')).toHaveLength(1)
    expect(wrapper.find('i').classes()).toContain('bi-egg-fried')
  })

  // The selected look comes from the hw-chip CSS keying off aria-pressed, so aria-pressed is what matters
  it('marks the selected chips for screen readers, which also drives their selected style', () => {
    const wrapper = mount(FilterChips, { props: { options: OPTIONS, multiple: true, modelValue: ['malay'] } })

    const [chinese, malay] = wrapper.findAll('button')
    expect(malay.attributes('aria-pressed')).toBe('true')
    expect(chinese.attributes('aria-pressed')).toBe('false')
    for (const chip of [chinese, malay]) {
      expect(chip.classes()).toContain('hw-chip')
      expect(chip.classes().some((name) => name.startsWith('btn'))).toBe(false)
    }
  })

  describe('multiple: true', () => {
    it('adds a chip to the selection when clicked', async () => {
      const wrapper = mount(FilterChips, { props: { options: OPTIONS, multiple: true, modelValue: ['malay'] } })

      await wrapper.findAll('button')[0].trigger('click')

      expect(lastEmitted(wrapper)).toEqual(['malay', 'chinese'])
    })

    it('removes a chip that was already selected', async () => {
      const wrapper = mount(FilterChips, { props: { options: OPTIONS, multiple: true, modelValue: ['chinese', 'malay'] } })

      await wrapper.findAll('button')[0].trigger('click')

      expect(lastEmitted(wrapper)).toEqual(['malay'])
    })
  })

  describe('single choice', () => {
    it('selects the clicked chip', async () => {
      const wrapper = mount(FilterChips, { props: { options: OPTIONS, modelValue: '' } })

      await wrapper.findAll('button')[2].trigger('click')

      expect(lastEmitted(wrapper)).toBe('indian')
    })

    it('clears the choice when the selected chip is clicked again', async () => {
      const wrapper = mount(FilterChips, { props: { options: OPTIONS, modelValue: 'indian' } })

      await wrapper.findAll('button')[2].trigger('click')

      expect(lastEmitted(wrapper)).toBe('')
    })
  })

  it('uses the label prop as the group name', () => {
    const wrapper = mount(FilterChips, { props: { options: OPTIONS, label: 'Food options' } })

    expect(wrapper.find('[role="group"]').attributes('aria-label')).toBe('Food options')
  })
})
