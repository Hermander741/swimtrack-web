// server/src/routes/zeiten.ts
import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { SWIM_EVENTS } from '../constants/swimEvents'
import { scrapeMeetList } from '../scrapers/meetList'
import { scrapeEventList } from '../scrapers/eventList'
import { scrapeResultTable } from '../scrapers/resultTable'

function normalizeEventName(raw: string): string {
  return raw
    .replace(/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i, '')
    .trim()
}

interface SwimTimeEntry {
  id: string; user_id: string; user_name: string; avatar_color: string
  event: string; course: string; time_ms: number
  date: string; competition: string | null; created_by: string | null
  created_at: string; is_pb: boolean
}

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
        st.id, st.user_id, u.name AS user_name, u.avatar_color,
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
        SELECT st.id, st.user_id, u.name AS user_name, u.avatar_color,
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

// Hilfsfunktion: Lädt eine Zeit mit berechneter is_pb
// CTE stellt sicher, dass das Window über ALLE Zeiten der Partition läuft,
// bevor auf die angeforderte id gefiltert wird.
async function fetchZeit(id: string) {
  const { rows } = await pool.query<SwimTimeEntry>(`
    WITH target AS (
      SELECT user_id, event, course FROM swim_times WHERE id = $1
    ),
    ranked AS (
      SELECT st.id, st.user_id, u.name AS user_name, u.avatar_color,
        st.event, st.course, st.time_ms, st.date::text AS date,
        st.competition, st.created_by, st.created_at,
        (st.time_ms = MIN(st.time_ms) OVER (PARTITION BY st.user_id, st.event, st.course)) AS is_pb
      FROM swim_times st
      JOIN users u ON u.id = st.user_id
      WHERE (st.user_id, st.event, st.course) = (SELECT user_id, event, course FROM target)
    )
    SELECT * FROM ranked WHERE id = $1
  `, [id])
  return rows[0] ?? null
}

