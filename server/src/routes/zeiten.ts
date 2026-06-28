// server/src/routes/zeiten.ts
import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { SWIM_EVENTS } from '../constants/swimEvents'

export const zeitenRouter = Router()

// GET /api/zeiten/events — kanonische Disziplin-Liste
zeitenRouter.get('/events', requireAuth(), (_req, res) => {
  res.json(ok([...SWIM_EVENTS]))
})

// GET /api/zeiten/bestzeiten — nur Bestzeiten pro User/Event/Course
zeitenRouter.get('/bestzeiten', requireAuth(), async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (st.user_id, st.event, st.course)
        st.id, st.user_id, u.name AS user_name,
        st.event, st.course, st.time_ms, st.date::text AS date,
        st.competition, st.created_by, st.created_at,
        true AS is_pb
      FROM swim_times st
      JOIN users u ON u.id = st.user_id
      ORDER BY st.user_id, st.event, st.course, st.time_ms ASC
    `)
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// GET /api/zeiten — alle Zeiten mit Filtern + Pagination
// WICHTIG: CTE berechnet is_pb über ALLE Zeiten, dann erst WHERE-Filter
zeitenRouter.get('/', requireAuth(), async (req, res) => {
  const { user_id, event, course } = req.query as Record<string, string>
  const rawLimit  = parseInt((req.query.limit  as string) || '100', 10)
  const rawOffset = parseInt((req.query.offset as string) || '0',   10)
  const limit  = Math.min(isNaN(rawLimit)  ? 100 : rawLimit,  500)
  const offset = isNaN(rawOffset) ? 0 : rawOffset

  try {
    const { rows } = await pool.query(`
      WITH times_with_pb AS (
        SELECT st.id, st.user_id, u.name AS user_name,
          st.event, st.course, st.time_ms, st.date::text AS date,
          st.competition, st.created_by, st.created_at,
          (st.time_ms = MIN(st.time_ms) OVER (PARTITION BY st.user_id, st.event, st.course)) AS is_pb
        FROM swim_times st
        JOIN users u ON u.id = st.user_id
      )
      SELECT *, COUNT(*) OVER () AS total_count
      FROM times_with_pb
      WHERE ($1::uuid IS NULL OR user_id = $1)
        AND ($2::text  IS NULL OR event  = $2)
        AND ($3::text  IS NULL OR course = $3)
      ORDER BY date DESC, created_at DESC
      LIMIT $4 OFFSET $5
    `, [user_id || null, event || null, course || null, limit, offset])

    const total = rows[0]?.total_count ? parseInt(rows[0].total_count as string) : 0
    const items = rows.map(({ total_count: _, ...r }) => r)
    res.json(ok({ items, total }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
