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
import reportRoutes from './routes/reportRoutes.js'
import commentRoutes from './routes/commentRoutes.js'
import swaggerUi from 'swagger-ui-express'
import openapi from './docs/openapi.js'

const app = express()

// Render/Railway put a proxy in front of the API. Trusting it lets req.ip be the user's real IP,
// so the login and report rate limits count each user separately instead of everyone together.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

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
app.use('/api/reports', reportRoutes)
app.use('/api/comments', commentRoutes)

// Interactive list of every endpoint (Swagger UI), plus the raw OpenAPI description
app.get('/api/docs.json', (_req, res) => res.json(openapi))
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'HawkerWatch API',
  swaggerOptions: { withCredentials: true, docExpansion: 'list', tagsSorter: 'alpha' }
}))

app.use(notFound)
app.use(errorHandler)

export default app
