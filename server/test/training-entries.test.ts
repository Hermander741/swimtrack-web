import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { entriesRouter } from '../src/routes/training/entries'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/training/sessions/:id/entry', entriesRouter)
  return app
}

const member  = { id: 'u3', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8B5CF6', created_at: new Date().toISOString() }
const memberToken = jwt.sign({ sub: 'u3', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })

const recentSession = { date: new Date().toISOString().slice(0, 10) } // today — within window
const oldSession = { date: '2020-01-01' } // outside 90-day window

const fakeEntry = {
  id: 'e1', session_id: 's1', user_id: 'u3',
  note: 'Gutes Training', distance_m: 2000, rating: 3,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

describe('GET /api/training/sessions/:id/entry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/training/sessions/s1/entry')
    expect(res.status).toBe(401)
  })

  it('returns null when no entry exists', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .get('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  it('returns existing entry', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [fakeEntry] })
    const res = await request(makeApp())
      .get('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.rating).toBe(3)
  })
})

describe('PUT /api/training/sessions/:id/entry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when session is older than 90 days', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [oldSession] }) // session date check
    const res = await request(makeApp())
      .put('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ note: 'test' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid rating', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [recentSession] })
    const res = await request(makeApp())
      .put('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ rating: 5 })
    expect(res.status).toBe(400)
  })

  it('upserts entry and returns it', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [recentSession] })
      .mockResolvedValueOnce({ rows: [fakeEntry] })
    const res = await request(makeApp())
      .put('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ note: 'Gutes Training', distance_m: 2000, rating: 3 })
    expect(res.status).toBe(200)
    expect(res.body.data.note).toBe('Gutes Training')
  })
})

describe('DELETE /api/training/sessions/:id/entry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes own entry', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/training/sessions/s1/entry')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
