import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'

const port = process.env.PORT || 3000

try {
  await connectDB()
  app.listen(port, () => console.log(`HawkerWatch API listening on port ${port}`))
} catch (err) {
  console.error(`Failed to start: ${err.message}`)
  process.exit(1)
}

export default app
