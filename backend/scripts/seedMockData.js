// Fills the database for development: the real NEA hawker centres and closures (from data.gov.sg, so it
// needs internet), the stalls in data/stalls.json, demo users, and demo reports, favourites, reviews and
// comments. The demo activity is only put on sample stalls (made-up businesses), never on real ones.
// Run with: pnpm seed
// Warning: this deletes existing users, centres, stalls, reports, favourites, reviews and comments.
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import User from '../models/User.js'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import StatusReport from '../models/StatusReport.js'
import Favourite from '../models/Favourite.js'
import Review from '../models/Review.js'
import ReviewPhoto from '../models/ReviewPhoto.js'
import { importHawkerCentres } from '../services/hawkerImportService.js'
import { importStallsFromFile, printStallSummary } from './importStalls.js'
import Comment from '../models/Comment.js'
import ImportLog from '../models/ImportLog.js'
import { REPORT_TTL_MINUTES } from '../utils/constants.js'
import { passwordProblem } from '../utils/passwordRules.js'

// Sample review photos: simple drawn illustrations (not real photos), stored in scripts/seed-photos
const PHOTO_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-photos')

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.')
  process.exit(1)
}

// Not a real bcrypt hash, so no password can ever match it. These background users can't log in.
const NO_LOGIN_HASH = '!seed-user-cannot-log-in'

// One account you can log in with after every seed. Development data only: the seed refuses to run
// in production. SEED_DEMO_PASSWORD in backend/.env changes the password.
const DEMO_LOGIN = {
  name: 'Demo User',
  email: 'demo@example.com',
  password: process.env.SEED_DEMO_PASSWORD || 'Hawker#Run1'
}

// A second login with two-factor login already on, for testing the code step.
// Add the key to an authenticator app (+ > Enter a setup key) to get its codes.
// The key is public in this file, so this account is for local testing only.
const TWO_FACTOR_LOGIN = {
  name: 'Demo 2FA User',
  email: 'demo2fa@example.com',
  secret: 'HAWKERWATCHDEMO2'
}

const MINUTE = 60 * 1000
const minutesAgo = (minutes) => new Date(Date.now() - minutes * MINUTE)

// A stall from data/stalls.json, found by its centre's NEA serial number and its name.
// Only sample stalls (centres with "source": "generated" in the file) are used for demo activity.
async function sampleStall(sourceId, name) {
  const centre = await HawkerCentre.findOne({ sourceId })
  const stall = centre && await Stall.findOne({ hawkerCentre: centre._id, name })
  if (!stall) throw new Error(`Sample stall "${name}" (centre ${sourceId}) not found; check data/stalls.json`)
  return stall
}

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

  const seeded = [User, HawkerCentre, Stall, StatusReport, Favourite, Review, ReviewPhoto, Comment]
  await Promise.all(seeded.map((Model) => Model.deleteMany({})))
  // Make the database indexes match the schemas (ImportLog data is kept).
  await Promise.all([...seeded, ImportLog].map((Model) => Model.syncIndexes()))

  const [diner, regular, , demo] = await User.create([
    { name: 'Demo Diner', email: 'diner@example.com', passwordHash: NO_LOGIN_HASH },
    { name: 'Demo Regular', email: 'regular@example.com', passwordHash: NO_LOGIN_HASH },
    { name: 'Demo Admin', email: 'admin@example.com', passwordHash: NO_LOGIN_HASH, role: 'admin' },
    { name: DEMO_LOGIN.name, email: DEMO_LOGIN.email, passwordHash: await bcrypt.hash(DEMO_LOGIN.password, 10) },
    {
      name: TWO_FACTOR_LOGIN.name,
      email: TWO_FACTOR_LOGIN.email,
      passwordHash: await bcrypt.hash(DEMO_LOGIN.password, 10),
      twoFactorEnabled: true,
      twoFactorSecret: TWO_FACTOR_LOGIN.secret
    }
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

  // Sample stalls for the demo activity below. Most are at two centres, so they are easy to find:
  // Aljunied Ave 2 Blk 117 (NEA serial 2) and Cheng San Market, Ang Mo Kio Ave 10 Blk 527 (serial 8).
  const chickenRice = await sampleStall('2', 'Hock Lam Chicken Rice')
  const prawnMee = await sampleStall('2', 'Soon Lee Prawn Noodle')
  const charKwayTeow = await sampleStall('8', 'Hup Seng Char Kway Teow')
  const laksa = await sampleStall('7', 'Hock Lam Laksa')
  const nasiLemak = await sampleStall('5', 'Warong Pak Nasi Lemak')
  const aljunied = await HawkerCentre.findOne({ sourceId: '2' })
  const chengSan = await HawkerCentre.findOne({ sourceId: '8' })

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

  // The demo login has no reviews, so you can try writing one.
  // `photos` are file names in scripts/seed-photos; they are saved as ReviewPhoto documents below.
  const sampleReviews = [
    { stall: chickenRice, user: diner, rating: 5, text: 'Tender chicken and fragrant rice. Worth the queue.', photos: ['chicken-rice-1.jpg', 'chicken-rice-2.jpg'] },
    { stall: chickenRice, user: regular, rating: 4, text: 'Go before 11:30, the lunch crowd builds quickly.', photos: ['chicken-rice-3.jpg'] },
    { stall: laksa, user: diner, rating: 3, text: 'Good gravy, but a little too salty for me.', photos: ['laksa-1.jpg'] },
    { stall: charKwayTeow, user: regular, rating: 4, text: 'Proper wok hei. Ask for extra cockles.', photos: ['char-kway-teow-1.jpg'] },
    { stall: prawnMee, user: regular, rating: 5, text: '', photos: ['prawn-mee-1.jpg'] },
    { stall: nasiLemak, user: diner, rating: 4, text: 'Fragrant rice and a good sambal kick.', photos: ['nasi-lemak-1.jpg'] }
  ]

  for (const sample of sampleReviews) {
    const review = await Review.create({ stall: sample.stall._id, user: sample.user._id, rating: sample.rating, text: sample.text })
    for (const fileName of sample.photos) {
      const photo = await ReviewPhoto.create({
        review: review._id,
        stall: sample.stall._id,
        contentType: 'image/jpeg',
        data: fs.readFileSync(path.join(PHOTO_FOLDER, fileName))
      })
      review.photos.push(photo._id)
    }
    await review.save()
  }

  await Comment.create([
    { hawkerCentre: aljunied._id, user: diner._id, text: 'Go before 11:30, the lunch crowd builds quickly.' },
    { hawkerCentre: aljunied._id, user: regular._id, text: 'Remember to return your tray after eating.' },
    { hawkerCentre: chengSan._id, user: regular._id, text: 'Busiest on weekend mornings.' }
  ])

  const counts = await Promise.all(seeded.map(async (Model) => `${Model.modelName}: ${await Model.countDocuments()}`))
  console.log(`Seed complete. ${counts.join(', ')}`)
  const password = process.env.SEED_DEMO_PASSWORD ? '(your SEED_DEMO_PASSWORD)' : DEMO_LOGIN.password
  console.log(`Log in with ${DEMO_LOGIN.email} / ${password}`)
  console.log(`Two-factor test: ${TWO_FACTOR_LOGIN.email} / ${password}, authenticator key ${TWO_FACTOR_LOGIN.secret}`)
}

seed()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
