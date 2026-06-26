import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

// Mock pg pool
vi.mock('../src/db/pool', () => ({
  pool: {
    query: vi.fn(),
  },
}))

// Mock bcryptjs
vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
  const compare = vi.fn()
  const compareSync = vi.fn()
  const hash = vi.fn().mockResolvedValue('$2b$12$hashedtoken')
  return {
    ...actual,
    compare,
    compareSync,
    hash,
    default: {
      ...(actual as unknown as { default: object }).default,
      compare,
      compareSync,
      hash,
    },
  }
})

import { pool } from '../src/db/pool'
import bcrypt from 'bcryptjs'

const mockPool = pool as { query: ReturnType<typeof vi.fn> }

const fakeUser = {
  id: 'uuid-1',
  email: 'admin@test.at',
  name: 'Admin',
  role: 'admin',
  avatar_color: '#0EA5E9',
  created_at: new Date().toISOString(),
  password_hash: '$2b$12$hashedfake',
}

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when email missing', async () => {
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({ password: 'x' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('returns 401 for unknown user', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.at', password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [fakeUser] })
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never)
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({ email: fakeUser.email, password: 'wrong' })
    expect(res.status).toBe(401)
  })

  it('returns accessToken + sets rt cookie on success', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [fakeUser] })
      .mockResolvedValueOnce({ rows: [] })
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never)
    const app = createApp()
    const res = await request(app).post('/api/auth/login').send({ email: fakeUser.email, password: 'correct' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.accessToken).toBeDefined()
    expect(res.headers['set-cookie']).toBeDefined()
  })
})

describe('POST /api/auth/logout', () => {
  it('clears cookie and returns ok', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const app = createApp()
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
