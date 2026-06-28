// server/src/utils/trainingPushCron.ts
import cron from 'node-cron'
import webpush from 'web-push'
import { pool } from '../db/pool'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_CONTACT) return
  webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
}

export function startTrainingPushCron() {
  cron.schedule('* * * * *', async () => {
    ensureVapid()
    if (!vapidConfigured) return

    try {
      // Find non-cancelled, non-external group sessions starting in 55–65 minutes (Vienna time)
      const { rows: sessions } = await pool.query<{ id: string; title: string; group_id: string }>(`
        SELECT ts.id, ts.title, ts.group_id
        FROM training_sessions ts
        WHERE ts.is_cancelled = false
          AND ts.is_external = false
          AND ts.group_id IS NOT NULL
          AND (ts.date + ts.start_time) AT TIME ZONE 'Europe/Vienna'
              BETWEEN now() + INTERVAL '55 minutes'
                  AND now() + INTERVAL '65 minutes'
      `)

      for (const session of sessions) {
        // Collect target users: group members + all trainers/admins
        const { rows: targets } = await pool.query<{ user_id: string }>(`
          SELECT DISTINCT u.id AS user_id
          FROM users u
          WHERE u.id IN (
            SELECT user_id FROM training_group_members WHERE group_id = $1
            UNION
            SELECT id FROM users WHERE role IN ('trainer', 'admin')
          )
        `, [session.group_id])

        const targetIds = targets.map(t => t.user_id)
        if (targetIds.length === 0) continue

        // Filter to users who haven't been notified yet for this session
        const { rows: unsent } = await pool.query<{ user_id: string; endpoint: string; p256dh: string; auth: string }>(`
          SELECT ps.user_id, ps.endpoint, ps.p256dh, ps.auth
          FROM push_subscriptions ps
          WHERE ps.user_id = ANY($1::uuid[])
            AND NOT EXISTS (
              SELECT 1 FROM training_push_sent tps
              WHERE tps.session_id = $2 AND tps.user_id = ps.user_id
            )
        `, [targetIds, session.id])

        if (unsent.length === 0) continue

        const payload = JSON.stringify({
          title: 'Mermaids Training',
          body: `Training beginnt in 1 Stunde: ${session.title}`,
          icon: '/mermaids-logo.svg',
          badge: '/mermaids-logo.svg',
          data: { sessionId: session.id, url: '/training' },
        })

        await Promise.allSettled(
          unsent.map(async sub => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              )
            } catch (err: any) {
              if (err?.statusCode === 410) {
                await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
              }
            }
          }),
        )

        // Mark as sent (de-duplication)
        await Promise.allSettled(
          unsent.map(sub =>
            pool.query(
              `INSERT INTO training_push_sent (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [session.id, sub.user_id],
            ),
          ),
        )
      }
    } catch (e) {
      console.error('[trainingPushCron] error:', e)
    }
  })
}
