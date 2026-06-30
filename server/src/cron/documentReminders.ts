import cron from 'node-cron'
import webpush from 'web-push'
import { pool } from '../db/pool'

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_CONTACT) return
  webpush.setVapidDetails(process.env.VAPID_CONTACT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  vapidReady = true
}

async function sendPushToUsers(userIds: string[], payload: object) {
  if (userIds.length === 0) return
  const { rows } = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1)`,
    [userIds],
  )
  await Promise.allSettled(rows.map(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    ).catch(() => {}),
  ))
}

export async function checkDocumentReminders() {
  ensureVapid()
  try {
    const { rows: rules } = await pool.query<{
      category: string; validity_days: number; reminder_days: number[]
    }>(`SELECT category, validity_days, reminder_days FROM document_validity_rules`)
    if (rules.length === 0) return

    const { rows: docs } = await pool.query<{
      id: string; user_id: string; category: string; original_name: string
      valid_until: string; reminder_sent: number[]; member_name: string
    }>(`
      SELECT md.id, md.user_id, md.category, md.original_name, md.valid_until, md.reminder_sent,
             u.name AS member_name
      FROM member_documents md
      JOIN users u ON u.id = md.user_id
      WHERE md.status = 'approved' AND md.valid_until IS NOT NULL
    `)

    const { rows: trainers } = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('admin', 'trainer')`,
    )
    const trainerIds = trainers.map(t => t.id)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const doc of docs) {
      const rule = rules.find(r => r.category === doc.category)
      if (!rule) continue

      const validUntil = new Date(doc.valid_until)
      validUntil.setHours(0, 0, 0, 0)
      const daysLeft = Math.round((validUntil.getTime() - today.getTime()) / 86400000)
      const thresholds = [...(rule.reminder_days ?? [30, 7]), 0]
      const alreadySent: number[] = doc.reminder_sent ?? []

      for (const threshold of thresholds) {
        if (alreadySent.includes(threshold)) continue
        if (daysLeft !== threshold) continue

        const expired = daysLeft <= 0
        const title = expired ? 'Dokument abgelaufen' : 'Dokument läuft bald ab'
        const body = expired
          ? `${doc.original_name} (${doc.member_name}) ist abgelaufen.`
          : `${doc.original_name} (${doc.member_name}) läuft in ${daysLeft} Tag${daysLeft === 1 ? '' : 'en'} ab.`
        const payload = { title, body, icon: '/icon-192.png', data: { url: '/mitglieder' } }

        await sendPushToUsers([doc.user_id], { ...payload, data: { url: '/profil' } })
        await sendPushToUsers(trainerIds, payload)

        await pool.query(
          `UPDATE member_documents SET reminder_sent = reminder_sent || $1::jsonb WHERE id = $2`,
          [JSON.stringify([threshold]), doc.id],
        )
        console.log(`[doc-reminder] Sent ${threshold}d reminder for ${doc.id} (${doc.category} / ${doc.member_name})`)
      }
    }
  } catch (e) {
    console.error('[doc-reminder] Error:', e)
  }
}

export function startDocumentReminderCron() {
  cron.schedule('0 8 * * *', checkDocumentReminders)
  console.log('[doc-reminder] Cron started — daily at 08:00')
}
