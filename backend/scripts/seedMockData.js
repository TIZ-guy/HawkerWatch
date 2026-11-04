// Fills the database for development: the real NEA hawker centres and closures (from data.gov.sg, so it
// needs internet), the stalls in data/stalls.json, demo users, and demo reports, food updates, favourites,
// reviews and comments. The demo activity is only put on sample stalls (made-up businesses), never on real ones.
// The demo users and activity are in demoData.js, shared with pnpm seed:demo.
// Run with: pnpm seed
// Warning: this deletes existing users, centres, stalls, reports, food updates, favourites, reviews, comments
// and the admin activity log.
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import User from '../models/User.js'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import FoodUpdate from '../models/FoodUpdate.js'
import Favourite from '../models/Favourite.js'
import Review from '../models/Review.js'
import ReviewPhoto from '../models/ReviewPhoto.js'
import { importHawkerCentres } from '../services/hawkerImportService.js'
import { importStallsFromFile, printStallSummary } from './importStalls.js'
import Comment from '../models/Comment.js'
import ImportLog from '../models/ImportLog.js'
import AdminAction from '../models/AdminAction.js'
import { passwordProblem } from '../utils/passwordRules.js'
import {
  BACKGROUND_USERS, DEMO_LOGIN, TWO_FACTOR_LOGIN, LOG_ADMIN, SPAMMER, NO_LOGIN_HASH, FLAGGED_REPORT, FLAGGED_FOOD_UPDATE,
  findSampleStalls, demoReports, demoFoodUpdates, demoReviews, demoPendingStalls, demoComments, createReview,
  addModerationHistory
} from './demoData.js'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.')
  process.exit(1)
}

async function seed() {
  const problem = passwordProblem(DEMO_LOGIN.password)
  if (problem) throw new Error(`SEED_DEMO_PASSWORD: ${problem}`)

  await connectDB()

  const seeded = [User, HawkerCentre, Stall, StatusReport, FoodUpdate, Favourite, Review, ReviewPhoto, Comment, AdminAction]
  await Promise.all(seeded.map((Model) => Model.deleteMany({})))
  // Make the database indexes match the schemas (ImportLog data is kept).
  await Promise.all([...seeded, ImportLog].map((Model) => Model.syncIndexes()))

  const [diner, regular, logAdmin, demo, , spammer] = await User.create([
    ...BACKGROUND_USERS.map((user) => ({ ...user, passwordHash: NO_LOGIN_HASH })),
    { ...LOG_ADMIN, passwordHash: NO_LOGIN_HASH, role: 'admin' },
    { name: DEMO_LOGIN.name, email: DEMO_LOGIN.email, passwordHash: await bcrypt.hash(DEMO_LOGIN.password, 10) },
    {
      name: TWO_FACTOR_LOGIN.name,
      email: TWO_FACTOR_LOGIN.email,
      passwordHash: await bcrypt.hash(DEMO_LOGIN.password, 10),
      twoFactorEnabled: true,
      twoFactorSecret: TWO_FACTOR_LOGIN.secret
    },
    { ...SPAMMER, passwordHash: NO_LOGIN_HASH }
  ])

  // The real centres and closures, then the stalls in data/stalls.json
  console.log('Importing real hawker centres from data.gov.sg...')
  const imported = await importHawkerCentres()
  if (imported.status === 'FAILED') {
    throw new Error(`could not import the hawker centres (${imported.errorMessage}). pnpm seed needs internet.`)
  }
  console.log(`Imported ${imported.recordsCreated + imported.recordsUpdated} real hawker centres.`)
  console.log('Importing stalls from data/stalls.json...')
  printStallSummary(await importStallsFromFile())

  const stalls = await findSampleStalls()
  const { chickenRice, prawnMee, laksa } = stalls
  const aljunied = await HawkerCentre.findOne({ sourceId: '2' })
  const chengSan = await HawkerCentre.findOne({ sourceId: '8' })

  const reports = await StatusReport.create(demoReports({ diner, regular }, stalls))
  await StatusReport.updateOne({ _id: reports[FLAGGED_REPORT]._id }, { $push: { flaggedBy: diner._id } })
  const foodUpdates = await FoodUpdate.create(demoFoodUpdates({ diner, regular }, stalls))
  await FoodUpdate.updateOne({ _id: foodUpdates[FLAGGED_FOOD_UPDATE]._id }, { $push: { flaggedBy: regular._id } })

  await Favourite.create([
    {
      user: diner._id,
      targetType: 'Stall',
      target: chickenRice._id,
      alert: { enabled: true, days: [1, 2, 3, 4, 5], time: '11:30' }
    },
    { user: diner._id, targetType: 'HawkerCentre', target: chengSan._id },
    { user: regular._id, targetType: 'Stall', target: laksa._id },
    // The demo login starts with two favourites, leaving most stalls free to favourite live
    { user: demo._id, targetType: 'HawkerCentre', target: chengSan._id },
    {
      user: demo._id,
      targetType: 'Stall',
      target: prawnMee._id,
      alert: { enabled: true, days: [1, 2, 3, 4, 5], time: '12:00' }
    }
  ])

  for (const sample of demoReviews({ diner, regular }, stalls)) await createReview(sample)
  await Stall.create(demoPendingStalls({ diner, regular }, stalls))

  await Comment.create(demoComments({ diner, regular }, stalls))
  await addModerationHistory({ logAdmin, spammer }, stalls)

  const counts = await Promise.all(seeded.map(async (Model) => `${Model.modelName}: ${await Model.countDocuments()}`))
  console.log(`Seed complete. ${counts.join(', ')}`)
  const password = process.env.SEED_DEMO_PASSWORD ? '(your SEED_DEMO_PASSWORD)' : DEMO_LOGIN.password
  console.log(`Log in with ${DEMO_LOGIN.email} / ${password}`)
  console.log(`Two-factor test: ${TWO_FACTOR_LOGIN.email} / ${password}, authenticator key ${TWO_FACTOR_LOGIN.secret}`)
  console.log('Before a demo, pnpm seed:demo refreshes the live reports without wiping anything.')
}

seed()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
