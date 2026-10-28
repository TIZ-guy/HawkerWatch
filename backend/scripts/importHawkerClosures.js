// Imports every NEA hawker centre and its closure dates from data.gov.sg. Run with: pnpm import:centres
// Safe to run again at any time: centres are updated, not duplicated, and nothing else is deleted.
// The server also runs this by itself on start-up when the data is missing or over a week old.
import 'dotenv/config'
import dns from 'node:dns'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { importHawkerCentres } from '../services/hawkerImportService.js'

// Same as server.js: some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
dns.setServers(['8.8.8.8', '1.1.1.1'])

async function run() {
  await connectDB()
  console.log('Downloading hawker centres from data.gov.sg...')

  const result = await importHawkerCentres()

  console.log(`Import ${result.status}: ${result.recordsFetched} fetched, ${result.recordsCreated} new, ${result.recordsUpdated} updated`)
  for (const problem of result.failed) console.log(`  Skipped ${problem}`)
  if (result.status === 'FAILED') console.log(`  ${result.errorMessage}`)

  await mongoose.disconnect()
  if (result.status === 'FAILED') process.exit(1)
}

run().catch(async (error) => {
  console.error(`Import failed: ${error.message}`)
  await mongoose.disconnect()
  process.exit(1)
})
