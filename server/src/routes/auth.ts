import crypto from 'crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool'
import { issueTokens, COOKIE_OPTS, signAccess } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { sendPasswordResetEmail } from '../utils/mail'
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

const forgotLimiter = rateLimit({ windowMs: 60_000, max: 5, validate: { xForwardedForHeader: false } })

authRouter.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string }
    if (!email) { res.status(400).json(err('E-Mail erforderlich')); return }

    const { rows } = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    )
    // Always respond ok — don't reveal whether email exists
    if (!rows[0]) { res.json(ok(null)); return }

    const user = rows[0]
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // Invalidate any existing unused tokens for this user
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
      [user.id],
    )
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash) VALUES ($1, $2)',
      [user.id, tokenHash],
    )

    await sendPasswordResetEmail(user.email, rawToken)
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

authRouter.get('/reset-password/:token', async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
    const { rows } = await pool.query<{ email: string }>(
      `SELECT u.email FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()`,
      [tokenHash],
    )
    if (!rows[0]) { res.status(404).json(err('Link ungültig oder abgelaufen')); return }
    res.json(ok({ email: rows[0].email }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string }
    if (!token || !password) { res.status(400).json(err('Token und Passwort erforderlich')); return }
    if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }
    if (!/[A-Z]/.test(password)) { res.status(400).json(err('Passwort muss mindestens einen Großbuchstaben enthalten')); return }
    if (!/[a-z]/.test(password)) { res.status(400).json(err('Passwort muss mindestens einen Kleinbuchstaben enthalten')); return }
    if (!/[0-9]/.test(password)) { res.status(400).json(err('Passwort muss mindestens eine Zahl enthalten')); return }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const { rows } = await pool.query<{ id: string; user_id: string }>(
      'UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING id, user_id',
      [tokenHash],
    )
    if (!rows[0]) { res.status(400).json(err('Link ungültig oder abgelaufen')); return }

    const hash = await bcrypt.hash(password, 12)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, rows[0].user_id])

    // Invalidate all refresh tokens — force re-login with new password
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [rows[0].user_id])

    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
