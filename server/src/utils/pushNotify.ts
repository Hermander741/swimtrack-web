import webpush from 'web-push'
import { pool } from '../db/pool'
import { connectedUsers } from '../socket/index'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_CONTACT) return
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  vapidConfigured = true
}

export async function pushToChannelMembers(
  channelId: string,
  senderId: string,
  senderName: string,
  channelName: string,
  messagePreview: string,
): Promise<void> {
  ensureVapid()
  if (!vapidConfigured) return

  const { rows: members } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT u.id AS user_id
     FROM users u
     CROSS JOIN channels c
     LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = u.id
     WHERE c.id = $1
       AND u.id != $2
       AND c.is_archived = false
       AND (
         (CASE u.role WHEN 'admin' THEN 4 WHEN 'trainer' THEN 3 WHEN 'eltern' THEN 2 ELSE 1 END)
         >= (CASE c.min_role WHEN 'admin' THEN 4 WHEN 'trainer' THEN 3 WHEN 'eltern' THEN 2 ELSE 1 END)
         OR cm.user_id IS NOT NULL
       )`,
    [channelId, senderId],
  )

  const offlineIds = members.filter(m => !connectedUsers.has(m.user_id)).map(m => m.user_id)
  if (offlineIds.length === 0) return

  const { rows: subs } = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)`,
    [offlineIds],
  )
  if (subs.length === 0) return

  const body = messagePreview.slice(0, 100)
  const payload = JSON.stringify({
    title: channelName ? `#${channelName}` : 'Mermaids Chat',
    body: `${senderName}: ${body}`,
    icon: '/mermaids-logo.svg',
    badge: '/mermaids-logo.svg',
    data: { channelId },
  })

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(() => { /* stale subscription — ignore */ }),
    ),
  )
}
