export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
  },
  { id: 'uppercase', label: 'a capital letter', test: (password) => /[A-Z]/.test(password) },
  { id: 'special', label: 'a special character', test: (password) => /[^A-Za-z0-9\s]/.test(password) }
]

export function passwordProblem(password) {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(String(password))).map((rule) => rule.label)
  if (!missing.length) return ''
  return `Password needs ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}`
}
