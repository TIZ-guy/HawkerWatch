import 'dotenv/config'
import dns from 'node:dns'
import app from './app.js'
import { connectDB } from './config/db.js'
import { importHawkerCentres, isHawkerDataStale } from './services/hawkerImportService.js'

// Node on some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
dns.setServers(['8.8.8.8', '1.1.1.1'])

const port = process.env.PORT || 3000

try {
  await connectDB()
  app.listen(port, () => console.log(`HawkerWatch API listening on port ${port}`))
  refreshHawkerDataIfStale() // runs in the background; the API is usable straight away
} catch (err) {
  console.error(`Failed to start: ${err.message}`)
  process.exit(1)
}

// Fills in or refreshes the official NEA hawker centres and closures when there are none yet, or the
// last import is over a week old. So a new or redeployed server gets real data without anyone running
// pnpm import:centres. Set HAWKER_IMPORT_ON_START=off in backend/.env to turn this off.
async function refreshHawkerDataIfStale() {
  if (process.env.HAWKER_IMPORT_ON_START === 'off') return
  try {
    if (!await isHawkerDataStale()) return
    console.log('Hawker centre data is missing or over a week old; importing from data.gov.sg...')
    const result = await importHawkerCentres()
    console.log(`Hawker centre import ${result.status}: ${result.recordsCreated} new, ${result.recordsUpdated} updated`)
  } catch (err) {
    console.error(`Hawker centre import failed: ${err.message}`) // the app keeps running with the data it has
  }
}

export default app
