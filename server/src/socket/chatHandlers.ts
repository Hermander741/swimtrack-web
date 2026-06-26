import type { Server, Socket } from 'socket.io'
import { pool } from '../db/pool'
import { userCanAccessChannel } from '../utils/channelAccess'

// Lazy-load push notifications — Task 5 may not exist yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushToChannelMembers: ((channelId: string, senderId: string, senderName: string, channelName: string, preview: string) => Promise<void>) | null = null
const _pushNotifyPath = '../utils/pushNotify'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(import(_pushNotifyPath) as Promise<any>).then((m: any) => { pushToChannelMembers = m.pushToChannelMembers }).catch(() => {})

// In-memory rate limit: max 30 messages per minute per user
export const messageTimestamps = new Map<string, number[]>()
function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const ts = (messageTimestamps.get(userId) ?? []).filter(t => now - t < 60_000)
  if (ts.length >= 30) return true
  ts.push(now)
  messageTimestamps.set(userId, ts)
  return false
}

const roleRank: Record<string, number> = { admin: 4, trainer: 3, eltern: 2, mitglied: 1 }

export function registerChatHandlers(io: Server, socket: Socket) {
  const user = socket.data.user as { id: string; email: string; name: string; role: string }

  // join-channels: join all accessible rooms
  socket.on('join-channels', async () => {
    try {
      const rank = roleRank[user.role] ?? 1
      const { rows } = await pool.query<{ id: string }>(
        `SELECT c.id FROM channels c
         WHERE c.is_archived = false
           AND (
             $1 >= (CASE c.min_role WHEN 'admin' THEN 4 WHEN 'trainer' THEN 3 WHEN 'eltern' THEN 2 ELSE 1 END)
             OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = $2)
           )`,
        [rank, user.id],
      )
      for (const ch of rows) socket.join(ch.id)
    } catch { /* ignore */ }
  })

  // send-message
  socket.on('send-message', async (data: {
    channelId: string; content?: string; replyTo?: string; attachmentIds?: string[]
  }) => {
    try {
      if (isRateLimited(user.id)) {
        socket.emit('error', { message: 'Zu viele Nachrichten' }); return
      }
      const canAccess = await userCanAccessChannel(user.id, user.role, data.channelId)
      if (!canAccess) return

      const client = await pool.connect()
      let msg: { id: string; created_at: string }
      try {
        await client.query('BEGIN')
        const { rows } = await client.query<{ id: string; created_at: string }>(
          `INSERT INTO messages (channel_id, sender_id, content, reply_to)
           VALUES ($1, $2, $3, $4)
           RETURNING id, created_at`,
          [data.channelId, user.id, data.content?.trim() ?? null, data.replyTo ?? null],
        )
        msg = rows[0]

        // Link attachments in the same transaction
        if (data.attachmentIds?.length) {
          await client.query(
            `UPDATE message_attachments SET message_id = $1
             WHERE id = ANY($2) AND message_id IS NULL`,
            [msg.id, data.attachmentIds],
          )
        }
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }

      // Fetch attachments for broadcast
      const { rows: attachments } = await pool.query(
        `SELECT id, message_id, filename, original_name, mime_type, size_bytes, created_at
         FROM message_attachments WHERE message_id = $1`,
        [msg.id],
      )

      let replyPreview: string | null = null
      if (data.replyTo) {
        const { rows: rp } = await pool.query<{ content: string }>(
          `SELECT LEFT(content, 80) AS content FROM messages WHERE id = $1`,
          [data.replyTo],
        )
        replyPreview = rp[0]?.content ?? null
      }

      // Fetch sender avatar_color
      const { rows: senderRows } = await pool.query<{ avatar_color: string }>(
        'SELECT avatar_color FROM users WHERE id = $1', [user.id],
      )

      const fullMsg = {
        id: msg.id,
        channel_id: data.channelId,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar_color: senderRows[0]?.avatar_color ?? null,
        content: data.content?.trim() ?? null,
        reply_to: data.replyTo ?? null,
        reply_preview: replyPreview,
        edited_at: null,
        deleted_for_all: false,
        attachments,
        reactions: [],
        created_at: msg.created_at,
      }

      io.to(data.channelId).emit('new-message', fullMsg)

      // Push notifications (graceful degradation if Task 5 not yet implemented)
      if (pushToChannelMembers) {
        const preview = data.content?.trim() ?? (attachments.length ? '📎 Anhang' : '')
        // Look up channel name for push notification title
        const { rows: channelRows } = await pool.query<{ name: string }>(
          'SELECT name FROM channels WHERE id = $1',
          [data.channelId],
        )
        const channelName = channelRows[0]?.name ?? ''
        await pushToChannelMembers(data.channelId, user.id, user.name, channelName, preview)
      }
    } catch { /* ignore */ }
  })

  // edit-message
  socket.on('edit-message', async (data: { messageId: string; content: string }) => {
    try {
      // SELECT first to verify ownership and get channel_id
      const { rows: msgRows } = await pool.query<{ channel_id: string }>(
        `SELECT channel_id FROM messages WHERE id = $1 AND sender_id = $2 AND deleted_for_all = false`,
        [data.messageId, user.id],
      )
      if (!msgRows[0]) return
      const channelId = msgRows[0].channel_id

      // Check access before UPDATE
      const canAccess = await userCanAccessChannel(user.id, user.role, channelId)
      if (!canAccess) return

      // Now perform the UPDATE
      await pool.query(
        `UPDATE messages SET content = $1, edited_at = now()
         WHERE id = $2 AND sender_id = $3`,
        [data.content.trim(), data.messageId, user.id],
      )
      io.to(channelId).emit('message-edited', {
        messageId: data.messageId,
        content: data.content.trim(),
        editedAt: new Date().toISOString(),
      })
    } catch { /* ignore */ }
  })

  // delete-message
  socket.on('delete-message', async (data: { messageId: string; forAll: boolean }) => {
    try {
      const { rows } = await pool.query<{ channel_id: string; sender_id: string }>(
        'SELECT channel_id, sender_id FROM messages WHERE id = $1',
        [data.messageId],
      )
      if (!rows[0]) return
      const msg = rows[0]
      const canAccess = await userCanAccessChannel(user.id, user.role, msg.channel_id)
      if (!canAccess) return
      const isAdmin = user.role === 'admin'
      const isSender = msg.sender_id === user.id

      if (data.forAll) {
        if (!isSender && !isAdmin) return
        await pool.query('UPDATE messages SET deleted_for_all = true WHERE id = $1', [data.messageId])
        io.to(msg.channel_id).emit('message-deleted', { messageId: data.messageId, deletedForAll: true })
      } else {
        await pool.query(
          'INSERT INTO deleted_messages (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [data.messageId, user.id],
        )
        socket.emit('message-deleted', { messageId: data.messageId, deletedForAll: false })
      }
    } catch { /* ignore */ }
  })

  // add-reaction
  socket.on('add-reaction', async (data: { messageId: string; emoji: string }) => {
    if (!data.emoji || typeof data.emoji !== 'string' || data.emoji.length > 10) return
    try {
      const { rows } = await pool.query<{ channel_id: string }>(
        'SELECT channel_id FROM messages WHERE id = $1', [data.messageId],
      )
      if (!rows[0]) return
      const canAccess = await userCanAccessChannel(user.id, user.role, rows[0].channel_id)
      if (!canAccess) return
      await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [data.messageId, user.id, data.emoji],
      )
      io.to(rows[0].channel_id).emit('reaction-added', {
        messageId: data.messageId, userId: user.id, userName: user.name, emoji: data.emoji,
      })
    } catch { /* ignore */ }
  })

  // remove-reaction
  socket.on('remove-reaction', async (data: { messageId: string; emoji: string }) => {
    try {
      const { rows } = await pool.query<{ channel_id: string }>(
        'SELECT channel_id FROM messages WHERE id = $1', [data.messageId],
      )
      if (!rows[0]) return
      const canAccess = await userCanAccessChannel(user.id, user.role, rows[0].channel_id)
      if (!canAccess) return
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [data.messageId, user.id, data.emoji],
      )
      io.to(rows[0].channel_id).emit('reaction-removed', {
        messageId: data.messageId, userId: user.id, emoji: data.emoji,
      })
    } catch { /* ignore */ }
  })

  // typing-start — broadcast to room excluding sender
  socket.on('typing-start', (data: { channelId: string }) => {
    socket.to(data.channelId).emit('typing', { channelId: data.channelId, userId: user.id, name: user.name })
  })

  // typing-stop — broadcast to room excluding sender
  socket.on('typing-stop', (data: { channelId: string }) => {
    socket.to(data.channelId).emit('stopped-typing', { channelId: data.channelId, userId: user.id })
  })

  // mark-read
  socket.on('mark-read', async (data: { channelId: string; lastMessageId: string }) => {
    try {
      const canAccess = await userCanAccessChannel(user.id, user.role, data.channelId)
      if (!canAccess) return
      await pool.query(
        `INSERT INTO channel_reads (channel_id, user_id, last_message_id, read_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (channel_id, user_id) DO UPDATE
           SET last_message_id = EXCLUDED.last_message_id, read_at = now()`,
        [data.channelId, user.id, data.lastMessageId],
      )
      io.to(data.channelId).emit('message-read', {
        channelId: data.channelId, lastMessageId: data.lastMessageId,
        userId: user.id, readAt: new Date().toISOString(),
      })
    } catch { /* ignore */ }
  })
}
