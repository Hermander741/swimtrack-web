// server/src/routes/training/templates.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const templatesRouter = Router()

templatesRouter.get('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const { rows: templates } = await pool.query(
      `SELECT t.* FROM training_templates t ORDER BY t.day_of_week, t.start_time`,
    )
    const { rows: tblocks } = await pool.query(
      `SELECT ttb.template_id, ttb.block_id, ttb.position, ttb.override_note,
              tb.name, tb.category, tb.distance_m, tb.stroke, tb.reps, tb.rest_s, tb.description
       FROM training_template_blocks ttb
       JOIN training_blocks tb ON tb.id = ttb.block_id
       ORDER BY ttb.template_id, ttb.position`,
    )
    const byTemplate: Record<string, unknown[]> = {}
    for (const b of tblocks) {
      if (!byTemplate[b.template_id]) byTemplate[b.template_id] = []
      byTemplate[b.template_id].push(b)
    }
    res.json(ok(templates.map(t => ({ ...t, blocks: byTemplate[t.id] ?? [] }))))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

templatesRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { group_id, day_of_week, start_time, duration_min = 90, location, title, block_ids = [] } = req.body as {
    group_id?: string; day_of_week?: number; start_time?: string; duration_min?: number
    location?: string; title?: string; block_ids?: Array<{ block_id: string; override_note?: string }>
  }
  if (!group_id) { res.status(400).json(err('group_id erforderlich')); return }
  if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
    res.status(400).json(err('day_of_week muss 0-6 sein')); return
  }
  if (!start_time) { res.status(400).json(err('start_time erforderlich')); return }
  if (!title?.trim()) { res.status(400).json(err('Titel erforderlich')); return }
  try {
    const { rows } = await pool.query(
      `INSERT INTO training_templates (group_id, day_of_week, start_time, duration_min, location, title, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [group_id, day_of_week, start_time, duration_min, location ?? null, title.trim(), req.user!.id],
    )
    const template = rows[0]
    for (let i = 0; i < block_ids.length; i++) {
      await pool.query(
        `INSERT INTO training_template_blocks (template_id, block_id, position, override_note) VALUES ($1, $2, $3, $4)`,
        [template.id, block_ids[i].block_id, i, block_ids[i].override_note ?? null],
      )
    }
    res.status(201).json(ok({ ...template, blocks: block_ids }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

templatesRouter.patch('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { day_of_week, start_time, duration_min, location, title, is_active, block_ids } = req.body as {
    day_of_week?: number; start_time?: string; duration_min?: number; location?: string | null
    title?: string; is_active?: boolean; block_ids?: Array<{ block_id: string; override_note?: string }>
  }
  if (day_of_week !== undefined && (day_of_week < 0 || day_of_week > 6)) {
    res.status(400).json(err('day_of_week muss 0-6 sein')); return
  }
  const sets: string[] = []
  const values: unknown[] = []
  let p = 1
  if (day_of_week !== undefined) { sets.push(`day_of_week = $${p++}`); values.push(day_of_week) }
  if (start_time !== undefined) { sets.push(`start_time = $${p++}`); values.push(start_time) }
  if (duration_min !== undefined) { sets.push(`duration_min = $${p++}`); values.push(duration_min) }
  if ('location' in req.body) { sets.push(`location = $${p++}`); values.push(location ?? null) }
  if (title !== undefined) { sets.push(`title = $${p++}`); values.push(title.trim()) }
  if (is_active !== undefined) { sets.push(`is_active = $${p++}`); values.push(is_active) }
  try {
    let template
    if (sets.length) {
      values.push(req.params.id)
      const { rows } = await pool.query(
        `UPDATE training_templates SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, values,
      )
      if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
      template = rows[0]
    } else {
      const { rows } = await pool.query('SELECT * FROM training_templates WHERE id = $1', [req.params.id])
      if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
      template = rows[0]
    }
    if (block_ids !== undefined) {
      await pool.query('DELETE FROM training_template_blocks WHERE template_id = $1', [req.params.id])
      for (let i = 0; i < block_ids.length; i++) {
        await pool.query(
          `INSERT INTO training_template_blocks (template_id, block_id, position, override_note) VALUES ($1, $2, $3, $4)`,
          [req.params.id, block_ids[i].block_id, i, block_ids[i].override_note ?? null],
        )
      }
    }
    res.json(ok(template))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

templatesRouter.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM training_templates WHERE id = $1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

templatesRouter.post('/:id/generate', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { from, to } = req.body as { from?: string; to?: string }
  if (!from || !to) { res.status(400).json(err('from und to erforderlich')); return }
  try {
    const { rows: tmpl } = await pool.query(
      `SELECT t.*,
              COALESCE(json_agg(
                json_build_object('block_id', ttb.block_id, 'position', ttb.position, 'override_note', ttb.override_note,
                  'name', tb.name, 'category', tb.category, 'distance_m', tb.distance_m, 'stroke', tb.stroke,
                  'reps', tb.reps, 'rest_s', tb.rest_s, 'description', tb.description)
                ORDER BY ttb.position
              ) FILTER (WHERE ttb.block_id IS NOT NULL), '[]') as blocks
       FROM training_templates t
       LEFT JOIN training_template_blocks ttb ON ttb.template_id = t.id
       LEFT JOIN training_blocks tb ON tb.id = ttb.block_id
       WHERE t.id = $1 GROUP BY t.id`,
      [req.params.id],
    )
    if (!tmpl[0]) { res.status(404).json(err('Template nicht gefunden')); return }
    const template = tmpl[0]
    type BlockRow = { block_id: string; position: number; override_note: string | null; name: string; category: string; distance_m: number | null; stroke: string | null; reps: number | null; rest_s: number | null; description: string | null }
    const blocks = template.blocks as BlockRow[]

    // Parse as UTC dates — avoid local timezone offset issues
    const fromParts = from.split('-').map(Number) // [YYYY, MM, DD]
    const toParts = to.split('-').map(Number)
    const fromDate = new Date(Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]))
    const toDate = new Date(Date.UTC(toParts[0], toParts[1] - 1, toParts[2]))
    let created = 0
    const cur = new Date(fromDate)

    while (cur <= toDate) {
      // getUTCDay() returns 0=Sunday in UTC, convert to 0=Monday
      if ((cur.getUTCDay() + 6) % 7 === template.day_of_week) {
        const dateStr = cur.toISOString().slice(0, 10) // now always correct UTC date
        const { rows: existing } = await pool.query(
          `SELECT 1 FROM training_sessions WHERE template_id = $1 AND group_id = $2 AND date = $3`,
          [template.id, template.group_id, dateStr],
        )
        if (!existing.length) {
          const { rows: session } = await pool.query(
            `INSERT INTO training_sessions (group_id, template_id, title, date, start_time, duration_min, location, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [template.group_id, template.id, template.title, dateStr, template.start_time, template.duration_min, template.location, req.user!.id],
          )
          for (const b of blocks) {
            await pool.query(
              `INSERT INTO training_session_blocks (session_id, block_id, position, name, category, distance_m, stroke, reps, rest_s, description, override_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [session[0].id, b.block_id, b.position, b.name, b.category, b.distance_m, b.stroke, b.reps, b.rest_s, b.description, b.override_note],
            )
          }
          created++
        }
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    res.json(ok({ created }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
