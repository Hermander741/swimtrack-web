import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return { ...actual, existsSync: vi.fn().mockReturnValue(true), mkdirSync: vi.fn() }
})

import { pool } from '../src/db/pool'
import jwt from 'jsonwebtoken'

const mockPool = pool as { query: ReturnType<typeof vi.fn> }

function makeAuthHeader(role = 'admin') {
  return `Bearer ${jwt.sign({ sub: 'uuid-1', email: 'a@b.at', role }, process.env.JWT_SECRET!, { expiresIn: '15m' })}`
}

const adminUser = { id: 'uuid-1', email: 'a@b.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }

describe('GET /api/documents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/documents')
    expect(res.status).toBe(401)
  })

  it('returns document list for authenticated user', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp())
      .get('/api/documents')
      .set('Authorization', makeAuthHeader())
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('DELETE /api/documents/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 for unauthenticated', async () => {
    const res = await request(createApp()).delete('/api/documents/doc-1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for mitglied role', async () => {
    const mitglied = { ...adminUser, role: 'mitglied' }
    mockPool.query.mockResolvedValueOnce({ rows: [mitglied] })
    const res = await request(createApp())
      .delete('/api/documents/doc-1')
      .set('Authorization', makeAuthHeader('mitglied'))
    expect(res.status).toBe(403)
  })
})
