import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('../src/utils/mail', () => ({ sendInvitationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
  return { ...actual, hash: vi.fn().mockResolvedValue('$2b$12$hashed'), compare: vi.fn().mockResolvedValue(true) }
})

import { pool } from '../src/db/pool'
import jwt from 'jsonwebtoken'

const mockPool = pool as { query: ReturnType<typeof vi.fn> }

const validToken = 'a'.repeat(64)
const adminUser = {
  id: 'uuid-admin', email: 'admin@test.at', name: 'Admin',
  role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString(),
}

function authHeader() {
  return `Bearer ${jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role }, process.env.JWT_SECRET!, { expiresIn: '15m' })}`
}

describe('GET /api/invitations/:token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for invalid token', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp()).get(`/api/invitations/${validToken}`)
    expect(res.status).toBe(404)
  })

  it('returns invitation data for valid token', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'inv-1', email: 'new@test.at', role: 'mitglied', expires_at: new Date(Date.now() + 86400000).toISOString() }],
    })
    const res = await request(createApp()).get(`/api/invitations/${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe('new@test.at')
  })
})

describe('POST /api/invitations/:token/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when password too short', async () => {
    const res = await request(createApp())
      .post(`/api/invitations/${validToken}/accept`)
      .send({ name: 'Test', password: 'short' })
    expect(res.status).toBe(400)
  })

  it('creates user and returns tokens on valid accept', async () => {
    const newUser = { id: 'uuid-new', email: 'new@test.at', name: 'Test', role: 'mitglied', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'inv-1', email: 'new@test.at', role: 'mitglied' }] })
      .mockResolvedValueOnce({ rows: [newUser] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp())
      .post(`/api/invitations/${validToken}/accept`)
      .send({ name: 'Test', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe('new@test.at')
    expect(res.body.data.accessToken).toBeDefined()
  })
})

describe('POST /api/invitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp())
      .post('/api/invitations')
      .send({ email: 'x@x.at', role: 'mitglied' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when email or role missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .post('/api/invitations')
      .set('Authorization', authHeader())
      .send({ email: 'x@x.at' })
    expect(res.status).toBe(400)
  })

  it('sends invitation for valid request', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })  // requireAuth lookup
      .mockResolvedValueOnce({ rows: [] })            // INSERT invitation
    const res = await request(createApp())
      .post('/api/invitations')
      .set('Authorization', authHeader())
      .send({ email: 'new@test.at', role: 'mitglied' })
    expect(res.status).toBe(200)
    expect(res.body.data.message).toBe('Einladung gesendet')
  })
})
