import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/authRoutes.js'
import { notFound, errorHandler } from './middleware/errorMiddleware.js'
import hawkerCentreRoutes from './routes/hawkerCentreRoutes.js'
import stallRoutes from './routes/stallRoutes.js'
import favouriteRoutes from './routes/favouriteRoutes.js'

const app = express()

app.use(helmet())
// credentials: true lets the browser send the login cookie with requests from the frontend.
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { service: 'HawkerWatch API', status: 'ok' } })
})

app.use('/api/auth', authRoutes)
app.use('/api/hawker-centres', hawkerCentreRoutes)
app.use('/api/stalls', stallRoutes)
app.use('/api/favourites', favouriteRoutes)

app.use(notFound)
app.use(errorHandler)

export default app
