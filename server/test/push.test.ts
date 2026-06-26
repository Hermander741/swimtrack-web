import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({}) },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn().mockResolvedValue({}),
}))

import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

process.env.JWT_SECRET = 'test-secret-for-vitest'
process.env.VAPID_PUBLIC_KEY = 'test-public-key'
process.env.VAPID_PRIVATE_KEY = 'test-private-key'
process.env.VAPID_CONTACT = 'mailto:test@test.at'

import jwt from 'jsonwebtoken'
const adminUser = { id: 'u1', email: 'a@a.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
const adminToken = jwt.sign({ sub: 'u1', email: 'a@a.at', role: 'admin' }, 'test-secret-for-vitest', { expiresIn: '15m' })

describe('GET /api/push/vapid-public-key', () => {
  it('returns vapid public key without auth', async () => {
    const res = await request(createApp()).get('/api/push/vapid-public-key')
    expect(res.status).toBe(200)
    expect(res.body.data).toBe('test-public-key')
  })
})

describe('POST /api/push/subscribe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).post('/api/push/subscribe').send({})
    expect(res.status).toBe(401)
  })

  it('saves push subscription', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [] }) // upsert
    const res = await request(createApp())
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ endpoint: 'https://push.example.com/sub', keys: { p256dh: 'abc', auth: 'xyz' } })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('DELETE /api/push/subscribe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes own subscription', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp())
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ endpoint: 'https://push.example.com/sub' })
    expect(res.status).toBe(200)
  })
})
