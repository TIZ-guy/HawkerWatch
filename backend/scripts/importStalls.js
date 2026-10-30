// Imports the stalls in data/stalls.json into MongoDB. Run with: pnpm import:stalls
// Run the centre import first (pnpm import:centres), because stalls are matched to centres by
// NEA serial number (HawkerCentre.sourceId).
// Safe to run again: each stall is matched by centre and name, so it is updated instead of added
// twice, and stalls that users added by hand are left alone.
// Note: for most centres the file holds sample stalls, not real businesses (see "source" in the file).
import 'dotenv/config'
import dns from 'node:dns'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import HawkerCentre from '../models/HawkerCentre.js'
import Stall from '../models/Stall.js'

const STALLS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'stalls.json')

// Reads data/stalls.json and saves every stall. The database must already be connected.
// Returns { centresMatched, centresSkipped, stallsCreated, stallsUpdated, failed }
export async function importStallsFromFile() {
  const file = JSON.parse(fs.readFileSync(STALLS_FILE, 'utf8'))
  const summary = { centresMatched: 0, centresSkipped: 0, stallsCreated: 0, stallsUpdated: 0, failed: [] }

  for (const entry of file.centres) {
    const centre = await HawkerCentre.findOne({ sourceId: entry.sourceId }).select('_id name')
    if (!centre) {
      summary.centresSkipped += 1 // the centre import hasn't added this centre yet
      continue
    }
    summary.centresMatched += 1

    for (const stall of entry.stalls) {
      // One clashing unit number shouldn't stop the rest, so each stall is saved on its own
      try {
        const result = await Stall.updateOne(
          { hawkerCentre: centre._id, name: stall.name },
          { $set: { unitNumber: stall.unitNumber || undefined, cuisine: stall.cuisine, speciality: stall.speciality, isActive: true } },
          { upsert: true, runValidators: true }
        )
        if (result.upsertedCount) summary.stallsCreated += 1
        else summary.stallsUpdated += 1
      } catch (error) {
        summary.failed.push(`${centre.name} / ${stall.name}: ${error.message}`)
      }
    }
  }

  return summary
}

export function printStallSummary(summary) {
  console.log(`Stalls: ${summary.stallsCreated} new, ${summary.stallsUpdated} updated, in ${summary.centresMatched} centres`)
  if (summary.centresSkipped) {
    console.log(`  ${summary.centresSkipped} centres not found; run pnpm import:centres first`)
  }
  for (const problem of summary.failed) console.log(`  Skipped ${problem}`)
}

async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to import sample stalls into a production database.')
    process.exit(1)
  }
  // Same as server.js: some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
  dns.setServers(['8.8.8.8', '1.1.1.1'])
  await connectDB()
  console.log('Importing stalls from data/stalls.json...')
  printStallSummary(await importStallsFromFile())
}

// Only runs when started as a script (pnpm import:stalls), not when the seed imports this file
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .catch((error) => {
      console.error(`Stall import failed: ${error.message}`)
      process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
}
