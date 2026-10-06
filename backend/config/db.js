import mongoose from 'mongoose'

// The shared team database. MONGO_DB_NAME in backend/.env overrides it for a personal copy.
export const DEFAULT_DB_NAME = 'hawker-watch'

export const dbName = () => process.env.MONGO_DB_NAME?.trim() || DEFAULT_DB_NAME

export async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not set in backend/.env')

  await mongoose.connect(uri, { dbName: dbName() })
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`)
}
