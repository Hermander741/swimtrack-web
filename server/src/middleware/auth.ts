import type { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt'
import { pool } from '../db/pool'
import type { User, Role } from '../types'

declare global {
  namespace Express {
    interface Request { user?: User }
  }
}

export function requireAuth(roles?: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? ''
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
    try {
      const payload = verifyAccess(header.slice(7))
      const { rows } = await pool.query<User>(
        'SELECT id, email, name, role, avatar_color, avatar_url, created_at, myresults_name FROM users WHERE id = $1',
        [payload.sub],
      )
      if (!rows[0]) { res.status(401).json({ ok: false, error: 'User not found' }); return }
      if (roles && !roles.includes(rows[0].role)) {
        res.status(403).json({ ok: false, error: 'Forbidden' }); return
      }
      req.user = rows[0]
      next()
    } catch {
      res.status(401).json({ ok: false, error: 'Invalid token' })
    }
  }
}
