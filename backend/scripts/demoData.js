// Demo accounts and activity, shared by pnpm seed (wipes and refills the database) and
// pnpm seed:demo (only tops up the live activity before a presentation). Development data only.
// The demo activity is only put on sample stalls (made-up businesses), never on real ones.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import Review from '../models/Review.js'
import ReviewPhoto from '../models/ReviewPhoto.js'
import { REPORT_TTL_MINUTES } from '../utils/constants.js'
import { endOfDay } from '../utils/foodUpdateUtils.js'

// Sample review photos: simple drawn illustrations (not real photos), stored in scripts/seed-photos
const PHOTO_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-photos')

// Not a real bcrypt hash, so no password can ever match it. These background users can't log in.
export const NO_LOGIN_HASH = '!seed-user-cannot-log-in'

// One account you can log in with after every seed. SEED_DEMO_PASSWORD in backend/.env changes the password.
export const DEMO_LOGIN = {
  name: 'Demo User',
  email: 'demo@example.com',
  password: process.env.SEED_DEMO_PASSWORD || 'Hawker#Run1'
}

// A second login with two-factor login already on, for testing the code step.
// Add the key to an authenticator app (+ > Enter a setup key) to get its codes.
// The key is public in this file, so this account is for testing and demos only.
export const TWO_FACTOR_LOGIN = {
  name: 'Demo 2FA User',
  email: 'demo2fa@example.com',
  secret: 'HAWKERWATCHDEMO2'
}

// The background users that the demo reports, food updates and reviews come from
export const BACKGROUND_USERS = [
  { name: 'Demo Diner', email: 'diner@example.com' },
  { name: 'Demo Regular', email: 'regular@example.com' }
]

const MINUTE = 60 * 1000
const minutesAgo = (minutes) => new Date(Date.now() - minutes * MINUTE)

// A stall from data/stalls.json, found by its centre's NEA serial number and its name.
async function sampleStall(sourceId, name) {
  const centre = await HawkerCentre.findOne({ sourceId })
  const stall = centre && await Stall.findOne({ hawkerCentre: centre._id, name })
  if (!stall) throw new Error(`Sample stall "${name}" (centre ${sourceId}) not found; run pnpm import:stalls first`)
  return stall
}

// The sample stalls for the demo activity. Most are at two centres, so they are easy to find:
// Aljunied Ave 2 Blk 117 (NEA serial 2) and Cheng San Market, Ang Mo Kio Ave 10 Blk 527 (serial 8).
export async function findSampleStalls() {
  return {
    chickenRice: await sampleStall('2', 'Hock Lam Chicken Rice'),
    prawnMee: await sampleStall('2', 'Soon Lee Prawn Noodle'),
    charKwayTeow: await sampleStall('8', 'Hup Seng Char Kway Teow'),
    laksa: await sampleStall('7', 'Hock Lam Laksa'),
    nasiLemak: await sampleStall('5', 'Warong Pak Nasi Lemak')
  }
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

// Status reports: the first 5 are live, the last 2 have expired (kept for history, hidden from live views).
// Flag the second one (index FLAGGED_REPORT) so moderation screens have something to show.
export const FLAGGED_REPORT = 1
export function demoReports({ diner, regular }, stalls) {
  return [
    report(stalls.chickenRice, diner, 'LONG_QUEUE', 5),
    report(stalls.chickenRice, regular, 'MODERATE_QUEUE', 25),
    report(stalls.laksa, regular, 'OPEN', 10),
    report(stalls.charKwayTeow, diner, 'TEMPORARILY_CLOSED', 40),
    report(stalls.prawnMee, regular, 'SHORT_QUEUE', 15),
    report(stalls.chickenRice, regular, 'SHORT_QUEUE', 90),
    report(stalls.nasiLemak, diner, 'OPEN', 180)
  ]
}

// Food updates made `minutes` ago, live until midnight (Singapore time)
function foodUpdate(stall, user, type, note, minutes) {
  return { stall: stall._id, hawkerCentre: stall.hawkerCentre, user: user._id, type, note, createdAt: minutesAgo(minutes), expiresAt: endOfDay() }
}

export function demoFoodUpdates({ diner, regular }, stalls) {
  return [
    foodUpdate(stalls.chickenRice, diner, 'SOME_SOLD_OUT', 'Roasted chicken is finished, steamed still available.', 20),
    foodUpdate(stalls.charKwayTeow, regular, 'SOLD_OUT', 'Sold out by 1pm today.', 35),
    foodUpdate(stalls.laksa, diner, 'QUALITY_NOT_GREAT', 'Gravy was a bit watery today.', 50)
  ]
}

// The demo login has no reviews, so you can try writing one.
// `photos` are file names in scripts/seed-photos; they are saved as ReviewPhoto documents.
export function demoReviews({ diner, regular }, stalls) {
  return [
    { stall: stalls.chickenRice, user: diner, rating: 5, text: 'Tender chicken and fragrant rice. Worth the queue.', photos: ['chicken-rice-1.jpg', 'chicken-rice-2.jpg'] },
    { stall: stalls.chickenRice, user: regular, rating: 4, text: 'Go before 11:30, the lunch crowd builds quickly.', photos: ['chicken-rice-3.jpg'] },
    { stall: stalls.laksa, user: diner, rating: 3, text: 'Good gravy, but a little too salty for me.', photos: ['laksa-1.jpg'] },
    { stall: stalls.charKwayTeow, user: regular, rating: 4, text: 'Proper wok hei. Ask for extra cockles.', photos: ['char-kway-teow-1.jpg'] },
    { stall: stalls.prawnMee, user: regular, rating: 5, text: '', photos: ['prawn-mee-1.jpg'] },
    { stall: stalls.nasiLemak, user: diner, rating: 4, text: 'Fragrant rice and a good sambal kick.', photos: ['nasi-lemak-1.jpg'] }
  ]
}

// Saves one of demoReviews() with its photos
export async function createReview(sample) {
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
