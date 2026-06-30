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
  try {
    const { email, role } = req.body as { email?: string; role?: Role }
    if (!email || !role) { res.status(400).json(err('email and role required')); return }
    const validRoles: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
    if (!validRoles.includes(role)) { res.status(400).json(err('invalid role')); return }

    if (req.user!.role === 'trainer' && role === 'admin') {
      res.status(403).json({ ok: false, error: 'Trainer können keine Admins einladen' })
      return
    }

    // Check for existing user
    const { rows: existingUsers } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    )
    if (existingUsers.length > 0) { res.status(409).json(err('E-Mail bereits registriert')); return }

    // Check for existing active invitation
    const { rows: existingInvites } = await pool.query(
      'SELECT id FROM invitations WHERE email = $1 AND used_at IS NULL AND expires_at > now()',
      [email.toLowerCase().trim()],
    )
    if (existingInvites.length > 0) { res.status(409).json(err('Ausstehende Einladung bereits vorhanden')); return }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await pool.query(
      'INSERT INTO invitations (email, role, token, invited_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [email.toLowerCase().trim(), role, token, req.user!.id, expiresAt],
    )
    await sendInvitationEmail(email.toLowerCase().trim(), role, token)
    res.json(ok({ message: 'Einladung gesendet' }))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})

invitationsRouter.get('/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, role, expires_at FROM invitations
       WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
      [req.params.token],
    )
    if (!rows[0]) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }
    res.json(ok(rows[0]))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})

invitationsRouter.post('/:token/accept', async (req, res) => {
  try {
    const { vorname, nachname, geburtsdatum, password } = req.body as {
      vorname?: string; nachname?: string; geburtsdatum?: string; password?: string
    }
    if (!vorname || !nachname || !geburtsdatum || !password) {
      res.status(400).json(err('Vorname, Nachname, Geburtsdatum und Passwort sind Pflichtfelder')); return
    }
    if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }
    if (!/[A-Z]/.test(password)) { res.status(400).json(err('Passwort muss mindestens einen Großbuchstaben enthalten')); return }
    if (!/[a-z]/.test(password)) { res.status(400).json(err('Passwort muss mindestens einen Kleinbuchstaben enthalten')); return }
    if (!/[0-9]/.test(password)) { res.status(400).json(err('Passwort muss mindestens eine Zahl enthalten')); return }

    // Atomically claim the invitation — only one concurrent request succeeds
    const { rows: invRows } = await pool.query<{ id: string; email: string; role: Role }>(
      `UPDATE invitations SET used_at = now()
       WHERE token = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING id, email, role`,
      [req.params.token],
    )
    if (!invRows[0]) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }

    const inv = invRows[0]
    const fullName = `${vorname.trim()} ${nachname.trim()}`
    const hash = await bcrypt.hash(password, 12)
    try {
      const { rows: users } = await pool.query<User>(
        `INSERT INTO users (email, name, vorname, nachname, geburtsdatum, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, role, avatar_color, created_at`,
        [inv.email, fullName, vorname.trim(), nachname.trim(), geburtsdatum, inv.role, hash],
      )
      const user = users[0]
      const { accessToken, rawToken, tokenHash, tokenSelector, expiresAt } = await issueTokens(user)
      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, token_selector, expires_at) VALUES ($1, $2, $3, $4)',
        [user.id, tokenHash, tokenSelector, expiresAt],
      )
      res.cookie('rt', `${rawToken}.${tokenSelector}`, COOKIE_OPTS).json(ok({ accessToken, user }))
    } catch (e: unknown) {
      // Unique violation on email — user already exists
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
        res.status(409).json(err('E-Mail bereits registriert')); return
      }
      throw e
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json(err('Interner Fehler'))
  }
})
