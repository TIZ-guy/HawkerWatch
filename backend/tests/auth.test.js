// Auth tests that run without a database: User's database calls are replaced with t.mock.method().
import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { register, login, me, updateMe, changePassword, logout } from '../controllers/authController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { AUTH_COOKIE, signToken, verifyToken } from '../utils/authToken.js'

process.env.JWT_SECRET = 'test-secret'

// A tiny stand-in for Express's res object that records what was sent.
function fakeRes() {
  return {
    cookies: {},
    cleared: [],
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this },
    clearCookie(name) { this.cleared.push(name); return this }
  }
}

const rejectsWith = (promise, statusCode) =>
  assert.rejects(promise, (err) => err.statusCode === statusCode)

const demoUser = () => new User({ name: 'Kia', email: 'kia@example.com', passwordHash: 'x' })

test('signToken creates a token that verifyToken can read back', () => {
  const user = demoUser()
  const payload = verifyToken(signToken(user))
  assert.equal(payload.id, user._id.toString())
  assert.equal(payload.role, 'user')
})

test('verifyToken rejects a tampered token', () => {
  const token = signToken(demoUser())
  assert.throws(() => verifyToken(token.slice(0, -2) + 'xx'))
})

test('register requires name, email and password', async () => {
  await rejectsWith(register({ body: { email: 'a@example.com', password: 'password123' } }, fakeRes()), 400)
})

test('register rejects passwords shorter than 8 characters', async () => {
  await rejectsWith(register({ body: { name: 'A', email: 'a@example.com', password: 'short' } }, fakeRes()), 400)
})

test('register rejects passwords without a capital letter or special character', async () => {
  await rejectsWith(register({ body: { name: 'A', email: 'a@example.com', password: 'password123!' } }, fakeRes()), 400)
  await rejectsWith(register({ body: { name: 'A', email: 'a@example.com', password: 'Password123' } }, fakeRes()), 400)
})

test('register rejects an email that already has an account', async (t) => {
  t.mock.method(User, 'exists', async () => ({ _id: 'existing' }))
  await rejectsWith(register({ body: { name: 'A', email: 'a@example.com', password: 'Password123!' } }, fakeRes()), 409)
})

test('register hashes the password, ignores role and logs the user in', async (t) => {
  t.mock.method(User, 'exists', async () => null)
  let saved
  t.mock.method(User, 'create', async (fields) => { saved = fields; return new User(fields) })

  const res = fakeRes()
  await register({ body: { name: 'A', email: 'a@example.com', password: 'Password123!', role: 'admin' } }, res)

  assert.equal(saved.role, undefined)
  assert.notEqual(saved.passwordHash, 'Password123!')
  assert.ok(await bcrypt.compare('Password123!', saved.passwordHash))
  // Serialise like Express does, which is when the User model strips passwordHash.
  const sent = JSON.parse(JSON.stringify(res.body))
  assert.equal(res.statusCode, 201)
  assert.equal(sent.data.user.role, 'user')
  assert.equal(sent.data.user.passwordHash, undefined)
  assert.equal(res.cookies[AUTH_COOKIE].options.httpOnly, true)
})

// User.findOne(...).select(...) is a chained query, so the mock returns an object with select().
const mockFindOne = (t, user) => t.mock.method(User, 'findOne', () => ({ select: async () => user }))

test('login rejects non-string credentials', async () => {
  await rejectsWith(login({ body: { email: { $ne: null }, password: 'x' } }, fakeRes()), 400)
})

test('login rejects an unknown email', async (t) => {
  mockFindOne(t, null)
  await rejectsWith(login({ body: { email: 'nobody@example.com', password: 'password123' } }, fakeRes()), 401)
})

test('login rejects a wrong password', async (t) => {
  const user = demoUser()
  user.passwordHash = await bcrypt.hash('password123', 4)
  mockFindOne(t, user)
  await rejectsWith(login({ body: { email: 'kia@example.com', password: 'wrong-password' } }, fakeRes()), 401)
})

test('login treats seeded placeholder hashes as a wrong password', async (t) => {
  const user = demoUser()
  user.passwordHash = '!seed-user-cannot-log-in'
  mockFindOne(t, user)
  await rejectsWith(login({ body: { email: 'kia@example.com', password: 'anything' } }, fakeRes()), 401)
})

test('login with the right password sets the auth cookie', async (t) => {
  const user = demoUser()
  user.passwordHash = await bcrypt.hash('password123', 4)
  mockFindOne(t, user)

  const res = fakeRes()
  await login({ body: { email: 'KIA@example.com ', password: 'password123' } }, res)

  assert.equal(res.statusCode, 200)
  assert.equal(verifyToken(res.cookies[AUTH_COOKIE].value).id, user._id.toString())
})

