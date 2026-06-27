// server/test/training-attendance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { attendanceRouter } from '../src/routes/training/attendance'

function makeApp() {
  const app = express()
  app.use(express.json())
  // mergeParams needed so :id flows from parent
  app.use('/api/training/sessions/:id/attendance', attendanceRouter)
  return app
}

const trainer = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }
const member  = { id: 'u3', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8B5CF6', created_at: new Date().toISOString() }
const trainerToken = jwt.sign({ sub: 'u2', email: 't@t.at', role: 'trainer' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const memberToken  = jwt.sign({ sub: 'u3', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })

describe('GET /api/training/sessions/:id/attendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).get('/api/training/sessions/s1/attendance')
    expect(res.status).toBe(401)
  })

  it('returns attendance array for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u3' }, { user_id: 'u4' }] })
    const res = await request(makeApp())
      .get('/api/training/sessions/s1/attendance')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.attendance).toEqual(['u3', 'u4'])
  })

  it('returns own present status for member', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'u3' }] })
    const res = await request(makeApp())
      .get('/api/training/sessions/s1/attendance')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.present).toBe(true)
  })

  it('returns present: false when member not in list', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [member] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .get('/api/training/sessions/s1/attendance')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.present).toBe(false)
  })
})

describe('POST /api/training/sessions/:id/attendance/:userId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for member', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .post('/api/training/sessions/s1/attendance/u3')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
  })

  it('marks attendance for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .post('/api/training/sessions/s1/attendance/u3')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('DELETE /api/training/sessions/:id/attendance/:userId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for member', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp())
      .delete('/api/training/sessions/s1/attendance/u3')
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
  })

  it('removes attendance for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/training/sessions/s1/attendance/u3')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
