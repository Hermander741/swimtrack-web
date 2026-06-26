import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { CookieOptions } from 'express'
import type { User } from '../types'

const ACCESS_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000

export const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_EXPIRES_MS,
  path: '/',
}

export function signAccess(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })
}

export function verifyAccess(token: string): { sub: string; email: string; role: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string; email: string; role: string }
}

export async function issueTokens(user: User) {
  const accessToken = signAccess(user)
  const rawToken = crypto.randomUUID()
  const tokenHash = await bcrypt.hash(rawToken, 12)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS)
  return { accessToken, rawToken, tokenHash, expiresAt }
}
