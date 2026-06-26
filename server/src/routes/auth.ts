import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool'
import { issueTokens, verifyAccess, COOKIE_OPTS } from '../utils/jwt'
import { signAccess } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import type { User } from '../types'

export const authRouter = Router()

const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 })

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) { res.status(400).json(err('email and password required')); return }

  const { rows } = await pool.query<User & { password_hash: string }>(
    'SELECT id, email, name, role, avatar_color, created_at, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  )
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json(err('Invalid credentials')); return
  }

  const { accessToken, rawToken, tokenHash, expiresAt } = await issueTokens(user)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt],
  )

  const { password_hash: _, ...safeUser } = user
  res.cookie('rt', rawToken, COOKIE_OPTS).json(ok({ accessToken, user: safeUser }))
})

authRouter.post('/refresh', async (req, res) => {
  const rawToken: string | undefined = req.cookies['rt']
  if (!rawToken) { res.status(401).json(err('No refresh token')); return }

  const { rows } = await pool.query<{ id: string; user_id: string; token_hash: string; expires_at: string }>(
    'SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE expires_at > now()',
  )
  const match = rows.find(r => bcrypt.compareSync(rawToken, r.token_hash))
  if (!match) { res.status(401).json(err('Invalid refresh token')); return }

  const { rows: users } = await pool.query<User>(
    'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
    [match.user_id],
  )
  if (!users[0]) { res.status(401).json(err('User not found')); return }

  const accessToken = signAccess(users[0])
  res.json(ok({ accessToken }))
})

authRouter.post('/logout', async (req, res) => {
  const rawToken: string | undefined = req.cookies['rt']
  if (rawToken) {
    const { rows } = await pool.query<{ id: string; token_hash: string }>(
      'SELECT id, token_hash FROM refresh_tokens WHERE expires_at > now()',
    )
    const match = rows.find(r => bcrypt.compareSync(rawToken, r.token_hash))
    if (match) await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [match.id])
  }
  res.clearCookie('rt', { path: '/' }).json(ok(null))
})

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json(ok(req.user!))
})
