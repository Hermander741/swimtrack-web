import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { userCanAccessChannel } from '../utils/channelAccess'
import { chatUpload, chatUploadDir, SIZE_LIMITS } from '../middleware/uploadChat'

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
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
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
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
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
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
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

interface DbMessage {
  id: string; channel_id: string; sender_id: string | null; sender_name: string | null
  sender_avatar_color: string | null; content: string | null; reply_to: string | null
  reply_preview: string | null; edited_at: string | null; deleted_for_all: boolean
  created_at: string
}
interface DbAttachment {
  id: string; message_id: string | null; filename: string; original_name: string
  mime_type: string; size_bytes: number; created_at: string
}
interface DbReaction { emoji: string; user_id: string; user_name: string }

// GET /api/chat/channels/:id/messages?before=<uuid>&limit=50
chatRouter.get('/channels/:id/messages', requireAuth(), async (req, res) => {
  try {
    const user = req.user!
    const canAccess = await userCanAccessChannel(user.id, user.role, req.params.id as string)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }

    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const before = req.query.before as string | undefined

    let rows: DbMessage[]
    if (before) {
      const { rows: r } = await pool.query<DbMessage>(
        `SELECT m.id, m.channel_id, m.sender_id, u.name AS sender_name,
                u.avatar_color AS sender_avatar_color,
                CASE WHEN dm.message_id IS NOT NULL THEN NULL
                     WHEN m.deleted_for_all THEN NULL
                     ELSE m.content END AS content,
                m.reply_to,
                (SELECT LEFT(rm.content, 80) FROM messages rm WHERE rm.id = m.reply_to) AS reply_preview,
                m.edited_at, m.deleted_for_all, m.created_at
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         LEFT JOIN deleted_messages dm ON dm.message_id = m.id AND dm.user_id = $4
         WHERE m.channel_id = $1
           AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)
         ORDER BY m.created_at DESC
         LIMIT $3`,
        [req.params.id, before, limit, user.id],
      )
      rows = r
    } else {
      const { rows: r } = await pool.query<DbMessage>(
        `SELECT m.id, m.channel_id, m.sender_id, u.name AS sender_name,
                u.avatar_color AS sender_avatar_color,
                CASE WHEN dm.message_id IS NOT NULL THEN NULL
                     WHEN m.deleted_for_all THEN NULL
                     ELSE m.content END AS content,
                m.reply_to,
                (SELECT LEFT(rm.content, 80) FROM messages rm WHERE rm.id = m.reply_to) AS reply_preview,
                m.edited_at, m.deleted_for_all, m.created_at
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
         LEFT JOIN deleted_messages dm ON dm.message_id = m.id AND dm.user_id = $3
         WHERE m.channel_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [req.params.id, limit, user.id],
      )
      rows = r
    }

    const messageIds = rows.map(r => r.id)
    const [{ rows: attachments }, { rows: reactions }] = messageIds.length > 0
      ? await Promise.all([
          pool.query<DbAttachment>(
            `SELECT id, message_id, filename, original_name, mime_type, size_bytes, created_at
             FROM message_attachments WHERE message_id = ANY($1)`,
            [messageIds],
          ),
          pool.query<DbReaction & { message_id: string }>(
            `SELECT mr.message_id, mr.emoji, mr.user_id, u.name AS user_name
             FROM message_reactions mr JOIN users u ON u.id = mr.user_id
             WHERE mr.message_id = ANY($1)`,
            [messageIds],
          ),
        ])
      : [{ rows: [] }, { rows: [] }]

    const messages = rows.reverse().map(m => ({
      ...m,
      attachments: attachments.filter(a => a.message_id === m.id),
      reactions: reactions.filter(r => r.message_id === m.id),
    }))

    res.json(ok(messages))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// POST /api/chat/channels/:id/attachments — upload file
chatRouter.post('/channels/:id/attachments', requireAuth(), (req, res) => {
  chatUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) { res.status(400).json(err(uploadErr.message)); return }
    try {
      const user = req.user!
      const canAccess = await userCanAccessChannel(user.id, user.role, req.params.id as string)
      if (!canAccess) {
        if (req.file) fs.unlinkSync(req.file.path)
        res.status(404).json(err('Channel nicht gefunden')); return
      }
      if (!req.file) { res.status(400).json(err('Keine Datei')); return }

      const mime = req.file.mimetype
      if (req.file.size > (SIZE_LIMITS[mime] ?? 0)) {
        fs.unlinkSync(req.file.path)
        res.status(400).json(err('Datei zu groß')); return
      }

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO message_attachments (message_id, filename, original_name, mime_type, size_bytes)
         VALUES (NULL, $1, $2, $3, $4) RETURNING id`,
        [req.file.filename, req.file.originalname, mime, req.file.size],
      )
      res.status(201).json(ok({ attachmentId: rows[0].id }))
    } catch {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      res.status(500).json(err('Hochladen fehlgeschlagen'))
    }
  })
})

