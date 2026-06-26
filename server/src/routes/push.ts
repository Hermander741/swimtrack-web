import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'

export const pushRouter = Router()

pushRouter.get('/vapid-public-key', (_req, res) => {
  res.json(ok(process.env.VAPID_PUBLIC_KEY ?? ''))
})

pushRouter.post('/subscribe', requireAuth(), async (req, res) => {
  try {
    const { endpoint, keys } = req.body as {
      endpoint?: string; keys?: { p256dh?: string; auth?: string }
    }
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json(err('endpoint und keys erforderlich')); return
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user!.id, endpoint, keys.p256dh, keys.auth],
    )
    res.json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})

pushRouter.delete('/subscribe', requireAuth(), async (req, res) => {
  try {
    const { endpoint } = req.body as { endpoint?: string }
    if (!endpoint) { res.status(400).json(err('endpoint erforderlich')); return }
    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user!.id, endpoint],
    )
    res.json(ok(null))
  } catch {
    res.status(500).json(err('Interner Fehler'))
  }
})
