import 'dotenv/config'
import dns from 'node:dns'
import app from './app.js'
import { connectDB } from './config/db.js'

// Node on some Windows networks can't resolve Atlas mongodb+srv:// records with the system DNS
dns.setServers(['8.8.8.8', '1.1.1.1'])

const port = process.env.PORT || 3000

try {
  await connectDB()
  app.listen(port, () => console.log(`HawkerWatch API listening on port ${port}`))
} catch (err) {
  console.error(`Failed to start: ${err.message}`)
  process.exit(1)
}

export default app
