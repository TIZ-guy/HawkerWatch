// Rules for a new password (register and change password). Login doesn't check them,
// so accounts created before a rule was added can still sign in.
// The frontend shows the same rules in frontend/src/utils/passwordRules.js; keep the two in sync.

export const MIN_PASSWORD_LENGTH = 8
// bcrypt ignores everything after 72 bytes, so longer passwords would give a false sense of security.
export const MAX_PASSWORD_LENGTH = 72

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
  },
  { id: 'uppercase', label: 'a capital letter', test: (password) => /[A-Z]/.test(password) },
  // Anything that isn't a letter, digit or space counts, e.g. ! @ # $ % & * ? _ -
  { id: 'special', label: 'a special character', test: (password) => /[^A-Za-z0-9\s]/.test(password) }
]

// '' when the password meets every rule, otherwise one sentence listing what's missing.
export function passwordProblem(password) {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(String(password))).map((rule) => rule.label)
  if (!missing.length) return ''
  return `Password needs ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}`
}
