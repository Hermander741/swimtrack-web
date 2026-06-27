// server/src/routes/training/blocks.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const blocksRouter = Router()

const VALID_CATEGORIES = ['aufwaermen','hauptset','abkuehlen','kraft','technik','sonstiges'] as const

blocksRouter.get('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM training_blocks ORDER BY category, name')
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

blocksRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { name, category = 'sonstiges', distance_m, stroke, reps, rest_s, description } = req.body as {
    name?: string; category?: string; distance_m?: number; stroke?: string
    reps?: number; rest_s?: number; description?: string
  }
  if (!name?.trim()) { res.status(400).json(err('Name erforderlich')); return }
  if (!VALID_CATEGORIES.includes(category as never)) { res.status(400).json(err('Ungültige Kategorie')); return }
  try {
    const { rows } = await pool.query(
      `INSERT INTO training_blocks (name, category, distance_m, stroke, reps, rest_s, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), category, distance_m ?? null, stroke ?? null, reps ?? null, rest_s ?? null, description ?? null, req.user!.id],
    )
    res.status(201).json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

blocksRouter.patch('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const user = req.user!
  try {
    if (user.role !== 'admin') {
      const { rows: check } = await pool.query('SELECT created_by FROM training_blocks WHERE id = $1', [req.params.id])
      if (!check[0]) { res.status(404).json(err('Nicht gefunden')); return }
      if (check[0].created_by !== user.id) { res.status(403).json(err('Keine Berechtigung')); return }
    }
    const { name, category, distance_m, stroke, reps, rest_s, description } = req.body as {
      name?: string; category?: string; distance_m?: number | null; stroke?: string | null
      reps?: number | null; rest_s?: number | null; description?: string | null
    }
    const sets: string[] = []
    const values: unknown[] = []
    let p = 1
    if (name !== undefined) { sets.push(`name = $${p++}`); values.push(name.trim()) }
    if (category !== undefined) { sets.push(`category = $${p++}`); values.push(category) }
    if ('distance_m' in req.body) { sets.push(`distance_m = $${p++}`); values.push(distance_m ?? null) }
    if ('stroke' in req.body) { sets.push(`stroke = $${p++}`); values.push(stroke ?? null) }
    if ('reps' in req.body) { sets.push(`reps = $${p++}`); values.push(reps ?? null) }
    if ('rest_s' in req.body) { sets.push(`rest_s = $${p++}`); values.push(rest_s ?? null) }
    if ('description' in req.body) { sets.push(`description = $${p++}`); values.push(description ?? null) }
    if (!sets.length) { res.status(400).json(err('Keine Felder')); return }
    values.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE training_blocks SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, values,
    )
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

blocksRouter.delete('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const user = req.user!
  try {
    if (user.role !== 'admin') {
      const { rows: check } = await pool.query('SELECT created_by FROM training_blocks WHERE id = $1', [req.params.id])
      if (!check[0]) { res.status(404).json(err('Nicht gefunden')); return }
      if (check[0].created_by !== user.id) { res.status(403).json(err('Keine Berechtigung')); return }
    }
    await pool.query('DELETE FROM training_blocks WHERE id = $1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
