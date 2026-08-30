import exp from 'express'
import { connect } from 'mongoose'
import cookieParser from 'cookie-parser'
import cors from 'cors'

import { env, isProduction } from './config/env.js'
import { securityMiddleware, rejectUnsafePayload, authLimiter } from './config/security.js'
import { userApp } from './APIs/UserAPI.js'
import { stockApp } from './APIs/StockAPI.js'
import { tradeApp } from './APIs/TradeAPI.js'
import { marketApp } from './APIs/MarketAPI.js'
import { mlApp } from './APIs/MlAPI.js'
import { googleAuth } from './controllers/googleAuthController.js'
import { startAutomationScheduler } from './ml/automationJob.js'
import { startAccuracyResolver } from './ml/accuracyResolver.js'

const app = exp()

app.set('trust proxy', 1)
app.disable('x-powered-by')

// Mount centralized security middleware (helmet, compression, rate-limiting)
app.use(securityMiddleware)

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.clientUrls.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true
  })
)

// Parse cookies & JSON bodies with sanitization
app.use(cookieParser())
app.use(exp.json({ limit: '20kb' }))
app.use(rejectUnsafePayload)

// API Routes
app.use('/user-api', userApp)
app.post('/api/auth/google', authLimiter, googleAuth)
app.use('/stock-api', stockApp)
app.use('/trade-api', tradeApp)
app.use('/market-api', marketApp)
app.use('/ml-api', mlApp)

// 404 handler
app.use((req, res) => {
  return res.status(404).json({ message: `path ${req.url} is invalid` })
})

// Global Error Handler
app.use((err, req, res, next) => {
  if (!isProduction) {
    console.error('Error Name:', err.name)
    console.error('Error Message:', err.message)
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid request data' })
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: 'Invalid image upload' })
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message })
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' })
  }
  return res.status(500).json({ message: 'Internal server error' })
})

// Database Connection & Server Initialization
const connectDB = async () => {
  try {
    await connect(env.dbUrl, { family: 4 })
    console.log('DB connected')
    const server = app.listen(env.port, () => {
      console.log(`Server listening on ${env.port}`)
      // Start ML background schedulers (automation pass + accuracy resolution)
      startAutomationScheduler()
      startAccuracyResolver()
    })

    const gracefulShutdown = (signal) => {
      console.log(`${signal} received, shutting down`)
      server.close(() => process.exit(0))
      setTimeout(() => process.exit(1), 10_000).unref()
    }
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  } catch (err) {
    console.error('DB connection failed:', err.message)
    process.exit(1)
  }
}

connectDB()
