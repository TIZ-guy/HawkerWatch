import { describe, it, expect } from 'vitest'
import { PASSWORD_RULES, meetsPasswordRules } from '@/utils/passwordRules.js'

// The same rules are checked again by the backend (backend/utils/passwordRules.js)
const failedRules = (password) => PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id)

describe('password rules', () => {
  it.each(['Hawker#Run1', 'Password123!', 'A!aaaaaa'])('accepts "%s"', (password) => {
    expect(meetsPasswordRules(password)).toBe(true)
  })

  it.each([
    ['password123!', ['uppercase']],
    ['Password123', ['special']],
    ['Password 123', ['special']], // a space is not a special character
    ['Pa!1', ['length']],
    ['short', ['length', 'uppercase', 'special']]
  ])('"%s" is missing %j', (password, missing) => {
    expect(meetsPasswordRules(password)).toBe(false)
    expect(failedRules(password)).toEqual(missing)
  })

  it('rejects passwords longer than 72 characters', () => {
    expect(failedRules(`A!${'a'.repeat(71)}`)).toEqual(['length'])
  })
})
