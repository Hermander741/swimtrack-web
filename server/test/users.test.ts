import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
  return { ...actual, hash: vi.fn().mockResolvedValue('$2b$12$hashed') }
})

import { pool } from '../src/db/pool'
import jwt from 'jsonwebtoken'

const mockPool = pool as { query: ReturnType<typeof vi.fn> }

function makeAuthHeader(role = 'admin', userId = 'uuid-1') {
  return `Bearer ${jwt.sign({ sub: userId, email: 'a@b.at', role }, process.env.JWT_SECRET!, { expiresIn: '15m' })}`
}

const adminUser = { id: 'uuid-1', email: 'a@b.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }

describe('GET /api/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('returns user list for admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })  // requireAuth lookup
      .mockResolvedValueOnce({ rows: [adminUser] })  // users query
    const res = await request(createApp())
      .get('/api/users')
      .set('Authorization', makeAuthHeader())
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('DELETE /api/users/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when deleting self', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .delete('/api/users/uuid-1')
      .set('Authorization', makeAuthHeader('admin', 'uuid-1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user not found', async () => {
    const otherUser = { ...adminUser, id: 'uuid-2' }
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })  // requireAuth lookup
      .mockResolvedValueOnce({ rowCount: 0 })         // DELETE
    const res = await request(createApp())
      .delete('/api/users/uuid-2')
      .set('Authorization', makeAuthHeader('admin', 'uuid-1'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/users/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp())
      .patch('/api/users/me')
      .send({ name: 'New Name' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when password too short', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .patch('/api/users/me')
      .set('Authorization', makeAuthHeader())
      .send({ password: 'short' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when no fields provided', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .patch('/api/users/me')
      .set('Authorization', makeAuthHeader())
      .send({})
    expect(res.status).toBe(400)
  })

  it('updates user name successfully', async () => {
    const updatedUser = { ...adminUser, name: 'New Name' }
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })   // requireAuth lookup
      .mockResolvedValueOnce({ rows: [updatedUser] }) // UPDATE
    const res = await request(createApp())
      .patch('/api/users/me')
      .set('Authorization', makeAuthHeader())
      .send({ name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('New Name')
  })
})

describe('PATCH /api/users/:id/role', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for non-admin', async () => {
    const trainerUser = { ...adminUser, role: 'trainer' }
    mockPool.query.mockResolvedValueOnce({ rows: [trainerUser] })
    const res = await request(createApp())
      .patch('/api/users/uuid-2/role')
      .set('Authorization', makeAuthHeader('trainer'))
      .send({ role: 'mitglied' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid role', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .patch('/api/users/uuid-2/role')
      .set('Authorization', makeAuthHeader())
      .send({ role: 'invalid' })
    expect(res.status).toBe(400)
  })
})
