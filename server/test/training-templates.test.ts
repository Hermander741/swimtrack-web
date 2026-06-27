// server/test/training-templates.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { templatesRouter } from '../src/routes/training/templates'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/training/templates', templatesRouter)
  return app
}

const admin = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const trainer = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }
const adminToken = jwt.sign({ sub: 'u1', email: 'a@a.at', role: 'admin' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const trainerToken = jwt.sign({ sub: 'u2', email: 't@t.at', role: 'trainer' }, 'test-secret-for-vitest', { expiresIn: '15m' })

const fakeTemplate = {
  id: 't1', group_id: 'g1', day_of_week: 1, start_time: '18:00:00',
  duration_min: 90, location: 'Hallenbad', title: 'Dienstags Training',
  is_active: true, created_by: 'u1', created_at: new Date().toISOString()
}

describe('GET /api/training/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns templates with blocks', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeTemplate] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).get('/api/training/templates').set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].blocks).toEqual([])
  })
})

describe('POST /api/training/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when group_id missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/templates')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ day_of_week: 1, start_time: '18:00', title: 'Test' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when day_of_week out of range', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/templates')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ group_id: 'g1', day_of_week: 7, start_time: '18:00', title: 'Test' })
    expect(res.status).toBe(400)
  })

  it('creates template', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeTemplate] })
    const res = await request(makeApp())
      .post('/api/training/templates')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ group_id: 'g1', day_of_week: 1, start_time: '18:00', title: 'Dienstags Training' })
    expect(res.status).toBe(201)
    expect(res.body.data.title).toBe('Dienstags Training')
  })
})

describe('POST /api/training/templates/:id/generate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when from/to missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .post('/api/training/templates/t1/generate')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ from: '2026-07-01' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when template not found', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .post('/api/training/templates/t1/generate')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ from: '2026-07-01', to: '2026-07-31' })
    expect(res.status).toBe(404)
  })

  it('generates sessions, skipping existing ones', async () => {
    // Template is day_of_week=1 (Tuesday). Range 2026-07-06 to 2026-07-14 has Tuesdays on 07 and 14.
    // 07-07 (Tuesday) exists already, 07-14 (Tuesday) does not.
    const templateWithBlocks = { ...fakeTemplate, blocks: [] }
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined)                        // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'new-session' }] })// INSERT session
        .mockResolvedValueOnce(undefined),                       // COMMIT
      release: vi.fn(),
    }
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [templateWithBlocks] })   // template query
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] })             // existing check: 07-07 exists
      .mockResolvedValueOnce({ rows: [] })                     // existing check: 07-14 does not exist
    mockPool.connect.mockResolvedValueOnce(mockClient)
    const res = await request(makeApp())
      .post('/api/training/templates/t1/generate')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ from: '2026-07-06', to: '2026-07-14' })
    expect(res.status).toBe(200)
    expect(res.body.data.created).toBe(1)
  })
})

describe('DELETE /api/training/templates/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for trainer (admin only)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp())
      .delete('/api/training/templates/t1')
      .set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(403)
  })

  it('deletes as admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .delete('/api/training/templates/t1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
