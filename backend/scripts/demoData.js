// Demo accounts and activity, shared by pnpm seed (wipes and refills the database) and
// pnpm seed:demo (only tops up the live activity before a presentation). Development data only.
// The demo activity is only put on sample stalls (made-up businesses), never on real ones.
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'
import Review from '../models/Review.js'
import ReviewPhoto from '../models/ReviewPhoto.js'
import User from '../models/User.js'
import AdminAction from '../models/AdminAction.js'
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

// An admin that can't log in, who made the past entries in the admin activity log
export const LOG_ADMIN = { name: 'Demo Admin', email: 'admin@example.com' }

// A user the log admin suspended for spam, so the Users tab has a ban to show (or lift)
export const SPAMMER = { name: 'Demo Spammer', email: 'spammer@example.com' }
const SPAM_BAN = { days: 7, reason: 'Posting fake queue reports and adverts' }

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
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
// Flag the fifth one (index FLAGGED_REPORT, 15 minutes old, so live for 45 more) so moderation screens have something to show.
export const FLAGGED_REPORT = 4
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
    foodUpdate(stalls.laksa, diner, 'QUALITY_NOT_GREAT', 'Gravy was a bit watery today.', 50),
    foodUpdate(stalls.prawnMee, regular, 'SOME_SOLD_OUT', 'Big prawn bowls are finished, the small ones are still on.', 10),
    foodUpdate(stalls.nasiLemak, diner, 'SOLD_OUT', 'Everything sold by 12:30, stall is closing early.', 65)
  ]
}

// Flag this one of demoFoodUpdates() (the watery laksa), so the Moderation tab has a flagged update to show
export const FLAGGED_FOOD_UPDATE = 2

// Comments on the two centres with most of the demo activity
export function demoComments({ diner, regular }, stalls) {
  const aljunied = stalls.chickenRice.hawkerCentre
  const chengSan = stalls.charKwayTeow.hawkerCentre
  const comment = (hawkerCentre, user, text, minutes) => ({ hawkerCentre, user: user._id, text, createdAt: minutesAgo(minutes) })
  return [
    comment(aljunied, diner, 'Go before 11:30, the lunch crowd builds quickly.', 30),
    comment(aljunied, regular, 'Remember to return your tray after eating.', 4 * 60),
    comment(aljunied, regular, 'Most stalls take PayNow now, but a few are still cash only.', 26 * 60),
    comment(chengSan, regular, 'Busiest on weekend mornings.', 45),
    comment(chengSan, diner, 'Plenty of seats upstairs if the ground floor is full.', 3 * 60)
  ]
}

// Suspends the spammer (as if the log admin did it 2 hours ago) and fills the admin activity log.
// Earlier entries by the log admin are replaced, so running this again doesn't add copies.
// Actions by real admins are kept, and show above these.
export async function addModerationHistory({ logAdmin, spammer }, stalls) {
  const at = (hours) => new Date(Date.now() - hours * HOUR)
  const banned = at(2)
  await User.updateOne({ _id: spammer._id }, {
    bannedUntil: new Date(banned.getTime() + SPAM_BAN.days * 24 * HOUR),
    banReason: SPAM_BAN.reason
  })

  const gone = () => new mongoose.Types.ObjectId() // posts the admin deleted, so they no longer exist
  const entry = (hours, action, summary, targetType, targetId, subjectUser) =>
    ({ admin: logAdmin._id, action, summary, targetType, targetId, subjectUser, createdAt: at(hours), updatedAt: at(hours) })
  await AdminAction.deleteMany({ admin: logAdmin._id })
  await AdminAction.create([
    entry(2, 'user.ban', `Suspended ${spammer.name} (${spammer.email}) for ${SPAM_BAN.days} days: ${SPAM_BAN.reason}`, 'User', spammer._id, spammer._id),
    entry(2.1, 'report.delete', `Deleted a long queue report on "${stalls.chickenRice.name}"`, 'StatusReport', gone(), spammer._id),
    entry(2.2, 'comment.delete', 'Deleted a comment: "Cheapest food in SG!!! Order from my shop, link in bio"', 'Comment', gone(), spammer._id),
    entry(20, 'foodUpdate.delete', `Deleted a sold out food update on "${stalls.prawnMee.name}": "everything gone lol"`, 'FoodUpdate', gone(), spammer._id),
    entry(26, 'stall.reject', 'Rejected stall "Best Food Promo Stall"', 'Stall', gone(), spammer._id),
    entry(30, 'review.delete', 'Deleted a 1-star review: "Worst stall ever, go to my shop instead"', 'Review', gone(), spammer._id),
    entry(50, 'stall.approve', `Approved stall "${stalls.nasiLemak.name}"`, 'Stall', stalls.nasiLemak._id, stalls.nasiLemak.addedBy),
    entry(72, 'centres.import', 'Refreshed the NEA data (123 centres)')
  ])
}

// Stalls the background users have asked to add, waiting on the admin page's Stall approvals tab.
// Made-up businesses with no unit number, so they can't clash with a real stall's unit.
export function demoPendingStalls({ diner, regular }, stalls) {
  return [
    { hawkerCentre: stalls.chickenRice.hawkerCentre, name: 'Ah Seng Fishball Noodles', cuisine: 'Chinese', speciality: 'Fishball noodles', addedBy: diner._id },
    { hawkerCentre: stalls.chickenRice.hawkerCentre, name: 'Kopi Corner', cuisine: 'Drinks', speciality: 'Kopi and kaya toast', addedBy: regular._id },
    { hawkerCentre: stalls.charKwayTeow.hawkerCentre, name: 'Rahmat Mee Rebus', cuisine: 'Malay', speciality: 'Mee rebus', addedBy: diner._id }
  ].map((stall) => ({ ...stall, pendingApproval: true }))
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
