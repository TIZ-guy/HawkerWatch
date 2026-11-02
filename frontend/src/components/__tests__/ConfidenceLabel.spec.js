import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfidenceLabel from '@/components/ConfidenceLabel.vue'

describe('ConfidenceLabel', () => {
  it.each([
    ['high', 85, 3, 'High confidence · 3 reports'],
    ['medium', 55, 2, 'Medium confidence · 2 reports'],
    ['low', 20, 1, 'Low confidence · 1 report']
  ])('writes out a %s level with the report count', (level, confidence, reportCount, text) => {
    const wrapper = mount(ConfidenceLabel, { props: { summary: { level, confidence, reportCount } } })

    expect(wrapper.text()).toBe(text)
  })

  it.each([
    ['high', 'hw-pill-open'],
    ['medium', 'hw-pill-mod'],
    ['low', 'hw-pill-long']
  ])('colours %s confidence with %s', (level, colourClass) => {
    const wrapper = mount(ConfidenceLabel, { props: { summary: { level, confidence: 50, reportCount: 2 } } })

    expect(wrapper.classes()).toContain('hw-pill')
    expect(wrapper.classes()).toContain(colourClass)
  })

  it('has the percentage in its tooltip', () => {
    const wrapper = mount(ConfidenceLabel, { props: { summary: { level: 'medium', confidence: 45, reportCount: 2 } } })

    expect(wrapper.attributes('title')).toBe('45% confidence from 2 reports')
  })

  // A level the frontend doesn't know yet shouldn't break the page, so it is treated as the cautious one
  it('treats an unknown level as low confidence', () => {
    const wrapper = mount(ConfidenceLabel, { props: { summary: { level: 'weird', confidence: 10, reportCount: 1 } } })

    expect(wrapper.text()).toContain('Low confidence')
  })
})
