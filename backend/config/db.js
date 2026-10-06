import mongoose from 'mongoose'

// Set here so everyone shares one database name, whatever their own URI contains.
export const DB_NAME = 'hawker-watch'

export async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not set in backend/.env')

  await mongoose.connect(uri, { dbName: DB_NAME })
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`)
}
