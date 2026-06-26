import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { userCanAccessChannel } from '../utils/channelAccess'

export const chatRouter = Router()

const VALID_ROLES = ['admin', 'trainer', 'eltern', 'mitglied'] as const
const roleRank: Record<string, number> = { admin: 4, trainer: 3, eltern: 2, mitglied: 1 }

// GET /api/chat/channels — list accessible channels
chatRouter.get('/channels', requireAuth(), async (req, res) => {
  try {
    const user = req.user!
    const rank = roleRank[user.role] ?? 1
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.description, c.min_role, c.created_by, c.is_archived, c.created_at,
              cr.last_message_id
       FROM channels c
       LEFT JOIN channel_reads cr ON cr.channel_id = c.id AND cr.user_id = $2
       WHERE c.is_archived = false
         AND (
           $1 >= (CASE c.min_role WHEN 'admin' THEN 4 WHEN 'trainer' THEN 3 WHEN 'eltern' THEN 2 ELSE 1 END)
           OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $2)
         )
       ORDER BY c.created_at ASC`,
      [rank, user.id],
    )
    res.json(ok(rows))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// POST /api/chat/channels — create channel (admin/trainer)
chatRouter.post('/channels', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const { name, description, min_role = 'mitglied' } = req.body as {
      name?: string; description?: string; min_role?: string
    }
    if (!name?.trim()) { res.status(400).json(err('Name erforderlich')); return }
    if (!VALID_ROLES.includes(min_role as never)) { res.status(400).json(err('Ungültige Mindestrolle')); return }
    const { rows } = await pool.query(
      `INSERT INTO channels (name, description, min_role, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, min_role, created_by, is_archived, created_at`,
      [name.trim(), description?.trim() ?? null, min_role, req.user!.id],
    )
    res.status(201).json(ok(rows[0]))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// PATCH /api/chat/channels/:id — edit channel (admin/trainer with access)
chatRouter.patch('/channels/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    const { name, description, min_role } = req.body as {
      name?: string; description?: string; min_role?: string
    }
    if (min_role && !VALID_ROLES.includes(min_role as never)) {
      res.status(400).json(err('Ungültige Mindestrolle')); return
    }
    const { rows } = await pool.query(
      `UPDATE channels SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         min_role = COALESCE($3, min_role)
       WHERE id = $4
       RETURNING id, name, description, min_role, created_by, is_archived, created_at`,
      [name?.trim() ?? null, description?.trim() ?? null, min_role ?? null, req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Channel nicht gefunden')); return }
    res.json(ok(rows[0]))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// DELETE /api/chat/channels/:id — archive channel (admin only)
chatRouter.delete('/channels/:id', requireAuth(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE channels SET is_archived = true WHERE id = $1
       RETURNING id`,
      [req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Channel nicht gefunden')); return }
    res.json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// POST /api/chat/channels/:id/members — add member (admin/trainer)
chatRouter.post('/channels/:id/members', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    const { userId } = req.body as { userId?: string }
    if (!userId) { res.status(400).json(err('userId erforderlich')); return }
    await pool.query(
      `INSERT INTO channel_members (channel_id, user_id, added_by)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [req.params.id, userId, req.user!.id],
    )
    res.status(201).json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// DELETE /api/chat/channels/:id/members/:userId — remove member (admin/trainer)
chatRouter.delete('/channels/:id/members/:userId', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    await pool.query(
      `DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`,
      [req.params.id, req.params.userId],
    )
    res.json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})
