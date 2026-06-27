// server/src/routes/training/sessions.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const sessionsRouter = Router()

// IMPORTANT: /ical must be registered BEFORE /:id
sessionsRouter.get('/ical', async (req, res) => {
  const { token, days } = req.query as { token?: string; days?: string }
  if (!token) { res.status(401).send('Token erforderlich'); return }
  try {
    const { rows: tokenRows } = await pool.query(
      'SELECT user_id FROM ical_tokens WHERE token = $1', [token],
    )
    if (!tokenRows[0]) { res.status(401).send('Ungültiger Token'); return }
    const userId = tokenRows[0].user_id
    const daysNum = Math.min(parseInt(days ?? '365', 10) || 365, 365)
    const fromStr = new Date().toISOString().slice(0, 10)
    const toDate = new Date(); toDate.setDate(toDate.getDate() + daysNum)
    const toStr = toDate.toISOString().slice(0, 10)

    const { rows } = await pool.query(
      `SELECT ts.*, tg.name as group_name,
              COALESCE(json_agg(
                json_build_object('name', tsb.name, 'category', tsb.category,
                  'distance_m', tsb.distance_m, 'stroke', tsb.stroke, 'reps', tsb.reps,
                  'rest_s', tsb.rest_s, 'override_note', tsb.override_note)
                ORDER BY tsb.position
              ) FILTER (WHERE tsb.session_id IS NOT NULL), '[]') as blocks
       FROM training_sessions ts
       LEFT JOIN training_groups tg ON tg.id = ts.group_id
       LEFT JOIN training_session_blocks tsb ON tsb.session_id = ts.id
       WHERE ts.date BETWEEN $1 AND $2
         AND ts.is_cancelled = false
         AND (
           ts.is_external = true
           OR EXISTS (
             SELECT 1 FROM training_group_members tgm
             WHERE tgm.group_id = ts.group_id AND tgm.user_id = $3
           )
         )
       GROUP BY ts.id, tg.name ORDER BY ts.date, ts.start_time`,
      [fromStr, toStr, userId],
    )

    const ical = (await import('ical-generator')).default
    const cal = ical({ name: 'Mermaids Training', timezone: 'Europe/Vienna' })
    type BlockRow = { name: string; category: string; distance_m: number | null; stroke: string | null; reps: number | null; rest_s: number | null; override_note: string | null }
    for (const s of rows) {
      const [year, month, day] = (s.date as string).split('-').map(Number)
      const [hour, minute] = (s.start_time as string).split(':').map(Number)
      const start = new Date(Date.UTC(year, month - 1, day, hour, minute))
      const end = new Date(start.getTime() + (s.duration_min ?? 90) * 60000)
      const blocks = s.blocks as BlockRow[]
      const descLines = blocks.map(b => {
        let line = `[${b.category}] ${b.name}`
        if (b.distance_m) line += ` ${b.distance_m}m`
        if (b.stroke) line += ` ${b.stroke}`
        if (b.reps) line += ` ×${b.reps}`
        if (b.rest_s) line += ` (${b.rest_s}s Pause)`
        if (b.override_note) line += ` — ${b.override_note}`
        return line
      })
      cal.createEvent({
        start, end, summary: s.title,
        location: s.location ?? undefined,
        description: descLines.join('\n') || undefined,
      })
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.send(cal.toString())
  } catch { res.status(500).send('Fehler beim Generieren') }
})

sessionsRouter.get('/', requireAuth(), async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string }
  if (!from || !to) { res.status(400).json(err('from und to erforderlich')); return }
  const user = req.user!
  try {
    const sessionQuery = `
      SELECT ts.*, tg.name as group_name, tg.color as group_color,
             COALESCE(json_agg(
               json_build_object('session_id', tsb.session_id, 'block_id', tsb.block_id,
                 'position', tsb.position, 'name', tsb.name, 'category', tsb.category,
                 'distance_m', tsb.distance_m, 'stroke', tsb.stroke, 'reps', tsb.reps,
                 'rest_s', tsb.rest_s, 'description', tsb.description, 'override_note', tsb.override_note)
               ORDER BY tsb.position
             ) FILTER (WHERE tsb.session_id IS NOT NULL), '[]') as blocks
      FROM training_sessions ts
      LEFT JOIN training_groups tg ON tg.id = ts.group_id
      LEFT JOIN training_session_blocks tsb ON tsb.session_id = ts.id
      WHERE ts.date BETWEEN $1 AND $2`

    if (user.role === 'admin' || user.role === 'trainer') {
      const { rows } = await pool.query(
        sessionQuery + ' GROUP BY ts.id, tg.name, tg.color ORDER BY ts.date, ts.start_time',
        [from, to],
      )
      res.json(ok(rows))
    } else {
      const { rows } = await pool.query(
        sessionQuery + ` AND (ts.is_external = true OR EXISTS (
           SELECT 1 FROM training_group_members tgm WHERE tgm.group_id = ts.group_id AND tgm.user_id = $3
         )) GROUP BY ts.id, tg.name, tg.color ORDER BY ts.date, ts.start_time`,
        [from, to, user.id],
      )
      res.json(ok(rows))
    }
  } catch { res.status(500).json(err('Interner Fehler')) }
})

sessionsRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { group_id, title, date, start_time, duration_min = 90, location, notes, is_external = false, blocks = [] } = req.body as {
    group_id?: string; title?: string; date?: string; start_time?: string
    duration_min?: number; location?: string; notes?: string; is_external?: boolean
    blocks?: Array<{ block_id?: string; name: string; category: string; distance_m?: number; stroke?: string; reps?: number; rest_s?: number; description?: string; override_note?: string }>
  }
  if (!title?.trim()) { res.status(400).json(err('Titel erforderlich')); return }
  if (!date) { res.status(400).json(err('Datum erforderlich')); return }
  if (!start_time) { res.status(400).json(err('Startzeit erforderlich')); return }
  if (!is_external && !group_id) { res.status(400).json(err('group_id oder is_external erforderlich')); return }
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `INSERT INTO training_sessions (group_id, title, date, start_time, duration_min, location, notes, is_external, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [group_id ?? null, title.trim(), date, start_time, duration_min, location ?? null, notes ?? null, is_external, req.user!.id],
      )
      const session = rows[0]
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]
        await client.query(
          `INSERT INTO training_session_blocks (session_id, block_id, position, name, category, distance_m, stroke, reps, rest_s, description, override_note)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [session.id, b.block_id ?? null, i, b.name, b.category, b.distance_m ?? null, b.stroke ?? null, b.reps ?? null, b.rest_s ?? null, b.description ?? null, b.override_note ?? null],
        )
      }
      await client.query('COMMIT')
      res.status(201).json(ok(session))
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch { res.status(500).json(err('Interner Fehler')) }
})

sessionsRouter.patch('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { title, date, start_time, duration_min, location, notes, is_cancelled } = req.body as {
    title?: string; date?: string; start_time?: string; duration_min?: number
    location?: string | null; notes?: string | null; is_cancelled?: boolean
  }
  const sets: string[] = []
  const values: unknown[] = []
  let p = 1
  if (title !== undefined) { sets.push(`title = $${p++}`); values.push(title.trim()) }
  if (date !== undefined) { sets.push(`date = $${p++}`); values.push(date) }
  if (start_time !== undefined) { sets.push(`start_time = $${p++}`); values.push(start_time) }
  if (duration_min !== undefined) { sets.push(`duration_min = $${p++}`); values.push(duration_min) }
  if ('location' in req.body) { sets.push(`location = $${p++}`); values.push(location ?? null) }
  if ('notes' in req.body) { sets.push(`notes = $${p++}`); values.push(notes ?? null) }
  if (is_cancelled !== undefined) { sets.push(`is_cancelled = $${p++}`); values.push(is_cancelled) }
  if (!sets.length) { res.status(400).json(err('Keine Felder')); return }
  values.push(req.params.id)
  try {
    const { rows } = await pool.query(
      `UPDATE training_sessions SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, values,
    )
    if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
    const session = rows[0]
    if (is_cancelled === true && session.group_id) {
      const { rows: grp } = await pool.query(
        'SELECT channel_id FROM training_groups WHERE id = $1 AND channel_id IS NOT NULL',
        [session.group_id],
      )
      if (grp[0]?.channel_id) {
        const dateStr = new Date(session.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const timeStr = (session.start_time as string).slice(0, 5)
        await pool.query(
          `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, NULL, $2)`,
          [grp[0].channel_id, `⚠️ Training **${session.title}** am **${dateStr}, ${timeStr} Uhr** wurde abgesagt.`],
        )
      }
    }
    res.json(ok(session))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

sessionsRouter.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM training_sessions WHERE id = $1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
