// Tops up the demo activity for a presentation, without deleting anyone else's data:
// - fresh live reports on the sample stalls (reports expire after 60 minutes, so run this within the hour before)
// - today's food updates on the sample stalls (one flagged) and recent comments on two centres
// - the sample reviews with photos (each added once; running again skips the ones already there)
// - 3 new stalls waiting for approval on the admin page (put back in the queue if they were approved or rejected)
// - admin page history: a user suspended for spam and past entries in the activity log
//   (both by made-up accounts that can't log in; to log in as an admin yourself, use pnpm seed:admin)
// - the demo logins (demo@example.com and demo2fa@example.com), if they are missing
// Only the background demo users' still-live reports and food updates, their comments and the demo admin's log are replaced, so running it
// twice doesn't fill the feed with copies. Everything users have posted is left alone.
// Run with: pnpm seed:demo
// To fill the shared database the deployed site uses (PowerShell):
//   $env:MONGO_DB_NAME='hawker-watch'; pnpm seed:demo; Remove-Item Env:MONGO_DB_NAME
import 'dotenv/config'
import dns from 'node:dns'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import User from '../models/User.js'
import StatusReport from '../models/StatusReport.js'
import FoodUpdate from '../models/FoodUpdate.js'
import Review from '../models/Review.js'
import Stall from '../models/Stall.js'
import Comment from '../models/Comment.js'
import {
  BACKGROUND_USERS, DEMO_LOGIN, TWO_FACTOR_LOGIN, LOG_ADMIN, SPAMMER, NO_LOGIN_HASH, FLAGGED_REPORT, FLAGGED_FOOD_UPDATE,
  findSampleStalls, demoReports, demoFoodUpdates, demoReviews, demoPendingStalls, demoComments, createReview,
  addModerationHistory
} from './demoData.js'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to add demo data with NODE_ENV=production.')
  process.exit(1)
}

// The user with this email, created with `fields` if there isn't one yet. An existing user is left as it is.
async function findOrCreateUser(email, fields) {
  const existing = await User.findOne({ email })
  if (existing) return { user: existing, created: false }
  return { user: await User.create({ email, ...fields }), created: true }
}

async function seedDemo() {
  // Same as server.js: some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
  dns.setServers(['8.8.8.8', '1.1.1.1'])
  await connectDB()

  const stalls = await findSampleStalls()

  const [diner, regular] = await Promise.all(BACKGROUND_USERS.map(async ({ name, email }) =>
    (await findOrCreateUser(email, { name, passwordHash: NO_LOGIN_HASH })).user
  ))
  const { user: logAdmin } = await findOrCreateUser(LOG_ADMIN.email, { name: LOG_ADMIN.name, passwordHash: NO_LOGIN_HASH, role: 'admin' })
  const { user: spammer } = await findOrCreateUser(SPAMMER.email, { name: SPAMMER.name, passwordHash: NO_LOGIN_HASH })
  const passwordHash = await bcrypt.hash(DEMO_LOGIN.password, 10)
  const demo = await findOrCreateUser(DEMO_LOGIN.email, { name: DEMO_LOGIN.name, passwordHash })
  const twoFactor = await findOrCreateUser(TWO_FACTOR_LOGIN.email, {
    name: TWO_FACTOR_LOGIN.name,
    passwordHash,
    twoFactorEnabled: true,
    twoFactorSecret: TWO_FACTOR_LOGIN.secret
  })

  // Replace the background users' live activity from an earlier run, so the feed has no copies
  const now = new Date()
  const backgroundIds = [diner._id, regular._id]
  await StatusReport.deleteMany({ user: { $in: backgroundIds }, expiresAt: { $gt: now } })
  await FoodUpdate.deleteMany({ user: { $in: backgroundIds }, expiresAt: { $gt: now } })
  await Comment.deleteMany({ user: { $in: backgroundIds } })

  const reports = await StatusReport.create(demoReports({ diner, regular }, stalls))
  await StatusReport.updateOne({ _id: reports[FLAGGED_REPORT]._id }, { $addToSet: { flaggedBy: diner._id } })
  const foodUpdates = await FoodUpdate.create(demoFoodUpdates({ diner, regular }, stalls))
  await FoodUpdate.updateOne({ _id: foodUpdates[FLAGGED_FOOD_UPDATE]._id }, { $addToSet: { flaggedBy: regular._id } })
  const comments = await Comment.create(demoComments({ diner, regular }, stalls))

  let reviewsAdded = 0
  for (const sample of demoReviews({ diner, regular }, stalls)) {
    if (await Review.exists({ stall: sample.stall._id, user: sample.user._id })) continue
    await createReview(sample)
    reviewsAdded += 1
  }

  // Rejecting deletes a stall and approving lists it, so put each request back in the queue for the next rehearsal
  for (const { hawkerCentre, name, addedBy, ...fields } of demoPendingStalls({ diner, regular }, stalls)) {
    await Stall.updateOne({ hawkerCentre, name, addedBy }, { $set: { ...fields, isActive: true } }, { upsert: true })
  }

  await addModerationHistory({ logAdmin, spammer }, stalls)

  const liveReports = reports.filter((item) => item.expiresAt > now).length
  console.log(`Added ${liveReports} live reports (live for up to 60 minutes), ${foodUpdates.length} food updates (until midnight, 1 flagged), ${comments.length} comments and ${reviewsAdded} reviews.`)
  console.log('Admin page: 3 stalls waiting for approval, 1 flagged report and food update, a suspended user (spammer@example.com) and 8 activity log entries.')
  console.log(`Demo login ${DEMO_LOGIN.email}: ${demo.created ? `created, password ${DEMO_LOGIN.password}` : 'already there, password unchanged'}`)
  console.log(`Two-factor login ${TWO_FACTOR_LOGIN.email}: ${twoFactor.created ? `created, password ${DEMO_LOGIN.password}, authenticator key ${TWO_FACTOR_LOGIN.secret}` : 'already there, unchanged'}`)
  console.log('The activity is on Aljunied Ave 2 Blk 117 and Cheng San Market (Ang Mo Kio Ave 10 Blk 527), among others.')
}

seedDemo()
  .catch((err) => {
    console.error(`Demo seed failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
