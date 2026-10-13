// Fills the database with fictional demo data. Run with: npm run seed
// Warning: this deletes existing users, centres, stalls, reports, favourites and comments.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import User from '../models/User.js'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import Favourite from '../models/Favourite.js'
import Comment from '../models/Comment.js'
import ImportLog from '../models/ImportLog.js'
import { REPORT_TTL_MINUTES } from '../utils/constants.js'
import { passwordProblem } from '../utils/passwordRules.js'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.')
  process.exit(1)
}

const NO_LOGIN_HASH = '!seed-user-cannot-log-in'

const DEMO_LOGIN = {
  name: 'Demo User',
  email: 'demo@example.com',
  password: process.env.SEED_DEMO_PASSWORD || 'Hawker#Run1'
}

const MINUTE = 60 * 1000
const minutesAgo = (minutes) => new Date(Date.now() - minutes * MINUTE)
const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * MINUTE)

// A report made `minutes` ago, expiring REPORT_TTL_MINUTES after that.
function report(stall, user, status, minutes) {
  const createdAt = minutesAgo(minutes)
  return {
    stall: stall._id,
    hawkerCentre: stall.hawkerCentre,
    user: user._id,
    status,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + REPORT_TTL_MINUTES * MINUTE)
  }
}

async function seed() {
  const problem = passwordProblem(DEMO_LOGIN.password)
  if (problem) throw new Error(`SEED_DEMO_PASSWORD: ${problem}`)

  await connectDB()

  const seeded = [User, HawkerCentre, Stall, StatusReport, Favourite, Comment]
  await Promise.all(seeded.map((Model) => Model.deleteMany({})))
  // Make the database indexes match the schemas (ImportLog data is kept).
  await Promise.all([...seeded, ImportLog].map((Model) => Model.syncIndexes()))

  const [diner, regular, , demo] = await User.create([
    { name: 'Demo Diner', email: 'diner@example.com', passwordHash: NO_LOGIN_HASH },
    { name: 'Demo Regular', email: 'regular@example.com', passwordHash: NO_LOGIN_HASH },
    { name: 'Demo Admin', email: 'admin@example.com', passwordHash: NO_LOGIN_HASH, role: 'admin' },
    { name: DEMO_LOGIN.name, email: DEMO_LOGIN.email, passwordHash: await bcrypt.hash(DEMO_LOGIN.password, 10) }
  ])

  const [kampong, riverside, seaside] = await HawkerCentre.create([
    {
      name: 'Kampong Demo Food Centre',
      address: '1 Demo Road',
      postalCode: '100001',
      location: { coordinates: [103.8198, 1.3521] },
      closures: [{ type: 'CLEANING', startDate: daysFromNow(5), endDate: daysFromNow(6), remarks: 'Quarterly cleaning' }]
    },
    {
      name: 'Riverside Demo Market and Food Centre',
      address: '2 Example Street',
      postalCode: '100002',
      location: { coordinates: [103.8454, 1.2857] }
    },
    {
      name: 'Seaside Demo Hawker Centre',
      address: '3 Sample Avenue',
      postalCode: '100003',
      location: { coordinates: [103.902, 1.3048] },
      // Closed right now, so the UI can show an official closure.
      closures: [{ type: 'OTHER_WORKS', startDate: daysFromNow(-1), endDate: daysFromNow(2), remarks: 'Repairs and redecoration' }]
    }
  ])

  const stalls = await Stall.create([
    { hawkerCentre: kampong._id, name: 'Ah Demo Chicken Rice', unitNumber: '01-01', cuisine: 'Chicken rice' },
    { hawkerCentre: kampong._id, name: 'Sample Laksa', unitNumber: '01-02', cuisine: 'Laksa' },
    { hawkerCentre: kampong._id, name: 'Test Kitchen Char Kway Teow', unitNumber: '01-03', cuisine: 'Char kway teow' },
    { hawkerCentre: kampong._id, name: 'Mock Drinks Stall', cuisine: 'Drinks' }, // no unit number
    { hawkerCentre: riverside._id, name: 'Placeholder Prawn Mee', unitNumber: '02-11', cuisine: 'Prawn mee' },
    { hawkerCentre: riverside._id, name: 'Example Nasi Lemak', unitNumber: '02-12', cuisine: 'Nasi lemak' },
    { hawkerCentre: riverside._id, name: 'Fictional Fishball Noodles', unitNumber: '02-13', cuisine: 'Fishball noodles' },
    { hawkerCentre: seaside._id, name: 'Imaginary Satay', unitNumber: '01-20', cuisine: 'Satay' },
    { hawkerCentre: seaside._id, name: 'Pretend Carrot Cake', unitNumber: '01-21', cuisine: 'Carrot cake' },
    { hawkerCentre: seaside._id, name: 'Dummy Duck Rice', unitNumber: '01-22', cuisine: 'Duck rice', isActive: false }
  ])
  const [chickenRice, laksa, charKwayTeow, , prawnMee, nasiLemak] = stalls

  const reports = await StatusReport.create([
    // Live (less than 60 minutes old)
    report(chickenRice, diner, 'LONG_QUEUE', 5),
    report(chickenRice, regular, 'MODERATE_QUEUE', 25),
    report(laksa, regular, 'OPEN', 10),
    report(charKwayTeow, diner, 'TEMPORARILY_CLOSED', 40),
    report(prawnMee, regular, 'SHORT_QUEUE', 15),
    // Expired (kept for history, hidden from live views)
    report(chickenRice, regular, 'SHORT_QUEUE', 90),
    report(nasiLemak, diner, 'OPEN', 180)
  ])
  // One flagged report, so moderation screens have something to show.
  await StatusReport.updateOne({ _id: reports[1]._id }, { $push: { flaggedBy: diner._id } })

  await Favourite.create([
    {
      user: diner._id,
      targetType: 'Stall',
      target: chickenRice._id,
      alert: { enabled: true, days: [1, 2, 3, 4, 5], time: '11:30' }
    },
    { user: diner._id, targetType: 'HawkerCentre', target: riverside._id },
    { user: regular._id, targetType: 'Stall', target: laksa._id },
    { user: demo._id, targetType: 'HawkerCentre', target: riverside._id },
    {
      user: demo._id,
      targetType: 'Stall',
      target: prawnMee._id,
      alert: { enabled: true, days: [1, 2, 3, 4, 5], time: '12:00' }
    }
  ])

  await Comment.create([
    { hawkerCentre: kampong._id, user: diner._id, text: 'Go before 11:30, the lunch crowd builds quickly.' },
    { hawkerCentre: kampong._id, user: regular._id, text: 'Plenty of seats on the second floor.' },
    { hawkerCentre: riverside._id, user: regular._id, text: 'Car park fills up on weekends.' }
  ])

  const counts = await Promise.all(seeded.map(async (Model) => `${Model.modelName}: ${await Model.countDocuments()}`))
  console.log(`Seed complete. ${counts.join(', ')}`)
  console.log(`Log in with ${DEMO_LOGIN.email} / ${process.env.SEED_DEMO_PASSWORD ? '(your SEED_DEMO_PASSWORD)' : DEMO_LOGIN.password}`)
}

seed()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
