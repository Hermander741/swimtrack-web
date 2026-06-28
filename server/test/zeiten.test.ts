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
