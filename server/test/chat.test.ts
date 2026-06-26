import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))

import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

const adminUser = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const trainerUser = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }

// JWT for admin
process.env.JWT_SECRET = 'test-secret-for-vitest'
import jwt from 'jsonwebtoken'
const adminToken = jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role }, 'test-secret-for-vitest', { expiresIn: '15m' })
const trainerToken = jwt.sign({ sub: trainerUser.id, email: trainerUser.email, role: trainerUser.role }, 'test-secret-for-vitest', { expiresIn: '15m' })

const fakeChannel = { id: 'c1', name: 'Allgemein', description: null, min_role: 'mitglied', created_by: 'u1', is_archived: false, created_at: new Date().toISOString() }

describe('GET /api/chat/channels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/chat/channels')
    expect(res.status).toBe(401)
  })

  it('returns channels list for authenticated user', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })  // requireAuth user lookup
      .mockResolvedValueOnce({ rows: [fakeChannel] }) // channels query
    const res = await request(createApp())
      .get('/api/chat/channels')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('POST /api/chat/channels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for non-trainer', async () => {
    const memberToken = jwt.sign({ sub: 'u3', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'u3', role: 'mitglied' }] })
    const res = await request(createApp())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Test' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when name missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates channel and returns it', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [fakeChannel] })
    const res = await request(createApp())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Allgemein', min_role: 'mitglied' })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Allgemein')
  })
})

describe('DELETE /api/chat/channels/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for trainer (admin only)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainerUser] })
    const res = await request(createApp())
      .delete('/api/chat/channels/c1')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(403)
  })

  it('archives channel for admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [fakeChannel] })
    const res = await request(createApp())
      .delete('/api/chat/channels/c1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
