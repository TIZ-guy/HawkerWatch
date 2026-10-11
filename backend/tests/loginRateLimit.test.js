// Runs the real auth routes on a throwaway server to check the failed-login limit.
// No database: User.findOne is replaced so every login attempt fails.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import User from '../models/User.js'
import authRoutes from '../routes/authRoutes.js'
import { errorHandler } from '../middleware/errorMiddleware.js'

test('the 11th failed login in a row is refused with 429', async (t) => {
  mock.method(User, 'findOne', () => ({ select: async () => null }))
  t.after(() => mock.restoreAll())

  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use(errorHandler)
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)) })
  t.after(() => server.close())

  const attempt = () => fetch(`http://localhost:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@example.com', password: 'Wrong-password1' })
  })

  for (let i = 0; i < 10; i++) assert.equal((await attempt()).status, 401)

  const blocked = await attempt()
  assert.equal(blocked.status, 429)
  assert.match((await blocked.json()).message, /Too many failed login attempts/)
})
