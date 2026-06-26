import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { meetsRouter } from './routes/meets'
import { resultsRouter } from './routes/results'
import { liveRouter } from './routes/live'
import { swimmerRouter } from './routes/swimmer'
import { authRouter } from './routes/auth'
import { invitationsRouter } from './routes/invitations'
import { usersRouter } from './routes/users'

export function createApp() {
  const app = express()
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.some(o => origin === o.trim())) cb(null, true)
      else cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }))

  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => res.json({ ok: true, version: '3.0.0' }))

  app.use('/api/meets', meetsRouter)
  app.use('/api/meets', liveRouter)
  app.use('/api/meets', resultsRouter)
  app.use('/api/swimmer', swimmerRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/invitations', invitationsRouter)
  app.use('/api/users', usersRouter)

  return app
}
