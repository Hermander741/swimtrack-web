// server/test/training-blocks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
import { blocksRouter } from '../src/routes/training/blocks'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/training/blocks', blocksRouter)
  return app
}

const admin = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const trainer = { id: 'u2', email: 't@t.at', name: 'Trainer', role: 'trainer', avatar_color: '#14B8A6', created_at: new Date().toISOString() }
const member = { id: 'u3', email: 'm@m.at', name: 'Mitglied', role: 'mitglied', avatar_color: '#8B5CF6', created_at: new Date().toISOString() }
const adminToken = jwt.sign({ sub: 'u1', email: 'a@a.at', role: 'admin' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const trainerToken = jwt.sign({ sub: 'u2', email: 't@t.at', role: 'trainer' }, 'test-secret-for-vitest', { expiresIn: '15m' })
const memberToken = jwt.sign({ sub: 'u3', email: 'm@m.at', role: 'mitglied' }, 'test-secret-for-vitest', { expiresIn: '15m' })

const fakeBlock = { id: 'b1', name: '200m Freistil', category: 'hauptset', distance_m: 200, stroke: 'Freistil', reps: 4, rest_s: 30, description: null, created_by: 'u2', created_at: new Date().toISOString() }

describe('GET /api/training/blocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 for member', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [member] })
    const res = await request(makeApp()).get('/api/training/blocks').set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
  })

  it('returns blocks for trainer', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeBlock] })
    const res = await request(makeApp()).get('/api/training/blocks').set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('POST /api/training/blocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when name missing', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp()).post('/api/training/blocks').set('Authorization', `Bearer ${trainerToken}`).send({ category: 'hauptset' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid category', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [trainer] })
    const res = await request(makeApp()).post('/api/training/blocks').set('Authorization', `Bearer ${trainerToken}`).send({ name: 'Test', category: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('creates block', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [fakeBlock] })
    const res = await request(makeApp())
      .post('/api/training/blocks')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ name: '200m Freistil', category: 'hauptset', distance_m: 200, reps: 4, rest_s: 30 })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('200m Freistil')
  })
})

describe('DELETE /api/training/blocks/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when trainer tries to delete other trainer block', async () => {
    const otherTrainer = { ...trainer, id: 'u9' }
    mockPool.query
      .mockResolvedValueOnce({ rows: [otherTrainer] })
      .mockResolvedValueOnce({ rows: [{ created_by: 'u2' }] })
    const otherToken = jwt.sign({ sub: 'u9', email: 'x@x.at', role: 'trainer' }, 'test-secret-for-vitest', { expiresIn: '15m' })
    const res = await request(makeApp()).delete('/api/training/blocks/b1').set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(403)
  })

  it('allows trainer to delete own block', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [trainer] })
      .mockResolvedValueOnce({ rows: [{ created_by: 'u2' }] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).delete('/api/training/blocks/b1').set('Authorization', `Bearer ${trainerToken}`)
    expect(res.status).toBe(200)
  })

  it('allows admin to delete any block', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [admin] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp()).delete('/api/training/blocks/b1').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
