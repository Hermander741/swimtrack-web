import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool'
import { issueTokens, COOKIE_OPTS, signAccess } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import type { User } from '../types'

export const authRouter = Router()

const loginLimiter = rateLimit({ windowMs: 60_000, max: 10, validate: { xForwardedForHeader: false } })

authRouter.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) { res.status(400).json(err('email and password required')); return }

    const { rows } = await pool.query<User & { password_hash: string }>(
      'SELECT id, email, name, role, avatar_color, created_at, myresults_name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json(err('Invalid credentials')); return
    }

    const { accessToken, rawToken, tokenHash, tokenSelector, expiresAt } = await issueTokens(user)
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, token_selector, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, tokenHash, tokenSelector, expiresAt],
    )

    const { password_hash: _, ...safeUser } = user
    res.cookie('rt', `${rawToken}.${tokenSelector}`, COOKIE_OPTS).json(ok({ accessToken, user: safeUser }))
  } catch { res.status(500).json({ ok: false, error: 'Interner Fehler' }) }
})

authRouter.post('/refresh', async (req, res) => {
  try {
    const rawCookie: string | undefined = req.cookies['rt']
    if (!rawCookie) { res.status(401).json(err('No refresh token')); return }
    const dotIndex = rawCookie.lastIndexOf('.')
    if (dotIndex === -1) { res.status(401).json(err('Invalid refresh token')); return }
    const rawToken = rawCookie.slice(0, dotIndex)
    const tokenSelector = rawCookie.slice(dotIndex + 1)

    const { rows } = await pool.query<{ id: string; user_id: string; token_hash: string }>(
      'SELECT id, user_id, token_hash FROM refresh_tokens WHERE token_selector = $1 AND expires_at > now()',
      [tokenSelector],
    )
    if (!rows[0] || !(await bcrypt.compare(rawToken, rows[0].token_hash))) {
      res.status(401).json(err('Invalid refresh token')); return
    }

    const { rows: users } = await pool.query<User>(
      'SELECT id, email, name, role, avatar_color, created_at, myresults_name FROM users WHERE id = $1',
      [rows[0].user_id],
    )
    if (!users[0]) { res.status(401).json(err('User not found')); return }

    const accessToken = signAccess(users[0])
    res.json(ok({ accessToken }))
  } catch { res.status(500).json({ ok: false, error: 'Interner Fehler' }) }
})

authRouter.post('/logout', async (req, res) => {
  const rawCookie: string | undefined = req.cookies['rt']
  if (rawCookie) {
    const dotIndex = rawCookie.lastIndexOf('.')
    if (dotIndex !== -1) {
      const rawToken = rawCookie.slice(0, dotIndex)
      const tokenSelector = rawCookie.slice(dotIndex + 1)
      const { rows } = await pool.query<{ id: string; token_hash: string }>(
        'SELECT id, token_hash FROM refresh_tokens WHERE token_selector = $1 AND expires_at > now()',
        [tokenSelector],
      )
      if (rows[0] && (await bcrypt.compare(rawToken, rows[0].token_hash))) {
        await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id])
      }
    }
  }
  res.clearCookie('rt', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' }).json(ok(null))
})

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json(ok(req.user!))
})
