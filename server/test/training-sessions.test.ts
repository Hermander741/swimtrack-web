// server/test/training-sessions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { sessionsRouter } from '../src/routes/training/sessions'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/training/sessions', sessionsRouter)
  return app
}

const admin = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const trainer = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }
const member = { id: 'u3', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8B5CF6', created_at: new Date().toISOString() }
const trainerToken = jwt.sign({ sub: 'u2', email: 't@t.at', role: 'trainer' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const memberToken = jwt.sign({ sub: 'u3', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const adminToken = jwt.sign({ sub: 'u1', email: 'a@a.at', role: 'admin' }, 'test-secret-for-vitest', { expiresIn: '15m' })

const fakeSession = {
  id: 's1', group_id: 'g1', template_id: null, title: 'Montagstraining',
  date: '2026-07-07', start_time: '18:00:00', duration_min: 90, location: 'Hallenbad',
  notes: null, is_cancelled: false, is_external: false, created_by: 'u2', created_at: new Date().toISOString(),
  group_name: 'Mermaids A', group_color: '#0EA5E9', blocks: []
}

describe('GET /api/training/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when from/to missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp()).get('/api/training/sessions').set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(400)
  })

  it('returns sessions for member (own groups + external)', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [fakeSession] })
    const res = await request(makeApp())
      .get('/api/training/sessions?from=2026-07-01&to=2026-07-31')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('returns all sessions for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeSession] })
    const res = await request(makeApp())
      .get('/api/training/sessions?from=2026-07-01&to=2026-07-31')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('POST /api/training/sessions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when title missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/sessions')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ group_id: 'g1', date: '2026-07-07', start_time: '18:00' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when no group_id and not external', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/sessions')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ title: 'Test', date: '2026-07-07', start_time: '18:00' })
    expect(res.status).toBe(400)
  })

  it('creates session', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                      // BEGIN
        .mockResolvedValueOnce({ rows: [fakeSession] })       // INSERT session
        .mockResolvedValueOnce(undefined),                     // COMMIT
      release: vi.fn(),
    }
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] }) // auth
    mockPool.connect.mockResolvedValueOnce(mockClient)
    const res = await request(makeApp())
      .post('/api/training/sessions')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ group_id: 'g1', title: 'Montagstraining', date: '2026-07-07', start_time: '18:00' })
    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Montagstraining')
  })
})

describe('PATCH /api/training/sessions/:id — cancellation notification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts system message when session cancelled and group has channel', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [{ ...fakeSession, is_cancelled: true }] })
      .mockResolvedValueOnce({ rows: [{ channel_id: 'ch1' }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .patch('/api/training/sessions/s1')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ is_cancelled: true })
    expect(res.status).toBe(200)
    expect(mockPool.query).toHaveBeenCalledTimes(4)
  })

  it('skips notification when group has no channel', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [{ ...fakeSession, is_cancelled: true }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .patch('/api/training/sessions/s1')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ is_cancelled: true })
    expect(res.status).toBe(200)
    expect(mockPool.query).toHaveBeenCalledTimes(3)
  })
})

describe('GET /api/training/sessions/ical', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when token missing', async () => {
    const res = await request(makeApp()).get('/api/training/sessions/ical')
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/training/sessions/ical?token=bad')
    expect(res.status).toBe(401)
  })

  it('returns text/calendar for valid token', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/training/sessions/ical?token=valid-uuid')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/calendar/)
  })
})