// POST /api/zeiten — Zeit eintragen
zeitenRouter.post('/', requireAuth(), async (req, res) => {
  const { event, course, time_ms, date, competition } = req.body as {
    event?: string; course?: string; time_ms?: number; date?: string; competition?: string
    user_id?: string
  }
  const user_id = req.body.user_id ?? req.user!.id

  if (user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
    res.status(403).json(err('Forbidden')); return
  }
  if (!event || !(SWIM_EVENTS as readonly string[]).includes(event)) {
    res.status(400).json(err('Ungültige Disziplin')); return
  }
  if (!time_ms || !Number.isInteger(time_ms) || time_ms <= 0) {
    res.status(400).json(err('Ungültige Zeit (muss positiver Integer in ms sein)')); return
  }
  if (!course || !['LB', 'KB', 'OW'].includes(course)) {
    res.status(400).json(err('Ungültige Bahn (LB | KB | OW)')); return
  }
  if (!date) {
    res.status(400).json(err('Datum erforderlich')); return
  }

  try {
    const { rows: [{ id }] } = await pool.query(
      `INSERT INTO swim_times (user_id, event, course, time_ms, date, competition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user_id, event, course, time_ms, date, competition ?? null, req.user!.id],
    )
    const entry = await fetchZeit(id)
    res.json(ok(entry))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// PATCH /api/zeiten/:id — Zeit bearbeiten (eigene: alle; fremde: trainer/admin)
zeitenRouter.patch('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params
  const { event, course, time_ms, date } = req.body as {
    event?: string; course?: string; time_ms?: number; date?: string
  }

  try {
    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM swim_times WHERE id = $1', [id],
    )
    if (!existing) { res.status(404).json(err('Zeit nicht gefunden')); return }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
      res.status(403).json(err('Forbidden')); return
    }

    if (event !== undefined && !(SWIM_EVENTS as readonly string[]).includes(event)) {
      res.status(400).json(err('Ungültige Disziplin')); return
    }
    if (time_ms !== undefined && (!Number.isInteger(time_ms) || time_ms <= 0)) {
      res.status(400).json(err('Ungültige Zeit')); return
    }
    if (course !== undefined && !['LB', 'KB', 'OW'].includes(course)) {
      res.status(400).json(err('Ungültige Bahn')); return
    }

    const parts: string[] = []
    const vals: unknown[] = []

    if (event     !== undefined) { parts.push(`event    = $${vals.length + 1}`); vals.push(event) }
    if (course    !== undefined) { parts.push(`course   = $${vals.length + 1}`); vals.push(course) }
    if (time_ms   !== undefined) { parts.push(`time_ms  = $${vals.length + 1}`); vals.push(time_ms) }
    if (date      !== undefined) { parts.push(`date     = $${vals.length + 1}`); vals.push(date) }
    if ('competition' in req.body) {
      parts.push(`competition = $${vals.length + 1}`)
      vals.push((req.body as { competition?: string }).competition ?? null)
    }

    if (!parts.length) { res.status(400).json(err('Keine Felder zum Aktualisieren')); return }

    vals.push(id)
    const { rows: [{ id: updatedId }] } = await pool.query(
      `UPDATE swim_times SET ${parts.join(', ')} WHERE id = $${vals.length} RETURNING id`,
      vals,
    )
    const entry = await fetchZeit(updatedId)
    res.json(ok(entry))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// POST /api/zeiten/myresults-sync — importiert alle Wettkampfzeiten der letzten Saison
zeitenRouter.post('/myresults-sync', requireAuth(), async (req, res) => {
  const user = req.user!
  if (!user.myresults_name) {
    res.status(400).json(err('Kein myresults.eu-Name im Profil hinterlegt'))
    return
  }

  const nameLower = user.myresults_name.toLowerCase()
  const nameParts = nameLower.split(' ').filter(Boolean)

  try {
    const meets = await scrapeMeetList('Recent')
    let totalFound = 0
    let imported = 0

    for (const meet of meets) {
      let events: Awaited<ReturnType<typeof scrapeEventList>> = []
      try { events = await scrapeEventList(meet.id, 'Recent') } catch { continue }

      for (const event of events) {
        const canonical = normalizeEventName(event.name)
        if (!(SWIM_EVENTS as readonly string[]).includes(canonical)) continue

        let rows: Awaited<ReturnType<typeof scrapeResultTable>> = []
        try { rows = await scrapeResultTable(meet.id, event.id, 'Recent') } catch { continue }

        for (const row of rows) {
          const rowLower = row.name.toLowerCase()
          const nameMatch = rowLower.includes(nameLower)
            || nameParts.every(part => rowLower.includes(part))
          if (!nameMatch || row.timeMs <= 0) continue

          totalFound++

          const { rows: inserted } = await pool.query(`
            INSERT INTO swim_times (user_id, event, course, time_ms, date, competition, created_by)
            SELECT $1, $2, $3, $4, $5::date, $6, NULL
            WHERE NOT EXISTS (
              SELECT 1 FROM swim_times
              WHERE user_id = $1 AND event = $2 AND course = $3 AND time_ms = $4 AND date = $5::date
            )
            RETURNING id
          `, [user.id, canonical, meet.course, row.timeMs, meet.startDate, meet.name])

          if (inserted.length > 0) imported++
        }
      }
    }

    res.json(ok({ imported, total_found: totalFound, meets_searched: meets.length }))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Sync fehlgeschlagen'))
  }
})

// DELETE /api/zeiten/:id
zeitenRouter.delete('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params
  try {
    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM swim_times WHERE id = $1', [id],
    )
    if (!existing) { res.status(404).json(err('Zeit nicht gefunden')); return }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
      res.status(403).json(err('Forbidden')); return
    }
    await pool.query('DELETE FROM swim_times WHERE id = $1', [id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
