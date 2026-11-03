// Creates the admin login, or makes an existing account with that email an admin and resets its password.
// Admins can approve and remove stalls and remove reports from the Admin page (/admin).
// Run with: pnpm seed:admin
// Change the login with ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env. On the deployed database
// always set your own ADMIN_PASSWORD: the default one below is in the repository for anyone to read.
// To add it to the shared database the deployed site uses (PowerShell):
//   $env:MONGO_DB_NAME='hawker-watch'; $env:ADMIN_PASSWORD='<a strong password>'; pnpm seed:admin; Remove-Item Env:MONGO_DB_NAME, Env:ADMIN_PASSWORD
import 'dotenv/config'
import dns from 'node:dns'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import User from '../models/User.js'
import { passwordProblem } from '../utils/passwordRules.js'

const ADMIN_LOGIN = {
  name: 'HawkerWatch Admin',
  email: process.env.ADMIN_EMAIL || 'admin@hawkerwatch.sg',
  password: process.env.ADMIN_PASSWORD || 'HawkerAdmin#2026'
}

async function createAdmin() {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_PASSWORD when NODE_ENV=production, so the public default password is never used.')
  }
  const problem = passwordProblem(ADMIN_LOGIN.password)
  if (problem) throw new Error(problem)

  // Same as server.js: some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
  dns.setServers(['8.8.8.8', '1.1.1.1'])
  await connectDB()

  const passwordHash = await bcrypt.hash(ADMIN_LOGIN.password, 10)
  const email = ADMIN_LOGIN.email.toLowerCase()
  const existing = await User.findOne({ email })

  if (existing) {
    existing.role = 'admin'
    existing.passwordHash = passwordHash
    await existing.save()
    console.log(`${email} is now an admin, with its password reset.`)
  } else {
    await User.create({ name: ADMIN_LOGIN.name, email, passwordHash, role: 'admin' })
    console.log(`Created admin ${email}.`)
  }
  console.log(`Log in with email ${email} and password ${ADMIN_LOGIN.password}, then open /admin.`)
}

createAdmin()
  .catch((err) => {
    console.error(`Creating the admin failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