test('me returns the logged-in user', () => {
  const user = demoUser()
  const res = fakeRes()
  me({ user }, res)
  assert.equal(res.body.data.user, user)
})

test('updateMe requires a name', async () => {
  await rejectsWith(updateMe({ user: demoUser(), body: { name: '  ' } }, fakeRes()), 400)
})

test('updateMe saves the new name and ignores other fields', async (t) => {
  const user = demoUser()
  t.mock.method(user, 'save', async () => user)

  const res = fakeRes()
  await updateMe({ user, body: { name: 'Kia Heng', email: 'new@example.com', role: 'admin' } }, res)

  assert.equal(user.save.mock.callCount(), 1)
  assert.equal(res.body.data.user.name, 'Kia Heng')
  assert.equal(user.email, 'kia@example.com')
  assert.equal(user.role, 'user')
})

// User.findById(...).select(...) is a chained query, so the mock returns an object with select().
const mockFindById = (t, user) => t.mock.method(User, 'findById', () => ({ select: async () => user }))

test('changePassword requires both passwords', async () => {
  await rejectsWith(changePassword({ user: demoUser(), body: { newPassword: 'password456' } }, fakeRes()), 400)
})

test('changePassword rejects a new password shorter than 8 characters', async () => {
  const req = { user: demoUser(), body: { currentPassword: 'password123', newPassword: 'short' } }
  await rejectsWith(changePassword(req, fakeRes()), 400)
})

test('changePassword rejects a new password without a special character', async () => {
  const req = { user: demoUser(), body: { currentPassword: 'password123', newPassword: 'Password456' } }
  await assert.rejects(changePassword(req, fakeRes()), (err) =>
    err.statusCode === 400 && err.message === 'New password needs a special character')
})

test('changePassword rejects a wrong current password', async (t) => {
  const user = demoUser()
  user.passwordHash = await bcrypt.hash('password123', 4)
  mockFindById(t, user)
  const req = { user, body: { currentPassword: 'wrong-password', newPassword: 'Password456!' } }
  await rejectsWith(changePassword(req, fakeRes()), 400)
})

test('changePassword stores a hash of the new password', async (t) => {
  const user = demoUser()
  user.passwordHash = await bcrypt.hash('password123', 4)
  mockFindById(t, user)
  t.mock.method(user, 'save', async () => user)

  const res = fakeRes()
  await changePassword({ user, body: { currentPassword: 'password123', newPassword: 'Password456!' } }, res)

  assert.equal(res.body.success, true)
  assert.equal(user.save.mock.callCount(), 1)
  assert.ok(await bcrypt.compare('Password456!', user.passwordHash))
})

test('logout clears the auth cookie', () => {
  const res = fakeRes()
  logout({}, res)
  assert.deepEqual(res.cleared, [AUTH_COOKIE])
  assert.equal(res.body.success, true)
})

test('protect rejects requests without a cookie', async () => {
  await rejectsWith(protect({ cookies: {} }, fakeRes(), () => {}), 401)
})

test('protect rejects an invalid token', async () => {
  await rejectsWith(protect({ cookies: { [AUTH_COOKIE]: 'not-a-token' } }, fakeRes(), () => {}), 401)
})

test('protect rejects a token for a deleted user', async (t) => {
  t.mock.method(User, 'findById', async () => null)
  const req = { cookies: { [AUTH_COOKIE]: signToken(demoUser()) } }
  await rejectsWith(protect(req, fakeRes(), () => {}), 401)
})

test('protect sets req.user for a valid token', async (t) => {
  const user = demoUser()
  t.mock.method(User, 'findById', async () => user)
  const req = { cookies: { [AUTH_COOKIE]: signToken(user) } }
  let calledNext = false
  await protect(req, fakeRes(), () => { calledNext = true })
  assert.equal(req.user, user)
  assert.ok(calledNext)
})

test('requireRole lets matching roles through and blocks others', () => {
  const adminOnly = requireRole('admin')
  let calledNext = false
  adminOnly({ user: { role: 'admin' } }, fakeRes(), () => { calledNext = true })
  assert.ok(calledNext)

  assert.throws(() => adminOnly({ user: { role: 'user' } }, fakeRes(), () => {}), (err) => err.statusCode === 403)
  assert.throws(() => adminOnly({}, fakeRes(), () => {}), (err) => err.statusCode === 403)
})