// GET /api/chat/attachments/:attachmentId/file
chatRouter.get('/attachments/:attachmentId/file', requireAuth(), async (req, res) => {
  try {
    const { rows } = await pool.query<{ filename: string; original_name: string; channel_id: string }>(
      `SELECT a.filename, a.original_name, m.channel_id
       FROM message_attachments a
       JOIN messages m ON m.id = a.message_id
       WHERE a.id = $1`,
      [req.params.attachmentId],
    )
    if (!rows[0]) { res.status(404).json(err('Anhang nicht gefunden')); return }
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, rows[0].channel_id as string)
    if (!canAccess) { res.status(403).json(err('Kein Zugriff')); return }
    const resolved = path.resolve(chatUploadDir, rows[0].filename)
    const safeBase = path.resolve(chatUploadDir)
    if (!resolved.startsWith(safeBase + path.sep)) {
      res.status(400).json(err('Ungültiger Dateipfad')); return
    }
    if (!fs.existsSync(resolved)) { res.status(404).json(err('Datei nicht gefunden')); return }
    const safeFilename = encodeURIComponent(rows[0].original_name)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`)
    res.sendFile(resolved)
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// GET /api/chat/channels/:id/pins
chatRouter.get('/channels/:id/pins', requireAuth(), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    const { rows } = await pool.query(
      `SELECT pm.id, pm.channel_id, pm.message_id, pm.pinned_by, pm.pinned_at,
              m.content, m.sender_id, u.name AS sender_name, m.created_at AS message_created_at
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE pm.channel_id = $1
       ORDER BY pm.pinned_at DESC`,
      [req.params.id],
    )
    res.json(ok(rows))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// POST /api/chat/channels/:id/pins
chatRouter.post('/channels/:id/pins', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    const { messageId } = req.body as { messageId?: string }
    if (!messageId) { res.status(400).json(err('messageId erforderlich')); return }
    // Insert (ignore if already pinned), then always return full pin data
    await pool.query(
      `INSERT INTO pinned_messages (channel_id, message_id, pinned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (channel_id, message_id) DO NOTHING`,
      [req.params.id, messageId, req.user!.id],
    )
    const { rows } = await pool.query(
      `SELECT pm.id, pm.channel_id, pm.message_id, pm.pinned_by, pm.pinned_at,
              m.content, m.sender_id, u.name AS sender_name, m.created_at AS message_created_at
       FROM pinned_messages pm
       JOIN messages m ON m.id = pm.message_id
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE pm.channel_id = $1 AND pm.message_id = $2`,
      [req.params.id, messageId],
    )
    if (!rows[0]) { res.status(404).json(err('Nachricht nicht gefunden')); return }
    res.status(201).json(ok(rows[0]))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

// DELETE /api/chat/channels/:id/pins/:pinId
chatRouter.delete('/channels/:id/pins/:pinId', requireAuth(['admin', 'trainer']), async (req, res) => {
  try {
    const canAccess = await userCanAccessChannel(req.user!.id, req.user!.role, req.params.id as string)
    if (!canAccess) { res.status(404).json(err('Channel nicht gefunden')); return }
    const { rows } = await pool.query(
      `DELETE FROM pinned_messages WHERE id = $1 AND channel_id = $2 RETURNING id`,
      [req.params.pinId, req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('Pin nicht gefunden')); return }
    res.json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})
