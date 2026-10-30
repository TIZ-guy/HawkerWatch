// One-off fix for databases from before cuisine became a fixed category (e.g. "Chinese").
// Older stalls have a dish in `cuisine` ("Chicken rice"); this moves it into `speciality` and sets
// `cuisine` from the dish, defaulting to Chinese. Run with: pnpm migrate:cuisines
// Safe to run again: stalls that already have a valid category are left alone.
import 'dotenv/config'
import dns from 'node:dns'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import Stall from '../models/Stall.js'
import { CUISINE_VALUES } from '../utils/constants.js'

// Words in the old value -> the category it belongs to. Anything else becomes Chinese.
const KEYWORD_CUISINES = [
  { words: ['nasi lemak', 'satay', 'mee rebus', 'nasi padang'], cuisine: 'Malay' },
  { words: ['prata', 'biryani', 'thosai', 'curry fish head'], cuisine: 'Indian' },
  { words: ['drink', 'kopi', 'teh', 'juice', 'coffee'], cuisine: 'Drinks' },
  { words: ['dessert', 'chendol', 'ice kacang', 'tau suan'], cuisine: 'Dessert' },
  { words: ['western', 'chicken chop', 'fish and chips'], cuisine: 'Western' }
]

function guessCuisine(oldValue) {
  const text = oldValue.toLowerCase()
  for (const rule of KEYWORD_CUISINES) {
    if (rule.words.some((word) => text.includes(word))) return rule.cuisine
  }
  return 'Chinese'
}

async function run() {
  dns.setServers(['8.8.8.8', '1.1.1.1']) // same as server.js, for Atlas on some Windows networks
  await connectDB()

  // Stalls whose cuisine is set but isn't one of the categories
  const stalls = await Stall.find({ cuisine: { $exists: true, $nin: [...CUISINE_VALUES, null, ''] } }).lean()

  for (const stall of stalls) {
    const cuisine = guessCuisine(stall.cuisine)
    await Stall.updateOne(
      { _id: stall._id },
      { $set: { cuisine: cuisine, speciality: stall.speciality || stall.cuisine } }
    )
    console.log(`  ${stall.name}: "${stall.cuisine}" -> ${cuisine}`)
  }
  console.log(`Fixed ${stalls.length} stall${stalls.length === 1 ? '' : 's'}.`)
}

run()
  .catch((error) => {
    console.error(`Cuisine migration failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
