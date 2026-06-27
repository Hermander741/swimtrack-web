// server/src/routes/training/groups.ts
import { Router } from 'express'
import { pool } from '../../db/pool'
import { requireAuth } from '../../middleware/auth'
import { ok, err } from '../../types'

export const groupsRouter = Router()

groupsRouter.get('/', requireAuth(), async (req, res) => {
  const user = req.user!
  try {
    if (user.role === 'admin' || user.role === 'trainer') {
      const { rows } = await pool.query('SELECT * FROM training_groups ORDER BY name')
      res.json(ok(rows))
    } else {
      const { rows } = await pool.query(
        `SELECT tg.* FROM training_groups tg
         JOIN training_group_members tgm ON tgm.group_id = tg.id
         WHERE tgm.user_id = $1 ORDER BY tg.name`,
        [user.id],
      )
      res.json(ok(rows))
    }
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.get('/:id/members', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, u.role, u.avatar_color, tgm.added_at
       FROM training_group_members tgm
       JOIN users u ON u.id = tgm.user_id
       WHERE tgm.group_id = $1 ORDER BY u.name`,
      [req.params.id],
    )
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { name, description, color = '#0EA5E9', channel_id } = req.body as {
    name?: string; description?: string; color?: string; channel_id?: string
  }
  if (!name?.trim()) { res.status(400).json(err('Name erforderlich')); return }
  try {
    const { rows } = await pool.query(
      `INSERT INTO training_groups (name, description, color, channel_id, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), description?.trim() ?? null, color, channel_id ?? null, req.user!.id],
    )
    res.status(201).json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.post('/:id/members', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { userId } = req.body as { userId?: string }
  if (!userId) { res.status(400).json(err('userId erforderlich')); return }
  try {
    await pool.query(
      `INSERT INTO training_group_members (group_id, user_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.params.id, userId, req.user!.id],
    )
    res.status(201).json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.patch('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { name, description, color, channel_id } = req.body as {
    name?: string; description?: string; color?: string; channel_id?: string | null
  }
  const sets: string[] = []
  const values: unknown[] = []
  let p = 1
  if (name !== undefined) { sets.push(`name = $${p++}`); values.push(name.trim()) }
  if (description !== undefined) { sets.push(`description = $${p++}`); values.push(description ?? null) }
  if (color !== undefined) { sets.push(`color = $${p++}`); values.push(color) }
  if ('channel_id' in req.body) { sets.push(`channel_id = $${p++}`); values.push(channel_id ?? null) }
  if (!sets.length) { res.status(400).json(err('Keine Felder')); return }
  values.push(req.params.id)
  try {
    const { rows } = await pool.query(
      `UPDATE training_groups SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, values,
    )
    if (!rows[0]) { res.status(404).json(err('Nicht gefunden')); return }
    res.json(ok(rows[0]))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.delete('/:id/members/:userId', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM training_group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId],
    )
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

groupsRouter.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    await pool.query('DELETE FROM training_groups WHERE id = $1', [req.params.id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
