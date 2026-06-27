// server/src/routes/training/attendance.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const attendanceRouter = Router({ mergeParams: true })

// GET /:id/attendance
// Trainer+: returns { attendance: string[] } (all attended user_ids)
// Member:   returns { present: boolean } (own status only)
attendanceRouter.get('/', requireAuth(), async (req, res) => {
  const sessionId = req.params.id
  try {
    if (req.user!.role === 'mitglied') {
      const { rows } = await pool.query(
        'SELECT user_id FROM session_attendance WHERE session_id = $1 AND user_id = $2',
        [sessionId, req.user!.id],
      )
      res.json(ok({ present: rows.length > 0 })); return
    }
    const { rows } = await pool.query(
      'SELECT user_id FROM session_attendance WHERE session_id = $1 ORDER BY marked_at',
      [sessionId],
    )
    res.json(ok({ attendance: rows.map(r => r.user_id) }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// POST /:id/attendance/:userId — trainer+ only, idempotent
attendanceRouter.post('/:userId', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { id: sessionId, userId } = req.params
  try {
    await pool.query(
      `INSERT INTO session_attendance (session_id, user_id, marked_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [sessionId, userId, req.user!.id],
    )
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// DELETE /:id/attendance/:userId — trainer+ only
attendanceRouter.delete('/:userId', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { id: sessionId, userId } = req.params
  try {
    await pool.query(
      'DELETE FROM session_attendance WHERE session_id = $1 AND user_id = $2',
      [sessionId, userId],
    )
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
