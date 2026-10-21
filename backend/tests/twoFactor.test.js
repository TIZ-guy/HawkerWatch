// Two-factor login tests that run without a database: User's database calls are replaced with t.mock.method().
import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import User from '../models/User.js'
import { login, loginTwoFactor } from '../controllers/authController.js'
import { startSetup, enableTwoFactor, disableTwoFactor } from '../controllers/twoFactorController.js'
import { checkCode, signChallenge, verifyChallenge, setupDetails } from '../utils/twoFactor.js'
import { AUTH_COOKIE, signToken, verifyToken } from '../utils/authToken.js'

process.env.JWT_SECRET = 'test-secret'

function fakeRes() {
  return {
    cookies: {},
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this }
  }
}

const rejectsWith = (promise, statusCode) =>
  assert.rejects(promise, (err) => err.statusCode === statusCode)

const SECRET = authenticator.generateSecret()

async function twoFactorUser() {
  const user = new User({ name: 'Kia', email: 'kia@example.com', twoFactorEnabled: true, twoFactorSecret: SECRET })
  user.passwordHash = await bcrypt.hash('Password123!', 4)
  return user
}

// A 6-digit code that is definitely wrong right now, so tests never pass by luck.
const wrongCode = () => ['000000', '111111', '222222', '333333'].find((c) => !checkCode(c, SECRET))

// User.findOne/findById(...).select(...) resolves to user
const mockFind = (t, method, user) => t.mock.method(User, method, () => ({ select: async () => user }))

test('checkCode accepts the current code, with or without a space, and rejects others', () => {
  const code = authenticator.generate(SECRET)
  assert.ok(checkCode(code, SECRET))
  assert.ok(checkCode(`${code.slice(0, 3)} ${code.slice(3)}`, SECRET))
  assert.ok(!checkCode(wrongCode(), SECRET))
  assert.ok(!checkCode(code, undefined))
  assert.ok(!checkCode(123456, SECRET))
})

test('a challenge token is not a login token, and a login token is not a challenge', async () => {
  const user = await twoFactorUser()
  assert.equal(verifyChallenge(signChallenge(user)), user._id.toString())
  assert.equal(verifyChallenge(signToken(user)), null)
  assert.equal(verifyChallenge('garbage'), null)
})

test('setupDetails gives a QR code image and an otpauth link', async () => {
  const details = await setupDetails('kia@example.com', SECRET)
  assert.match(details.qrCode, /^data:image\/png;base64,/)
  assert.match(details.otpauthUrl, /^otpauth:\/\/totp\/HawkerWatch:/)
  assert.equal(details.secret, SECRET)
})

test('login with 2FA on asks for a code instead of setting the cookie', async (t) => {
  mockFind(t, 'findOne', await twoFactorUser())
  const res = fakeRes()
  await login({ body: { email: 'kia@example.com', password: 'Password123!' } }, res)

  assert.equal(res.cookies[AUTH_COOKIE], undefined)
  assert.equal(res.body.data.twoFactorRequired, true)
  assert.ok(res.body.data.challengeToken)
})

test('loginTwoFactor sets the cookie for a correct code', async (t) => {
  const user = await twoFactorUser()
  mockFind(t, 'findById', user)
  const res = fakeRes()
  await loginTwoFactor({ body: { challengeToken: signChallenge(user), code: authenticator.generate(SECRET) } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(verifyToken(res.cookies[AUTH_COOKIE].value).id, user._id.toString())
})

test('loginTwoFactor rejects a wrong code, a bad challenge and missing fields', async (t) => {
  const user = await twoFactorUser()
  mockFind(t, 'findById', user)
  const wrong = wrongCode()

  await rejectsWith(loginTwoFactor({ body: { challengeToken: signChallenge(user), code: wrong } }, fakeRes()), 401)
  await rejectsWith(loginTwoFactor({ body: { challengeToken: signToken(user), code: '123456' } }, fakeRes()), 401)
  await rejectsWith(loginTwoFactor({ body: { code: '123456' } }, fakeRes()), 400)
})

test('startSetup saves a new secret and returns a QR code', async (t) => {
  const user = new User({ name: 'Kia', email: 'kia@example.com', passwordHash: 'x' })
  const update = t.mock.method(User, 'updateOne', async () => ({}))
  const res = fakeRes()
  await startSetup({ user }, res)

  const savedSecret = update.mock.calls[0].arguments[1].twoFactorSecret
  assert.equal(res.body.data.secret, savedSecret)
  assert.match(res.body.data.qrCode, /^data:image\/png/)
})

test('enableTwoFactor only turns 2FA on with a correct code', async (t) => {
  const user = new User({ name: 'Kia', email: 'kia@example.com', passwordHash: 'x', twoFactorSecret: SECRET })
  t.mock.method(user, 'save', async () => user)
  mockFind(t, 'findById', user)
  const wrong = wrongCode()

  await rejectsWith(enableTwoFactor({ user, body: { code: wrong } }, fakeRes()), 400)
  assert.equal(user.twoFactorEnabled, false)

  await enableTwoFactor({ user, body: { code: authenticator.generate(SECRET) } }, fakeRes())
  assert.equal(user.twoFactorEnabled, true)
})

test('disableTwoFactor needs both the password and a code', async (t) => {
  const user = await twoFactorUser()
  t.mock.method(user, 'save', async () => user)
  mockFind(t, 'findById', user)
  const code = authenticator.generate(SECRET)

  await rejectsWith(disableTwoFactor({ user, body: { password: 'wrong', code } }, fakeRes()), 400)
  await rejectsWith(disableTwoFactor({ user, body: { password: 'Password123!' } }, fakeRes()), 400)
  assert.equal(user.twoFactorEnabled, true)

  await disableTwoFactor({ user, body: { password: 'Password123!', code } }, fakeRes())
  assert.equal(user.twoFactorEnabled, false)
  assert.equal(user.twoFactorSecret, undefined)
})

test('the 2FA secret never appears in JSON sent to the browser', async () => {
  const json = (await twoFactorUser()).toJSON()
  assert.equal(json.twoFactorSecret, undefined)
  assert.equal(json.twoFactorEnabled, true)
})
