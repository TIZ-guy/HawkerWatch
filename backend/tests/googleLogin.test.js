// "Continue with Google" tests without a database or Google: both are replaced with t.mock.method().
import test from 'node:test'
import assert from 'node:assert/strict'
import { OAuth2Client } from 'google-auth-library'
import User from '../models/User.js'
import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import { googleLogin, changePassword } from '../controllers/authController.js'
import { disableTwoFactor } from '../controllers/twoFactorController.js'
import { generateSecret } from '../utils/twoFactor.js'
import { AUTH_COOKIE } from '../utils/authToken.js'

process.env.JWT_SECRET = 'test-secret'
process.env.GOOGLE_CLIENT_ID = 'test-client-id'

// User.findOne/findById(...).select(...) is a chained query, so the mocks return an object with select().
function fakeRes() {
  return {
    cookies: {},
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this }
  }
}

const googleSays = (t, payload) =>
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => payload }))

const kia = { sub: 'google-123', email: 'Kia@Gmail.com', email_verified: true, name: 'Kia Heng' }

test('googleLogin requires a credential', async () => {
  await assert.rejects(googleLogin({ body: {} }, fakeRes()), (err) => err.statusCode === 400)
})

test('googleLogin rejects a token Google does not accept', async (t) => {
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => { throw new Error('Wrong recipient') })
  await assert.rejects(googleLogin({ body: { credential: 'bad' } }, fakeRes()), (err) => err.statusCode === 401)
})

test('googleLogin rejects an email Google has not verified', async (t) => {
  googleSays(t, { ...kia, email_verified: false })
  await assert.rejects(googleLogin({ body: { credential: 'x' } }, fakeRes()), (err) => err.statusCode === 401)
})

test('googleLogin creates a password-less account and logs in', async (t) => {
  googleSays(t, kia)
  t.mock.method(User, 'findOne', () => ({ select: async () => null }))
  t.mock.method(User, 'exists', async () => null)
  const create = t.mock.method(User, 'create', async (fields) => new User(fields))

  const res = fakeRes()
  await googleLogin({ body: { credential: 'x' } }, res)

  const fields = create.mock.calls[0].arguments[0]
  assert.equal(fields.email, 'kia@gmail.com')
  assert.equal(fields.googleId, 'google-123')
  assert.equal(fields.passwordHash, undefined)
  assert.equal(new User(fields).validateSync(), undefined)
  assert.equal(res.statusCode, 200)
  assert.ok(res.cookies[AUTH_COOKIE])
})

test('googleLogin picks a free name when the Google name is taken', async (t) => {
  googleSays(t, kia)
  t.mock.method(User, 'findOne', () => ({ select: async () => null }))
  let checks = 0
  t.mock.method(User, 'exists', async () => (checks++ < 2 ? { _id: 'someone' } : null))
  const create = t.mock.method(User, 'create', async (fields) => new User(fields))

  await googleLogin({ body: { credential: 'x' } }, fakeRes())
  assert.equal(create.mock.calls[0].arguments[0].name, 'Kia Heng 3')
})

test('googleLogin links Google to an existing account with the same email', async (t) => {
  googleSays(t, kia)
  const existing = new User({ name: 'Kia', email: 'kia@gmail.com', passwordHash: 'x' })
  const save = t.mock.method(existing, 'save', async () => existing)
  t.mock.method(User, 'findOne', (filter) => ({ select: async () => (filter.email ? existing : null) }))
  const create = t.mock.method(User, 'create', async () => assert.fail('should not create'))

  const res = fakeRes()
  await googleLogin({ body: { credential: 'x' } }, res)
  assert.equal(existing.googleId, 'google-123')
  assert.equal(save.mock.callCount(), 1)
  assert.equal(create.mock.callCount(), 0)
  assert.ok(res.cookies[AUTH_COOKIE])
})

test('googleLogin still asks for the 2FA code when it is on', async (t) => {
  googleSays(t, kia)
  const existing = new User({ name: 'Kia', email: 'kia@gmail.com', googleId: 'google-123', twoFactorEnabled: true })
  t.mock.method(User, 'findOne', () => ({ select: async () => existing }))

  const res = fakeRes()
  await googleLogin({ body: { credential: 'x' } }, res)
  assert.equal(res.body.data.twoFactorRequired, true)
  assert.ok(res.body.data.challengeToken)
  assert.equal(res.cookies[AUTH_COOKIE], undefined)
})

test('a password-less Google account can set a password without a current one', async (t) => {
  const user = new User({ name: 'Kia', email: 'kia@gmail.com', googleId: 'google-123' })
  t.mock.method(User, 'findById', () => ({ select: async () => user }))
  t.mock.method(user, 'save', async () => user)

  const res = fakeRes()
  await changePassword({ user, body: { newPassword: 'Hawker#Run1' } }, res)
  assert.ok(user.passwordHash)
  assert.equal(res.body.data.user.toJSON().hasPassword, true)
})

test('an account with a password still needs the current one', async (t) => {
  const user = new User({ name: 'Kia', email: 'kia@gmail.com', passwordHash: await bcrypt.hash('Hawker#Run1', 4) })
  t.mock.method(User, 'findById', () => ({ select: async () => user }))
  await assert.rejects(changePassword({ user, body: { newPassword: 'Hawker#Run2' } }, fakeRes()), (err) => err.statusCode === 400)
})

test('hasPassword is sent only when the hash was loaded', () => {
  assert.equal(new User({ name: 'A', email: 'a@gmail.com', googleId: 'g' }).toJSON().hasPassword, false)
  assert.equal(new User({ name: 'A', email: 'a@gmail.com', passwordHash: 'x' }).toJSON().hasPassword, true)
  const loadedWithoutHash = User.hydrate({ _id: new User()._id, name: 'A', email: 'a@gmail.com' }, { passwordHash: 0 })
  assert.equal('hasPassword' in loadedWithoutHash.toJSON(), false)
})

test('turning off 2FA on a password-less account only needs the code', async (t) => {
  const secret = generateSecret()
  const user = new User({ name: 'Kia', email: 'kia@gmail.com', googleId: 'g', twoFactorEnabled: true, twoFactorSecret: secret })
  t.mock.method(User, 'findById', () => ({ select: async () => user }))
  t.mock.method(user, 'save', async () => user)

  await disableTwoFactor({ user, body: { code: authenticator.generate(secret) } }, fakeRes())
  assert.equal(user.twoFactorEnabled, false)
})
