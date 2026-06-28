// server/src/routes/training/entries.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const entriesRouter = Router({ mergeParams: true })

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

async function checkWindow(sessionId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT date FROM training_sessions WHERE id = $1',
    [sessionId],
  )
  if (!rows[0]) return false
  const sessionDate = new Date(rows[0].date)
  return sessionDate >= new Date(Date.now() - NINETY_DAYS_MS)
}

// GET /:id/entry — own entry or null
entriesRouter.get('/', requireAuth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 AND user_id = $2',
      [req.params.id, req.user!.id],
    )
    res.json(ok(rows[0] ?? null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// PUT /:id/entry — upsert own entry; enforces 90-day window
entriesRouter.put('/', requireAuth(), async (req, res) => {
  const { note, distance_m, rating } = req.body as {
    note?: string; distance_m?: number; rating?: number
  }
  try {
    const inWindow = await checkWindow(req.params.id)
    if (!inWindow) { res.status(403).json(err('Session außerhalb des 90-Tage-Fensters')); return }
    if (rating !== undefined && ![1, 2, 3].includes(rating)) {
      res.status(400).json(err('rating muss 1, 2 oder 3 sein')); return
    }
    const { rows } = await pool.query(
      `INSERT INTO session_entries (session_id, user_id, note, distance_m, rating)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id, user_id) DO UPDATE
         SET note = EXCLUDED.note,
             distance_m = EXCLUDED.distance_m,
             rating = EXCLUDED.rating,
             updated_at = now()
       RETURNING *`,
      [req.params.id, req.user!.id, note ?? null, distance_m ?? null, rating ?? null],
    )
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// DELETE /:id/entry — delete own entry only
entriesRouter.delete('/', requireAuth(), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM session_entries WHERE session_id = $1 AND user_id = $2',
      [req.params.id, req.user!.id],
    )
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
