import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { meetsRouter } from './routes/meets'
import { resultsRouter } from './routes/results'
import { liveRouter } from './routes/live'
import { swimmerRouter } from './routes/swimmer'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
}))

app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }))
app.use('/api/meets', meetsRouter)
app.use('/api/meets', liveRouter)
app.use('/api/meets', resultsRouter)
app.use('/api/swimmer', swimmerRouter)

app.listen(PORT, () => console.log(`SwimTrack API running on port ${PORT}`))
