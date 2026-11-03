// Resets the E2E database to a small, fixed set of data before each Playwright run.
// Run by frontend/e2e/global-setup.js. Unlike seedMockData.js it needs no internet, so runs are repeatable.
// Warning: this clears every collection, so it refuses any database except hawker-watch-e2e.
import 'dotenv/config'
import dns from 'node:dns'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Comment from '../models/Comment.js'
import Favourite from '../models/Favourite.js'
import HawkerCentre from '../models/HawkerCentre.js'
import ImportLog from '../models/ImportLog.js'
import Review from '../models/Review.js'
import ReviewPhoto from '../models/ReviewPhoto.js'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import User from '../models/User.js'
import { assertE2eDatabase } from '../utils/e2eGuard.js'
import { ADMIN_USER, ALPHA, BETA, BETA_STALL, CENTRES, DEMO_USER, GAMMA, GAMMA_STALL, QUIET_STALL, REPORT_TARGET_STALL, REPORTED_STALL } from './e2eFixtures.js'

const DAY = 24 * 60 * 60 * 1000

// Same reason as server.js: Node on some networks can't resolve Atlas mongodb+srv:// records otherwise
dns.setServers(['8.8.8.8', '1.1.1.1'])

async function clearDatabase() {
  const models = [Comment, Favourite, HawkerCentre, ImportLog, Review, ReviewPhoto, Stall, StatusReport, User]
  await Promise.all(models.map((model) => model.deleteMany({})))
}

function toCentre({ lat, lng, ...details }) {
  return { ...details, location: { type: 'Point', coordinates: [lng, lat] } }
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.')
  assertE2eDatabase(process.env.MONGO_DB_NAME) // before connecting, so nothing can happen to another database

  await connectDB()
  assertE2eDatabase(mongoose.connection.name) // and again on the database we really reached

  await clearDatabase()

  const user = await User.create({
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10)
  })
  await User.create({
    name: ADMIN_USER.name,
    email: ADMIN_USER.email,
    passwordHash: await bcrypt.hash(ADMIN_USER.password, 10),
    role: 'admin'
  })

  const [alpha, beta, gamma] = await HawkerCentre.create(CENTRES.map((centre) => {
    if (centre !== GAMMA) return toCentre(centre)
    const closure = { type: 'CLEANING', startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + DAY) }
    return { ...toCentre(centre), closures: [closure] }
  }))

  const [reportedStall] = await Stall.create([
    { ...REPORTED_STALL, hawkerCentre: alpha._id },
    { ...REPORT_TARGET_STALL, hawkerCentre: alpha._id },
    { ...QUIET_STALL, hawkerCentre: alpha._id },
    { ...BETA_STALL, hawkerCentre: beta._id },
    { ...GAMMA_STALL, hawkerCentre: gamma._id }
  ])

  await StatusReport.create({ stall: reportedStall._id, hawkerCentre: alpha._id, user: user._id, status: 'LONG_QUEUE' })

  console.log(`E2E database ready: ${CENTRES.length} centres (${ALPHA.name}, ${BETA.name}, ${GAMMA.name})`)
}

try {
  await seed()
} finally {
  await mongoose.disconnect()
}
