// server/src/routes/training/index.ts
import crypto from 'crypto'
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'
import { groupsRouter } from './groups'
import { blocksRouter } from './blocks'
import { templatesRouter } from './templates'
import { sessionsRouter } from './sessions'
import { attendanceRouter } from './attendance'
import { entriesRouter } from './entries'

export const trainingRouter = Router()

trainingRouter.use('/groups', groupsRouter)
trainingRouter.use('/blocks', blocksRouter)
trainingRouter.use('/templates', templatesRouter)
trainingRouter.use('/sessions', sessionsRouter)
trainingRouter.use('/sessions/:id/attendance', attendanceRouter)
trainingRouter.use('/sessions/:id/entry', entriesRouter)

trainingRouter.get('/ical-token', requireAuth(), async (req, res) => {
  const userId = req.user!.id
  try {
    const { rows } = await pool.query('SELECT * FROM ical_tokens WHERE user_id = $1', [userId])
    if (rows[0]) { res.json(ok(rows[0])); return }
    const token = crypto.randomUUID()
    const { rows: created } = await pool.query(
      'INSERT INTO ical_tokens (user_id, token) VALUES ($1, $2) RETURNING *', [userId, token],
    )
    res.json(ok(created[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

trainingRouter.post('/ical-token/regenerate', requireAuth(), async (req, res) => {
  const userId = req.user!.id
  try {
    const token = crypto.randomUUID()
    const { rows } = await pool.query(
      `INSERT INTO ical_tokens (user_id, token) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, created_at = now() RETURNING *`,
      [userId, token],
    )
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
