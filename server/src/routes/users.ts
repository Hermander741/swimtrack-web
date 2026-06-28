import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import type { Role, User } from '../types'

export const usersRouter = Router()

usersRouter.get('/', requireAuth(['admin', 'trainer']), async (_req, res) => {
  try {
    const { rows } = await pool.query<User>(
      'SELECT id, email, name, role, avatar_color, created_at FROM users ORDER BY name',
    )
    res.json(ok(rows))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})

usersRouter.patch('/me', requireAuth(), async (req, res) => {
  try {
    const { name, password, avatar_color, myresults_name } = req.body as {
      name?: string; password?: string; avatar_color?: string; myresults_name?: string
    }
    const updates: string[] = []
    const values: unknown[] = []

    if (name) { updates.push(`name = $${updates.length + 1}`); values.push(name.trim()) }
    if (avatar_color) { updates.push(`avatar_color = $${updates.length + 1}`); values.push(avatar_color) }
    if ('myresults_name' in req.body) {
      updates.push(`myresults_name = $${updates.length + 1}`)
      values.push(myresults_name ?? null)
    }
    if (password) {
      if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }
      const hash = await bcrypt.hash(password, 12)
      updates.push(`password_hash = $${updates.length + 1}`)
      values.push(hash)
    }
    if (!updates.length) { res.status(400).json(err('No fields to update')); return }

    values.push(req.user!.id)
    const { rows } = await pool.query<User>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
       RETURNING id, email, name, role, avatar_color, created_at, myresults_name`,
      values,
    )
    res.json(ok(rows[0]))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})

usersRouter.patch('/:id/role', requireAuth(['admin']), async (req, res) => {
  try {
    const { role } = req.body as { role?: Role }
    const validRoles: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
    if (!role || !validRoles.includes(role)) { res.status(400).json(err('invalid role')); return }
    const { rows } = await pool.query<User>(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, name, role, avatar_color, created_at`,
      [role, req.params.id],
    )
    if (!rows[0]) { res.status(404).json(err('User not found')); return }
    res.json(ok(rows[0]))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})

usersRouter.delete('/:id', requireAuth(['admin']), async (req, res) => {
  try {
    if (req.params.id === req.user!.id) {
      res.status(400).json(err('Cannot delete yourself')); return
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    if (!rowCount) { res.status(404).json(err('User not found')); return }
    res.json(ok(null))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})
