// server/test/training-groups.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'

import express from 'express'
import { groupsRouter } from '../src/routes/training/groups'
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/training/groups', groupsRouter)
  return app
}

const admin = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const trainer = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }
const member = { id: 'u3', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8B5CF6', created_at: new Date().toISOString() }

const adminToken = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role }, 'test-secret-for-vitest', { expiresIn: '15m' })
const trainerToken = jwt.sign({ sub: trainer.id, email: trainer.email, role: trainer.role }, 'test-secret-for-vitest', { expiresIn: '15m' })
const memberToken = jwt.sign({ sub: member.id, email: member.email, role: member.role }, 'test-secret-for-vitest', { expiresIn: '15m' })

const fakeGroup = { id: 'g1', name: 'Mermaids A', description: null, color: '#0EA5E9', channel_id: null, created_by: 'u1', created_at: new Date().toISOString() }

describe('GET /api/training/groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/training/groups')
    expect(res.status).toBe(401)
  })

  it('returns all groups for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeGroup] })
    const res = await request(makeApp())
      .get('/api/training/groups')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })

  it('returns only member groups for mitglied', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [fakeGroup] })
    const res = await request(makeApp())
      .get('/api/training/groups')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('POST /api/training/groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for member', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/training/groups')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Test' })
    expect(res.status).toBe(403)
  })

  it('returns 400 when name missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/groups')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('creates group', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeGroup] })
    const res = await request(makeApp())
      .post('/api/training/groups')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ name: 'Mermaids A' })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Mermaids A')
  })
})

describe('DELETE /api/training/groups/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for trainer (admin only)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .delete('/api/training/groups/g1')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(403)
  })

  it('deletes group as admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/training/groups/g1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
