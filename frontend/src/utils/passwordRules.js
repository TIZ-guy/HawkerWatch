// Rules for a new password, shown as a live checklist and checked before submitting.
// The backend checks the same rules in backend/utils/passwordRules.js; keep the two in sync.

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
    test: (password) => password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH
  },
  { id: 'uppercase', label: 'A capital letter (A–Z)', test: (password) => /[A-Z]/.test(password) },
  // Anything that isn't a letter, digit or space counts
  { id: 'special', label: 'A special character, e.g. ! @ # $ %', test: (password) => /[^A-Za-z0-9\s]/.test(password) }
]

export const meetsPasswordRules = (password) => PASSWORD_RULES.every((rule) => rule.test(password))
