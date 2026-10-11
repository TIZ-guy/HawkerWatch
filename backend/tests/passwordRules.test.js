import test from 'node:test'
import assert from 'node:assert/strict'
import { passwordProblem, PASSWORD_RULES } from '../utils/passwordRules.js'

const failing = (password) => PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id)

test('a password with 8+ characters, a capital and a special character passes', () => {
  assert.equal(passwordProblem('Password123!'), '')
  assert.equal(passwordProblem('Hawker#Run'), '')
})

test('each missing rule is reported', () => {
  assert.deepEqual(failing('password123!'), ['uppercase'])
  assert.deepEqual(failing('Password123'), ['special'])
  assert.deepEqual(failing('Pa!1'), ['length'])
  assert.deepEqual(failing('short'), ['length', 'uppercase', 'special'])
})

test('passwords longer than 72 characters are rejected', () => {
  assert.deepEqual(failing(`A!${'a'.repeat(71)}`), ['length'])
})

test('spaces do not count as a special character', () => {
  assert.deepEqual(failing('Password 123'), ['special'])
})

test('the message lists everything that is missing', () => {
  assert.equal(passwordProblem('password'), 'Password needs a capital letter and a special character')
  assert.equal(passwordProblem('pw'), 'Password needs 8 to 72 characters, a capital letter and a special character')
})
