import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { sendInvitationEmail } from '../utils/mail'
import { issueTokens, COOKIE_OPTS } from '../utils/jwt'
import { ok, err } from '../types'
import type { Role, User } from '../types'

export const invitationsRouter = Router()

invitationsRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { email, role } = req.body as { email?: string; role?: Role }
  if (!email || !role) { res.status(400).json(err('email and role required')); return }
  const validRoles: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
  if (!validRoles.includes(role)) { res.status(400).json(err('invalid role')); return }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.query(
    'INSERT INTO invitations (email, role, token, invited_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [email.toLowerCase().trim(), role, token, req.user!.id, expiresAt],
  )
  await sendInvitationEmail(email, role, token)
  res.json(ok({ message: 'Einladung gesendet' }))
})

invitationsRouter.get('/:token', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, role, expires_at FROM invitations
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [req.params.token],
  )
  if (!rows[0]) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }
  res.json(ok(rows[0]))
})

invitationsRouter.post('/:token/accept', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string }
  if (!name || !password) { res.status(400).json(err('name and password required')); return }
  if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }

  const { rows } = await pool.query(
    `SELECT id, email, role FROM invitations
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [req.params.token],
  )
  const inv = rows[0]
  if (!inv) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }

  const hash = await bcrypt.hash(password, 12)
  const { rows: users } = await pool.query<User>(
    `INSERT INTO users (email, name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, avatar_color, created_at`,
    [inv.email, name.trim(), inv.role, hash],
  )
  await pool.query('UPDATE invitations SET used_at = now() WHERE id = $1', [inv.id])

  const user = users[0]
  const { accessToken, rawToken, tokenHash, tokenSelector, expiresAt } = await issueTokens(user)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, token_selector, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, tokenHash, tokenSelector, expiresAt],
  )
  res.cookie('rt', `${rawToken}.${tokenSelector}`, COOKIE_OPTS).json(ok({ accessToken, user }))
})
