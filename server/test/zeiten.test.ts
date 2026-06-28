// server/test/zeiten.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { zeitenRouter } from '../src/routes/zeiten'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/zeiten', zeitenRouter)
  return app
}

const admin  = { id: 'u1', email: 'a@a.at', name: 'Admin',   role: 'admin',   avatar_color: '#0ea5e9', created_at: new Date().toISOString() }
const member = { id: 'u2', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8b5cf6', created_at: new Date().toISOString() }
const adminToken  = jwt.sign({ sub: 'u1', email: 'a@a.at', role: 'admin' },   'test-secret-for-vitest', { expiresIn: '15m' })
const memberToken = jwt.sign({ sub: 'u2', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })

const sampleRow = {
  id: 'z1', user_id: 'u2', user_name: 'Mitglied', event: '100m Freistil', course: 'LB',
  time_ms: 58000, date: '2026-01-01', competition: null, created_by: null,
  created_at: '2026-01-01T00:00:00Z', is_pb: true,
}

describe('GET /api/zeiten/events', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/zeiten/events')
    expect(res.status).toBe(401)
  })

  it('returns SWIM_EVENTS list', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .get('/api/zeiten/events')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toContain('100m Freistil')
    expect(res.body.data).toContain('100m Lagen')
    expect(res.body.data.length).toBe(18)
  })
})

describe('GET /api/zeiten/bestzeiten', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/zeiten/bestzeiten')
    expect(res.status).toBe(401)
  })

  it('returns array of PBs', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ ...sampleRow, is_pb: true }] })
    const res = await request(makeApp())
      .get('/api/zeiten/bestzeiten')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].is_pb).toBe(true)
    expect(res.body.data[0].event).toBe('100m Freistil')
  })
})

describe('GET /api/zeiten', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/zeiten')
    expect(res.status).toBe(401)
  })

  it('returns items + total', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ ...sampleRow, is_pb: true, total_count: '1' }] })
    const res = await request(makeApp())
      .get('/api/zeiten?limit=100&offset=0')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.total).toBe(1)
    expect(res.body.data.items[0].is_pb).toBe(true)
  })

  it('passes user_id filter to query', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    await request(makeApp())
      .get('/api/zeiten?user_id=u2&limit=50&offset=0')
      .set('Authorization', `Bearer ${memberToken}`)
    const call = mockPool.query.mock.calls[1]
    expect(call[1]).toContain('u2')
  })

  it('returns empty list when no times exist', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .get('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(0)
    expect(res.body.data.total).toBe(0)
  })
})

describe('POST /api/zeiten', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).post('/api/zeiten').send({})
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid event', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ event: 'Freistil Unbekannt', course: 'LB', time_ms: 58000, date: '2026-01-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Disziplin/)
  })

  it('returns 400 for non-integer time_ms', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ event: '100m Freistil', course: 'LB', time_ms: 58.5, date: '2026-01-01' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for zero time_ms', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ event: '100m Freistil', course: 'LB', time_ms: 0, date: '2026-01-01' })
    expect(res.status).toBe(400)
  })

  it('returns 403 when member tries to set foreign user_id', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ user_id: 'u99', event: '100m Freistil', course: 'LB', time_ms: 58000, date: '2026-01-01' })
    expect(res.status).toBe(403)
  })

  it('inserts time and returns entry with is_pb', async () => {
    const insertedRow = { ...sampleRow, is_pb: true }
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })                     // requireAuth
      .mockResolvedValueOnce({ rows: [{ id: 'z1' }] })              // INSERT RETURNING id
      .mockResolvedValueOnce({ rows: [insertedRow] })                // SELECT with is_pb
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ event: '100m Freistil', course: 'LB', time_ms: 58000, date: '2026-01-01' })
    expect(res.status).toBe(200)
    expect(res.body.data.is_pb).toBe(true)
    expect(res.body.data.event).toBe('100m Freistil')
  })

  it('admin can insert for another user', async () => {
    const insertedRow = { ...sampleRow, user_id: 'u2', is_pb: false }
    mockPool.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [{ id: 'z1' }] })
      .mockResolvedValueOnce({ rows: [insertedRow] })
    const res = await request(makeApp())
      .post('/api/zeiten')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: 'u2', event: '100m Freistil', course: 'LB', time_ms: 58000, date: '2026-01-01' })
    expect(res.status).toBe(200)
    expect(res.body.data.user_id).toBe('u2')
  })
})

describe('PATCH /api/zeiten/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).patch('/api/zeiten/z1').send({})
    expect(res.status).toBe(401)
  })

  it('returns 404 when time not found', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })   // ownership check
    const res = await request(makeApp())
      .patch('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ time_ms: 57000 })
    expect(res.status).toBe(404)
  })

  it('returns 403 when member edits foreign time', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u99' }] })  // ownership check
    const res = await request(makeApp())
      .patch('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ time_ms: 57000 })
    expect(res.status).toBe(403)
  })

  it('updates own time and returns updated entry', async () => {
    const updatedRow = { ...sampleRow, time_ms: 57000 }
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u2' }] })  // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 'z1' }] })        // UPDATE RETURNING id
      .mockResolvedValueOnce({ rows: [updatedRow] })           // SELECT with is_pb
    const res = await request(makeApp())
      .patch('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ time_ms: 57000 })
    expect(res.status).toBe(200)
    expect(res.body.data.time_ms).toBe(57000)
  })

  it('returns 400 for invalid event in PATCH', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u2' }] })
    const res = await request(makeApp())
      .patch('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ event: 'Bogus Disziplin' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/zeiten/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).delete('/api/zeiten/z1')
    expect(res.status).toBe(401)
  })

  it('returns 404 when not found', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 when member deletes foreign time', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u99' }] })
    const res = await request(makeApp())
      .delete('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
  })

  it('deletes own time and returns null', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u2' }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/zeiten/z1')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})
