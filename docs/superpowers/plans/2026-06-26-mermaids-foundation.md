# Mermaids App — Sub-Projekt 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the Mermaids multi-user swim club platform: PostgreSQL database, JWT auth, email invitations, document management, and the premium glassmorphism design system.

**Architecture:** Express backend with pg (node-postgres) runs on port 3001 alongside the existing SwimTrack scrapers. New routes are added under `/api/auth`, `/api/invitations`, `/api/users`, `/api/documents`. Frontend is fully rewritten with an ocean color palette, glassmorphism UI components, and React Router-based navigation with auth context.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Node.js v24, Express 4, PostgreSQL, pg 8, bcryptjs, jsonwebtoken, nodemailer, multer, express-rate-limit, cookie-parser, supertest, vitest

## Global Constraints

- Node.js v24, Express 4, TypeScript via ts-node (existing setup)
- React 19, Vite 8, Tailwind CSS v4 with CSS-first `@theme {}` block
- Roles MUST be exactly: `'admin' | 'trainer' | 'eltern' | 'mitglied'`
- JWT access token: 15 min, HS256, signed with `JWT_SECRET` env var
- JWT refresh token: 30 days, UUID stored as bcrypt hash in `refresh_tokens` table, httpOnly + Secure cookie named `rt`
- bcrypt cost factor: 12
- File upload: max 10 MB, `application/pdf` only, filename sanitized (no path separators, UUID prefix)
- CORS: only origins from `ALLOWED_ORIGINS` env var
- Rate limiting: max 10 login attempts per minute per IP on POST `/api/auth/login`
- API responses: always `{ ok: true, data: T }` or `{ ok: false, error: string }`
- All colors from palette: ocean-950 `#050D1A`, ocean-900 `#0A1628`, ocean-800 `#0F2040`, teal-500 `#14B8A6`, teal-400 `#2DD4BF`, sky-500 `#0EA5E9`, slate-400 `#94A3B8`, slate-600 `#475569`
- Avatar default color: `#0EA5E9`
- First admin created by seed.ts if no users exist (uses `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars)
- Existing SwimTrack scraper routes (`/api/meets`, `/api/swimmer`) must remain fully functional
- Test runner: vitest (already configured in server/)
- HTTP integration tests: supertest with a mocked pg pool (never hit real DB in tests)
- Frontend text: German (UI labels in German as per spec)

---

## File Structure

**Server — new/modified files:**
```
server/
  src/
    app.ts                         CREATE — Express app config (extracted from index.ts)
    index.ts                       MODIFY — becomes startup: migrate → seed → listen
    db/
      pool.ts                      CREATE — pg Pool singleton
      migrate.ts                   CREATE — runs SQL migration files in order
      seed.ts                      CREATE — creates first admin if no users exist
      migrations/
        001_initial.sql            CREATE — CREATE TABLE users, invitations, documents, refresh_tokens
    middleware/
      auth.ts                      CREATE — requireAuth(roles?) middleware, attaches req.user
      upload.ts                    CREATE — multer config (10MB, PDF only, UUID filename)
    utils/
      jwt.ts                       CREATE — signAccess(), issueTokens(), verifyAccess(), COOKIE_OPTS
      mail.ts                      CREATE — nodemailer transporter + sendInvitationEmail()
    routes/
      auth.ts                      CREATE — /login /refresh /logout /me
      invitations.ts               CREATE — POST / GET /:token POST /:token/accept
      users.ts                     CREATE — GET / PATCH /:id/role DELETE /:id PATCH /me
      documents.ts                 CREATE — GET / POST / GET /:id/file DELETE /:id
    types.ts                       MODIFY — add User, Invitation, Document, Role types
  test/
    auth.test.ts                   CREATE — login, refresh, logout, me routes
    invitations.test.ts            CREATE — create invitation, validate token, accept
    users.test.ts                  CREATE — list, role change, delete, update me
    documents.test.ts              CREATE — list, upload, download, delete
```

**Frontend — new/modified files:**
```
src/
  index.css                        MODIFY — add @theme ocean tokens, safe-area utilities
  types/
    index.ts                       MODIFY — add User, Invitation, Document, Role
  api/
    client.ts                      CREATE — fetch wrapper with JWT bearer + auto-refresh
    auth.ts                        CREATE — login(), refresh(), logout(), me()
    users.ts                       CREATE — listUsers(), updateMyProfile(), changeRole(), deleteUser()
    documents.ts                   CREATE — listDocuments(), uploadDocument(), downloadDocument(), deleteDocument()
  hooks/
    useAuth.ts                     CREATE — AuthContext + useAuth() hook
  components/
    ui/
      Button.tsx                   CREATE — variant: primary | secondary | ghost | danger
      Card.tsx                     CREATE — glassmorphism card
      Input.tsx                    CREATE — floating label input
      Modal.tsx                    CREATE — bottom sheet modal
      Avatar.tsx                   CREATE — initials + color circle
      Badge.tsx                    CREATE — role badge
    layout/
      BottomNav.tsx                CREATE — 5-tab bottom navigation
      TopBar.tsx                   CREATE — title + optional right action
      PageShell.tsx                CREATE — TopBar + scrollable content + BottomNav
  pages/
    Login.tsx                      CREATE — full-screen auth page with logo
    Register.tsx                   CREATE — invitation acceptance page (/register?token=...)
    Dashboard.tsx                  CREATE — greeting, quick stats, recent docs
    Mitglieder.tsx                 CREATE — member list + invite FAB (admin/trainer)
    Dokumente.tsx                  CREATE — segmented documents list + upload FAB
    Profil.tsx                     CREATE — profile view + password change + logout
    Placeholder.tsx                CREATE — "Coming Soon" page for Chat/Training/Zeiten
  App.tsx                          MODIFY — AuthProvider + React Router routes
```

---

### Task 1: DB + Server Foundation

**Files:**
- Create: `server/src/db/pool.ts`
- Create: `server/src/db/migrations/001_initial.sql`
- Create: `server/src/db/migrate.ts`
- Create: `server/src/db/seed.ts`
- Create: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/types.ts`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `pool` (Pool singleton from `db/pool.ts`), `runMigrations()`, `runSeed()`, `createApp()` (Express Application), `User`, `Role` types in `types.ts`

- [ ] **Step 1: Install server dependencies**

```bash
cd server
npm install pg bcryptjs jsonwebtoken nodemailer multer express-rate-limit cookie-parser
npm install --save-dev supertest @types/pg @types/bcryptjs @types/jsonwebtoken @types/nodemailer @types/multer @types/supertest @types/cookie-parser
```

Expected: package.json updated, node_modules populated.

- [ ] **Step 2: Create `server/src/db/migrations/001_initial.sql`**

```sql
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','trainer','eltern','mitglied')),
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#0EA5E9',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','trainer','eltern','mitglied')),
  token       TEXT UNIQUE NOT NULL,
  invited_by  UUID REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('anmeldeformular','vereinsdokument','sonstiges')),
  filename    TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Add `Role`, `User`, `Invitation`, `Document` to `server/src/types.ts`**

Append to the end of `server/src/types.ts`:

```ts
export type Role = 'admin' | 'trainer' | 'eltern' | 'mitglied'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar_color: string
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  token: string
  invited_by: string | null
  expires_at: string
  used_at: string | null
}

export interface Document {
  id: string
  name: string
  category: 'anmeldeformular' | 'vereinsdokument' | 'sonstiges'
  filename: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}
```

- [ ] **Step 4: Create `server/src/db/pool.ts`**

```ts
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
```

- [ ] **Step 5: Create `server/src/db/migrate.ts`**

```ts
import fs from 'fs'
import path from 'path'
import { pool } from './pool'

export async function runMigrations(): Promise<void> {
  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await pool.query(sql)
    console.log(`Migration applied: ${file}`)
  }
}
```

- [ ] **Step 6: Create `server/src/db/seed.ts`**

```ts
import bcrypt from 'bcryptjs'
import { pool } from './pool'

export async function runSeed(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) return

  const { rows } = await pool.query('SELECT id FROM users LIMIT 1')
  if (rows.length > 0) return

  const hash = await bcrypt.hash(password, 12)
  await pool.query(
    `INSERT INTO users (email, name, role, password_hash, avatar_color)
     VALUES ($1, $2, 'admin', $3, '#0EA5E9')`,
    [email, 'Admin', hash],
  )
  console.log(`First admin created: ${email}`)
}
```

- [ ] **Step 7: Create `server/src/app.ts`** (extracted Express config)

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { meetsRouter } from './routes/meets'
import { resultsRouter } from './routes/results'
import { liveRouter } from './routes/live'
import { swimmerRouter } from './routes/swimmer'

export function createApp() {
  const app = express()
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.some(o => origin === o.trim())) cb(null, true)
      else cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }))

  app.use(express.json())
  app.use(cookieParser())

  app.get('/health', (_req, res) => res.json({ ok: true, version: '3.0.0' }))

  app.use('/api/meets', meetsRouter)
  app.use('/api/meets', liveRouter)
  app.use('/api/meets', resultsRouter)
  app.use('/api/swimmer', swimmerRouter)

  return app
}
```

- [ ] **Step 8: Rewrite `server/src/index.ts`** to startup-only

```ts
import { createApp } from './app'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

async function main() {
  await runMigrations()
  await runSeed()
  const app = createApp()
  const PORT = process.env.PORT ?? 3001
  app.listen(PORT, () => console.log(`Mermaids API running on port ${PORT}`))
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 9: Verify existing tests still pass**

```bash
cd server && npm test
```

Expected: all existing tests (resultTable, etc.) pass. No DB connection needed for scraper tests.

- [ ] **Step 10: Commit**

```bash
git add server/package.json server/package-lock.json \
  server/src/app.ts server/src/index.ts server/src/types.ts \
  server/src/db/pool.ts server/src/db/migrate.ts server/src/db/seed.ts \
  server/src/db/migrations/001_initial.sql
git commit -m "feat(mermaids): server foundation — pg, auth deps, DB migrations, app/index split"
```

---

### Task 2: Auth Backend

**Files:**
- Create: `server/src/utils/jwt.ts`
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/test/auth.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `pool` from `db/pool.ts`, `User`, `Role` from `types.ts`, `createApp()` from `app.ts`
- Produces: `requireAuth` middleware (attaches `req.user: User` to request), `authRouter` mounted at `/api/auth`

- [ ] **Step 1: Create `server/src/utils/jwt.ts`**

```ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import type { CookieOptions } from 'express'
import type { User } from '../types'

const ACCESS_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000

export const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: REFRESH_EXPIRES_MS,
  path: '/',
}

export function signAccess(user: Pick<User, 'id' | 'email' | 'role'>): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })
}

export function verifyAccess(token: string): { sub: string; email: string; role: string } {
  return jwt.verify(token, ACCESS_SECRET) as { sub: string; email: string; role: string }
}

export async function issueTokens(user: User) {
  const accessToken = signAccess(user)
  const rawToken = crypto.randomUUID()
  const tokenHash = await bcrypt.hash(rawToken, 12)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS)
  return { accessToken, rawToken, tokenHash, expiresAt }
}
```

- [ ] **Step 2: Create `server/src/middleware/auth.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt'
import { pool } from '../db/pool'
import type { User, Role } from '../types'

declare global {
  namespace Express {
    interface Request { user?: User }
  }
}

export function requireAuth(roles?: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? ''
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
    try {
      const payload = verifyAccess(header.slice(7))
      const { rows } = await pool.query<User>(
        'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
        [payload.sub],
      )
      if (!rows[0]) { res.status(401).json({ ok: false, error: 'User not found' }); return }
      if (roles && !roles.includes(rows[0].role)) {
        res.status(403).json({ ok: false, error: 'Forbidden' }); return
      }
      req.user = rows[0]
      next()
    } catch {
      res.status(401).json({ ok: false, error: 'Invalid token' })
    }
  }
}
```

- [ ] **Step 3: Create `server/src/routes/auth.ts`**

```ts
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { pool } from '../db/pool'
import { issueTokens, verifyAccess, COOKIE_OPTS } from '../utils/jwt'
import { signAccess } from '../utils/jwt'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import type { User } from '../types'

export const authRouter = Router()

const loginLimiter = rateLimit({ windowMs: 60_000, max: 10 })

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) { res.status(400).json(err('email and password required')); return }

  const { rows } = await pool.query<User & { password_hash: string }>(
    'SELECT id, email, name, role, avatar_color, created_at, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  )
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json(err('Invalid credentials')); return
  }

  const { accessToken, rawToken, tokenHash, expiresAt } = await issueTokens(user)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt],
  )

  const { password_hash: _, ...safeUser } = user
  res.cookie('rt', rawToken, COOKIE_OPTS).json(ok({ accessToken, user: safeUser }))
})

authRouter.post('/refresh', async (req, res) => {
  const rawToken: string | undefined = req.cookies['rt']
  if (!rawToken) { res.status(401).json(err('No refresh token')); return }

  const { rows } = await pool.query<{ id: string; user_id: string; token_hash: string; expires_at: string }>(
    'SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE expires_at > now()',
  )
  const match = rows.find(r => bcrypt.compareSync(rawToken, r.token_hash))
  if (!match) { res.status(401).json(err('Invalid refresh token')); return }

  const { rows: users } = await pool.query<User>(
    'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
    [match.user_id],
  )
  if (!users[0]) { res.status(401).json(err('User not found')); return }

  const accessToken = signAccess(users[0])
  res.json(ok({ accessToken }))
})

authRouter.post('/logout', async (req, res) => {
  const rawToken: string | undefined = req.cookies['rt']
  if (rawToken) {
    const { rows } = await pool.query<{ id: string; token_hash: string }>(
      'SELECT id, token_hash FROM refresh_tokens WHERE expires_at > now()',
    )
    const match = rows.find(r => bcrypt.compareSync(rawToken, r.token_hash))
    if (match) await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [match.id])
  }
  res.clearCookie('rt', { path: '/' }).json(ok(null))
})

authRouter.get('/me', requireAuth(), (req, res) => {
  res.json(ok(req.user!))
})
```

- [ ] **Step 4: Mount auth router in `server/src/app.ts`**

Add after the existing imports and before `return app`:

```ts
import { authRouter } from './routes/auth'
// ...inside createApp(), before return app:
app.use('/api/auth', authRouter)
```

- [ ] **Step 5: Write failing tests in `server/test/auth.test.ts`**

```ts
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
  return {
    ...actual,
    compare: vi.fn(),
    compareSync: vi.fn(),
    hash: vi.fn().mockResolvedValue('$2b$12$hashedtoken'),
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
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd server && npm test auth.test.ts
```

Expected: some tests fail because routes don't exist yet (or pass for validation errors).

- [ ] **Step 7: Run tests again to verify they pass after implementation**

```bash
cd server && npm test auth.test.ts
```

Expected: all 5 auth tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/utils/jwt.ts server/src/middleware/auth.ts \
  server/src/routes/auth.ts server/src/app.ts server/test/auth.test.ts
git commit -m "feat(mermaids): auth backend — JWT, requireAuth middleware, login/refresh/logout/me"
```

---

### Task 3: Invitations + Users Backend

**Files:**
- Create: `server/src/utils/mail.ts`
- Create: `server/src/routes/invitations.ts`
- Create: `server/src/routes/users.ts`
- Create: `server/test/invitations.test.ts`
- Create: `server/test/users.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `pool`, `requireAuth`, `issueTokens`, `COOKIE_OPTS`, `ok`, `err`, `User`, `Role`, `Invitation`
- Produces: `invitationsRouter` at `/api/invitations`, `usersRouter` at `/api/users`

- [ ] **Step 1: Create `server/src/utils/mail.ts`**

```ts
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

export async function sendInvitationEmail(to: string, role: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  const link = `${appUrl}/register?token=${token}`
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: 'Einladung zur Mermaids App',
    html: `
      <p>Du wurdest als <strong>${role}</strong> zur Mermaids Schwimmverein App eingeladen.</p>
      <p><a href="${link}">Jetzt registrieren</a></p>
      <p>Dieser Link ist 7 Tage gültig.</p>
    `,
  })
}
```

- [ ] **Step 2: Create `server/src/routes/invitations.ts`**

```ts
import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { sendInvitationEmail } from '../utils/mail'
import { issueTokens, COOKIE_OPTS } from '../utils/jwt'
import { ok, err } from '../types'
import type { Role, User } from '../types'

export const invitationsRouter = Router()

invitationsRouter.post('/', requireAuth(['admin', 'trainer']), async (req, res) => {
  const { email, role } = req.body as { email?: string; role?: Role }
  if (!email || !role) { res.status(400).json(err('email and role required')); return }
  const validRoles: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
  if (!validRoles.includes(role)) { res.status(400).json(err('invalid role')); return }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await pool.query(
    'INSERT INTO invitations (email, role, token, invited_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [email.toLowerCase().trim(), role, token, req.user!.id, expiresAt],
  )
  await sendInvitationEmail(email, role, token)
  res.json(ok({ message: 'Einladung gesendet' }))
})

invitationsRouter.get('/:token', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, role, expires_at FROM invitations
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [req.params.token],
  )
  if (!rows[0]) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }
  res.json(ok(rows[0]))
})

invitationsRouter.post('/:token/accept', async (req, res) => {
  const { name, password } = req.body as { name?: string; password?: string }
  if (!name || !password) { res.status(400).json(err('name and password required')); return }
  if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }

  const { rows } = await pool.query(
    `SELECT id, email, role FROM invitations
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [req.params.token],
  )
  const inv = rows[0]
  if (!inv) { res.status(404).json(err('Ungültiger oder abgelaufener Einladungslink')); return }

  const hash = await bcrypt.hash(password, 12)
  const { rows: users } = await pool.query<User>(
    `INSERT INTO users (email, name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, avatar_color, created_at`,
    [inv.email, name.trim(), inv.role, hash],
  )
  await pool.query('UPDATE invitations SET used_at = now() WHERE id = $1', [inv.id])

  const user = users[0]
  const { accessToken, rawToken, tokenHash, expiresAt } = await issueTokens(user)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt],
  )
  res.cookie('rt', rawToken, COOKIE_OPTS).json(ok({ accessToken, user }))
})
```

- [ ] **Step 3: Create `server/src/routes/users.ts`**

```ts
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import type { Role, User } from '../types'

export const usersRouter = Router()

usersRouter.get('/', requireAuth(['admin', 'trainer']), async (_req, res) => {
  const { rows } = await pool.query<User>(
    'SELECT id, email, name, role, avatar_color, created_at FROM users ORDER BY name',
  )
  res.json(ok(rows))
})

usersRouter.patch('/me', requireAuth(), async (req, res) => {
  const { name, password, avatar_color } = req.body as {
    name?: string; password?: string; avatar_color?: string
  }
  const updates: string[] = []
  const values: unknown[] = []

  if (name) { updates.push(`name = $${updates.length + 1}`); values.push(name.trim()) }
  if (avatar_color) { updates.push(`avatar_color = $${updates.length + 1}`); values.push(avatar_color) }
  if (password) {
    if (password.length < 8) { res.status(400).json(err('Passwort muss mindestens 8 Zeichen haben')); return }
    const hash = await bcrypt.hash(password, 12)
    updates.push(`password_hash = $${updates.length + 1}`)
    values.push(hash)
  }
  if (!updates.length) { res.status(400).json(err('No fields to update')); return }

  values.push(req.user!.id)
  const { rows } = await pool.query<User>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
     RETURNING id, email, name, role, avatar_color, created_at`,
    values,
  )
  res.json(ok(rows[0]))
})

usersRouter.patch('/:id/role', requireAuth(['admin']), async (req, res) => {
  const { role } = req.body as { role?: Role }
  const validRoles: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
  if (!role || !validRoles.includes(role)) { res.status(400).json(err('invalid role')); return }
  const { rows } = await pool.query<User>(
    `UPDATE users SET role = $1 WHERE id = $2
     RETURNING id, email, name, role, avatar_color, created_at`,
    [role, req.params.id],
  )
  if (!rows[0]) { res.status(404).json(err('User not found')); return }
  res.json(ok(rows[0]))
})

usersRouter.delete('/:id', requireAuth(['admin']), async (req, res) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json(err('Cannot delete yourself')); return
  }
  const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
  if (!rowCount) { res.status(404).json(err('User not found')); return }
  res.json(ok(null))
})
```

- [ ] **Step 4: Mount routers in `server/src/app.ts`**

Add after existing imports and before `return app`:

```ts
import { invitationsRouter } from './routes/invitations'
import { usersRouter } from './routes/users'
// inside createApp():
app.use('/api/invitations', invitationsRouter)
app.use('/api/users', usersRouter)
```

- [ ] **Step 5: Write failing tests in `server/test/invitations.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('../src/utils/mail', () => ({ sendInvitationEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
  return { ...actual, hash: vi.fn().mockResolvedValue('$2b$12$hashed'), compare: vi.fn().mockResolvedValue(true) }
})

import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

const validToken = 'a'.repeat(64)
const adminUser = {
  id: 'uuid-admin', email: 'admin@test.at', name: 'Admin',
  role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString(),
}

function authHeader() {
  // Use a real signed token for middleware to accept
  process.env.JWT_SECRET = 'testsecret'
  const jwt = require('jsonwebtoken')
  return `Bearer ${jwt.sign({ sub: adminUser.id, email: adminUser.email, role: adminUser.role }, 'testsecret', { expiresIn: '15m' })}`
}

describe('GET /api/invitations/:token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 for invalid token', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp()).get(`/api/invitations/${validToken}`)
    expect(res.status).toBe(404)
  })

  it('returns invitation data for valid token', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'inv-1', email: 'new@test.at', role: 'mitglied', expires_at: new Date(Date.now() + 86400000).toISOString() }],
    })
    const res = await request(createApp()).get(`/api/invitations/${validToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.email).toBe('new@test.at')
  })
})

describe('POST /api/invitations/:token/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when password too short', async () => {
    const res = await request(createApp())
      .post(`/api/invitations/${validToken}/accept`)
      .send({ name: 'Test', password: 'short' })
    expect(res.status).toBe(400)
  })

  it('creates user and returns tokens on valid accept', async () => {
    const newUser = { id: 'uuid-new', email: 'new@test.at', name: 'Test', role: 'mitglied', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }
    mockPool.query
      .mockResolvedValueOnce({ rows: [{ id: 'inv-1', email: 'new@test.at', role: 'mitglied' }] })
      .mockResolvedValueOnce({ rows: [newUser] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp())
      .post(`/api/invitations/${validToken}/accept`)
      .send({ name: 'Test', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.data.user.email).toBe('new@test.at')
    expect(res.body.data.accessToken).toBeDefined()
  })
})
```

- [ ] **Step 6: Write failing tests in `server/test/users.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('bcryptjs', async () => {
  const actual = await vi.importActual<typeof import('bcryptjs')>('bcryptjs')
  return { ...actual, hash: vi.fn().mockResolvedValue('$2b$12$hashed') }
})

import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

function makeAuthHeader(role = 'admin', userId = 'uuid-1') {
  process.env.JWT_SECRET = 'testsecret'
  const jwt = require('jsonwebtoken')
  return `Bearer ${jwt.sign({ sub: userId, email: 'a@b.at', role }, 'testsecret', { expiresIn: '15m' })}`
}

const adminUser = { id: 'uuid-1', email: 'a@b.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }

describe('GET /api/users', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('returns user list for admin', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })  // requireAuth lookup
      .mockResolvedValueOnce({ rows: [adminUser] })  // users query
    const res = await request(createApp())
      .get('/api/users')
      .set('Authorization', makeAuthHeader())
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('DELETE /api/users/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when deleting self', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [adminUser] })
    const res = await request(createApp())
      .delete('/api/users/uuid-1')
      .set('Authorization', makeAuthHeader('admin', 'uuid-1'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 7: Run all tests**

```bash
cd server && npm test
```

Expected: all tests pass including new invitations and users tests.

- [ ] **Step 8: Commit**

```bash
git add server/src/utils/mail.ts server/src/routes/invitations.ts \
  server/src/routes/users.ts server/src/app.ts \
  server/test/invitations.test.ts server/test/users.test.ts
git commit -m "feat(mermaids): invitations + users backend — email invites, role management, user CRUD"
```

---

### Task 4: Documents Backend

**Files:**
- Create: `server/src/middleware/upload.ts`
- Create: `server/src/routes/documents.ts`
- Create: `server/test/documents.test.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `pool`, `requireAuth`, `ok`, `err`, `Document`, `User`
- Produces: `documentsRouter` at `/api/documents`

- [ ] **Step 1: Create `server/src/middleware/upload.ts`**

```ts
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
    cb(null, `${crypto.randomUUID()}_${safe}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Nur PDF-Dateien erlaubt'))
  },
})
```

- [ ] **Step 2: Create `server/src/routes/documents.ts`**

```ts
import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { upload } from '../middleware/upload'
import { ok, err } from '../types'
import type { Document } from '../types'

export const documentsRouter = Router()

const VALID_CATEGORIES = ['anmeldeformular', 'vereinsdokument', 'sonstiges'] as const

documentsRouter.get('/', requireAuth(), async (req, res) => {
  const category = req.query.category as string | undefined
  let query = `SELECT id, name, category, filename, size_bytes, uploaded_by, created_at
               FROM documents ORDER BY created_at DESC`
  const values: string[] = []
  if (category && VALID_CATEGORIES.includes(category as never)) {
    query = `SELECT id, name, category, filename, size_bytes, uploaded_by, created_at
             FROM documents WHERE category = $1 ORDER BY created_at DESC`
    values.push(category)
  }
  const { rows } = await pool.query<Document>(query, values)
  res.json(ok(rows))
})

documentsRouter.post('/', requireAuth(['admin', 'trainer']), upload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json(err('Keine Datei hochgeladen')); return }
  const { name, category } = req.body as { name?: string; category?: string }
  if (!name || !category) { res.status(400).json(err('name and category required')); return }
  if (!VALID_CATEGORIES.includes(category as never)) { res.status(400).json(err('invalid category')); return }

  const { rows } = await pool.query<Document>(
    `INSERT INTO documents (name, category, filename, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, category, filename, size_bytes, uploaded_by, created_at`,
    [name.trim(), category, req.file.filename, req.file.size, req.user!.id],
  )
  res.status(201).json(ok(rows[0]))
})

documentsRouter.get('/:id/file', requireAuth(), async (req, res) => {
  const { rows } = await pool.query<Document>(
    'SELECT filename FROM documents WHERE id = $1',
    [req.params.id],
  )
  if (!rows[0]) { res.status(404).json(err('Document not found')); return }
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads')
  const filePath = path.join(uploadDir, rows[0].filename)
  if (!fs.existsSync(filePath)) { res.status(404).json(err('File not found on disk')); return }
  res.sendFile(filePath)
})

documentsRouter.delete('/:id', requireAuth(['admin', 'trainer']), async (req, res) => {
  const isAdmin = req.user!.role === 'admin'
  const query = isAdmin
    ? 'DELETE FROM documents WHERE id = $1 RETURNING filename'
    : 'DELETE FROM documents WHERE id = $1 AND uploaded_by = $2 RETURNING filename'
  const values = isAdmin ? [req.params.id] : [req.params.id, req.user!.id]

  const { rows } = await pool.query<{ filename: string }>(query, values)
  if (!rows[0]) { res.status(404).json(err('Document not found or no permission')); return }

  const uploadDir = process.env.UPLOAD_DIR ?? path.join(__dirname, '../../uploads')
  const filePath = path.join(uploadDir, rows[0].filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  res.json(ok(null))
})
```

- [ ] **Step 3: Mount in `server/src/app.ts`**

```ts
import { documentsRouter } from './routes/documents'
// inside createApp():
app.use('/api/documents', documentsRouter)
```

- [ ] **Step 4: Write failing tests in `server/test/documents.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import path from 'path'
import { createApp } from '../src/app'

vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return { ...actual, existsSync: vi.fn().mockReturnValue(true), mkdirSync: vi.fn() }
})

import { pool } from '../src/db/pool'
const mockPool = pool as { query: ReturnType<typeof vi.fn> }

function makeAuthHeader(role = 'admin') {
  process.env.JWT_SECRET = 'testsecret'
  const jwt = require('jsonwebtoken')
  return `Bearer ${jwt.sign({ sub: 'uuid-1', email: 'a@b.at', role }, 'testsecret', { expiresIn: '15m' })}`
}

const adminUser = { id: 'uuid-1', email: 'a@b.at', name: 'Admin', role: 'admin', avatar_color: '#0EA5E9', created_at: new Date().toISOString() }

describe('GET /api/documents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(createApp()).get('/api/documents')
    expect(res.status).toBe(401)
  })

  it('returns document list for authenticated user', async () => {
    mockPool.query
      .mockResolvedValueOnce({ rows: [adminUser] })
      .mockResolvedValueOnce({ rows: [] })
    const res = await request(createApp())
      .get('/api/documents')
      .set('Authorization', makeAuthHeader())
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('DELETE /api/documents/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 for unauthenticated', async () => {
    const res = await request(createApp()).delete('/api/documents/doc-1')
    expect(res.status).toBe(401)
  })

  it('returns 403 for mitglied role', async () => {
    const mitglied = { ...adminUser, role: 'mitglied' }
    mockPool.query.mockResolvedValueOnce({ rows: [mitglied] })
    const res = await request(createApp())
      .delete('/api/documents/doc-1')
      .set('Authorization', makeAuthHeader('mitglied'))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 5: Run all tests**

```bash
cd server && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware/upload.ts server/src/routes/documents.ts \
  server/src/app.ts server/test/documents.test.ts
git commit -m "feat(mermaids): documents backend — multer PDF upload, download, delete with role check"
```

---

### Task 5: Design System + App Shell

**Files:**
- Modify: `src/index.css`
- Modify: `src/types/index.ts`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Avatar.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/layout/BottomNav.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/PageShell.tsx`

**Interfaces:**
- Produces: all UI primitives and layout components consumed by page tasks

- [ ] **Step 1: Add ocean theme tokens and base styles to `src/index.css`**

Replace the existing `src/index.css` content with:

```css
@import "tailwindcss";

@theme {
  --color-ocean-950: #050D1A;
  --color-ocean-900: #0A1628;
  --color-ocean-800: #0F2040;
  --color-teal-500: #14B8A6;
  --color-teal-400: #2DD4BF;
  --color-sky-500: #0EA5E9;
  --color-sky-400: #38BDF8;
  --color-slate-400: #94A3B8;
  --color-slate-600: #475569;
}

@layer base {
  * {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  html {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #050D1A;
    overscroll-behavior: none;
  }

  body {
    margin: 0;
    padding: 0;
    background: #050D1A;
    color: #ffffff;
    min-height: 100dvh;
  }

  #root {
    width: 100%;
    min-height: 100dvh;
  }

  input, textarea, select {
    font-family: inherit;
  }
}

@layer utilities {
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }

  .safe-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-bottom {
    padding-bottom: max(env(safe-area-inset-bottom), 16px);
  }

  .glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .glow-teal {
    box-shadow: 0 0 40px rgba(20, 184, 166, 0.15);
  }

  .glow-sky {
    box-shadow: 0 0 40px rgba(14, 165, 233, 0.15);
  }
}
```

- [ ] **Step 2: Add frontend types to `src/types/index.ts`**

Append to `src/types/index.ts`:

```ts
export type Role = 'admin' | 'trainer' | 'eltern' | 'mitglied'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar_color: string
  created_at: string
}

export interface Invitation {
  id: string
  email: string
  role: Role
  expires_at: string
}

export interface Document {
  id: string
  name: string
  category: 'anmeldeformular' | 'vereinsdokument' | 'sonstiges'
  filename: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}
```

- [ ] **Step 3: Create `src/components/ui/Button.tsx`**

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95'
  const variants = {
    primary: 'bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-400 hover:to-sky-400 shadow-lg shadow-teal-500/25',
    secondary: 'glass text-white hover:bg-white/10',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" /> : null}
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Create `src/components/ui/Card.tsx`**

```tsx
interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`glass rounded-2xl p-4 ${onClick ? 'cursor-pointer active:scale-98 transition-transform duration-200' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/ui/Input.tsx`**

```tsx
import { useState } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const [focused, setFocused] = useState(false)
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const hasValue = Boolean(props.value || props.defaultValue)
  const floated = focused || hasValue

  return (
    <div className={`relative ${className}`}>
      <input
        id={inputId}
        className={`w-full glass rounded-xl px-4 pt-6 pb-2 text-white placeholder-transparent outline-none transition-all duration-200
          focus:ring-2 focus:ring-teal-500/50 ${error ? 'ring-2 ring-red-500/50' : ''}`}
        placeholder={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      <label
        htmlFor={inputId}
        className={`absolute left-4 transition-all duration-200 pointer-events-none
          ${floated ? 'top-2 text-xs text-teal-400' : 'top-4 text-sm text-slate-400'}`}
      >
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Create `src/components/ui/Modal.tsx`**

```tsx
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full glass rounded-t-3xl p-6 pb-8 safe-bottom animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/components/ui/Avatar.tsx`**

```tsx
interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, color = '#0EA5E9', size = 'md' }: AvatarProps) {
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}
```

- [ ] **Step 8: Create `src/components/ui/Badge.tsx`**

```tsx
import type { Role } from '../../types'

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  eltern: 'Eltern',
  mitglied: 'Mitglied',
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  trainer: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  eltern: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  mitglied: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export function Badge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}
```

- [ ] **Step 9: Create `src/components/layout/BottomNav.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/training', label: 'Training', icon: '📅' },
  { path: '/zeiten', label: 'Zeiten', icon: '⏱' },
  { path: '/mehr', label: 'Mehr', icon: '···' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-white/8 safe-bottom z-40">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {TABS.map(tab => {
          const active = pathname === tab.path || (tab.path !== '/' && pathname.startsWith(tab.path))
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200 min-w-0
                ${active ? 'text-teal-400' : 'text-slate-400'}`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 10: Create `src/components/layout/TopBar.tsx`**

```tsx
interface TopBarProps {
  title: string
  right?: React.ReactNode
}

export function TopBar({ title, right }: TopBarProps) {
  return (
    <header className="sticky top-0 glass border-b border-white/8 z-30 safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        <h1 className="text-base font-semibold text-white">{title}</h1>
        {right && <div>{right}</div>}
      </div>
    </header>
  )
}
```

- [ ] **Step 11: Create `src/components/layout/PageShell.tsx`**

```tsx
import { BottomNav } from './BottomNav'
import { TopBar } from './TopBar'

interface PageShellProps {
  title: string
  topBarRight?: React.ReactNode
  fab?: React.ReactNode
  children: React.ReactNode
}

export function PageShell({ title, topBarRight, fab, children }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col">
      <TopBar title={title} right={topBarRight} />
      <main className="flex-1 overflow-y-auto scrollbar-none pb-24 px-4 pt-4">
        {children}
      </main>
      {fab && (
        <div className="fixed bottom-24 right-4 z-40">{fab}</div>
      )}
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 12: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 13: Commit**

```bash
git add src/index.css src/types/index.ts \
  src/components/ui/Button.tsx src/components/ui/Card.tsx \
  src/components/ui/Input.tsx src/components/ui/Modal.tsx \
  src/components/ui/Avatar.tsx src/components/ui/Badge.tsx \
  src/components/layout/BottomNav.tsx src/components/layout/TopBar.tsx \
  src/components/layout/PageShell.tsx
git commit -m "feat(mermaids): design system — ocean tokens, glassmorphism UI primitives, layout shell"
```

---

### Task 6: Auth Frontend

**Files:**
- Create: `src/api/client.ts`
- Create: `src/api/auth.ts`
- Create: `src/api/users.ts`
- Create: `src/api/documents.ts`
- Create: `src/hooks/useAuth.ts`
- Create: `src/pages/Login.tsx`
- Create: `src/pages/Register.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `User`, `Role`, `Document`, `Invitation` from `types/index.ts`; all UI components from Task 5
- Produces: `apiClient`, `useAuth()` hook, `Login` + `Register` pages, updated `App.tsx` with routing

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Create `src/api/client.ts`**

```ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

let accessToken: string | null = null

export function setAccessToken(t: string | null) { accessToken = t }
export function getAccessToken() { return accessToken }

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const body = await res.json()
    accessToken = body.data.accessToken
    return true
  } catch {
    return false
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  let res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })

  if (res.status === 401 && accessToken) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' })
    }
  }

  const json = await res.json()
  return json
}
```

- [ ] **Step 3: Create `src/api/auth.ts`**

```ts
import { apiRequest, setAccessToken } from './client'
import type { User } from '../types'

export async function login(email: string, password: string) {
  const result = await apiRequest<{ accessToken: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (result.ok) setAccessToken(result.data.accessToken)
  return result
}

export async function logout() {
  await apiRequest('/api/auth/logout', { method: 'POST' })
  setAccessToken(null)
}

export async function me() {
  return apiRequest<User>('/api/auth/me')
}

export async function refreshToken() {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) return null
  const body = await res.json()
  setAccessToken(body.data.accessToken)
  return body.data.accessToken as string
}
```

- [ ] **Step 4: Create `src/api/users.ts`**

```ts
import { apiRequest } from './client'
import type { User, Role } from '../types'

export const listUsers = () => apiRequest<User[]>('/api/users')

export const updateMe = (data: { name?: string; password?: string; avatar_color?: string }) =>
  apiRequest<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) })

export const changeRole = (id: string, role: Role) =>
  apiRequest<User>(`/api/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })

export const deleteUser = (id: string) =>
  apiRequest(`/api/users/${id}`, { method: 'DELETE' })
```

- [ ] **Step 5: Create `src/api/documents.ts`**

```ts
import { apiRequest, getAccessToken } from './client'
import type { Document } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const listDocuments = (category?: string) =>
  apiRequest<Document[]>(`/api/documents${category ? `?category=${category}` : ''}`)

export async function uploadDocument(name: string, category: string, file: File) {
  const form = new FormData()
  form.append('name', name)
  form.append('category', category)
  form.append('file', file)
  return apiRequest<Document>('/api/documents', { method: 'POST', body: form })
}

export function documentFileUrl(id: string) {
  return `${BASE}/api/documents/${id}/file`
}

export const deleteDocument = (id: string) =>
  apiRequest(`/api/documents/${id}`, { method: 'DELETE' })
```

- [ ] **Step 6: Create `src/hooks/useAuth.ts`**

```tsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { me, login as apiLogin, logout as apiLogout, refreshToken } from '../api/auth'
import { setAccessToken } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  isAdmin: boolean
  isTrainer: boolean
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refreshToken()
      .then(token => {
        if (token) return me()
        return null
      })
      .then(result => {
        if (result?.ok) setUser(result.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password)
    if (result.ok) { setUser(result.data.user); return { ok: true } }
    return { ok: false, error: result.error }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setAccessToken(null)
  }, [])

  const value: AuthContextValue = {
    user, loading, login, logout, setUser,
    isAdmin: user?.role === 'admin',
    isTrainer: user?.role === 'trainer' || user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 7: Create `src/pages/Login.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import mermaidsLogo from '../assets/mermaids-logo.svg'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.ok) navigate('/')
    else setError(result.error ?? 'Anmeldung fehlgeschlagen')
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 py-12 safe-top">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <img src={mermaidsLogo} alt="Mermaids" className="w-24 h-24 mb-4" />
          <h1 className="text-2xl font-bold text-white">Mermaids</h1>
          <p className="text-slate-400 text-sm mt-1">Schwimmverein Wien</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Passwort"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Anmelden
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/pages/Register.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { setAccessToken } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import type { Invitation, User, Role } from '../types'

export function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { setUser } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) { setTokenError('Kein Einladungslink'); return }
    apiRequest<Invitation>(`/api/invitations/${token}`).then(res => {
      if (res.ok) setInvitation(res.data)
      else setTokenError('Dieser Einladungslink ist ungültig oder abgelaufen.')
    })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    setError('')
    setLoading(true)
    const res = await apiRequest<{ accessToken: string; user: User }>(`/api/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    })
    setLoading(false)
    if (res.ok) {
      setAccessToken(res.data.accessToken)
      setUser(res.data.user)
      navigate('/')
    } else {
      setError(res.error)
    }
  }

  if (tokenError) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-2xl mb-2">😔</p>
          <p className="text-white font-semibold mb-1">Link ungültig</p>
          <p className="text-slate-400 text-sm">{tokenError}</p>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-ocean-950 flex flex-col items-center justify-center px-6 safe-top">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Registrierung</h1>
          <p className="text-slate-400 text-sm">Du wurdest eingeladen als</p>
          <div className="mt-2 flex justify-center">
            <Badge role={invitation.role as Role} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Dein Name" value={name} onChange={e => setName(e.target.value)} required />
          <Input label="Passwort (min. 8 Zeichen)" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Input label="Passwort bestätigen" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Konto erstellen
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Rewrite `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Mitglieder } from './pages/Mitglieder'
import { Dokumente } from './pages/Dokumente'
import { Profil } from './pages/Profil'
import { Placeholder } from './pages/Placeholder'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-dvh bg-ocean-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/mitglieder" element={<RequireAuth><Mitglieder /></RequireAuth>} />
      <Route path="/dokumente" element={<RequireAuth><Dokumente /></RequireAuth>} />
      <Route path="/profil" element={<RequireAuth><Profil /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><Placeholder title="Chat" icon="💬" /></RequireAuth>} />
      <Route path="/training" element={<RequireAuth><Placeholder title="Trainingsplan" icon="📅" /></RequireAuth>} />
      <Route path="/zeiten" element={<RequireAuth><Placeholder title="Zeiten" icon="⏱" /></RequireAuth>} />
      <Route path="/mehr" element={<RequireAuth><Profil /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/api/client.ts src/api/auth.ts src/api/users.ts src/api/documents.ts \
  src/hooks/useAuth.ts src/pages/Login.tsx src/pages/Register.tsx src/App.tsx \
  package.json package-lock.json
git commit -m "feat(mermaids): auth frontend — API client with auto-refresh, AuthContext, Login, Register, App routing"
```

---

### Task 7: Mitglieder Page

**Files:**
- Create: `src/pages/Mitglieder.tsx`

**Interfaces:**
- Consumes: `useAuth`, `listUsers`, `changeRole`, `deleteUser`, `sendInvitation` (POST `/api/invitations`), `PageShell`, `Avatar`, `Badge`, `Card`, `Modal`, `Button`, `Input`

- [ ] **Step 1: Create `src/pages/Mitglieder.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { listUsers, changeRole, deleteUser } from '../api/users'
import { apiRequest } from '../api/client'
import type { User, Role } from '../types'

const ROLES: Role[] = ['admin', 'trainer', 'eltern', 'mitglied']
const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', trainer: 'Trainer', eltern: 'Eltern', mitglied: 'Mitglied' }

export function Mitglieder() {
  const { isTrainer, isAdmin, user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('mitglied')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    listUsers().then(res => {
      if (res.ok) setUsers(res.data)
      setLoading(false)
    })
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    const res = await apiRequest('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    setInviteLoading(false)
    if (res.ok) {
      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => { setShowInvite(false); setInviteSuccess(false) }, 1500)
    } else {
      setInviteError((res as { ok: false; error: string }).error)
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const res = await changeRole(userId, role)
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      setSelectedUser(null)
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm('Mitglied wirklich entfernen?')) return
    const res = await deleteUser(userId)
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId))
      setSelectedUser(null)
    }
  }

  return (
    <PageShell
      title="Mitglieder"
      fab={isTrainer ? (
        <button
          onClick={() => setShowInvite(true)}
          className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full flex items-center justify-center text-2xl text-white shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
        >
          +
        </button>
      ) : undefined}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <Card key={u.id} onClick={isAdmin ? () => setSelectedUser(u) : undefined}>
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.avatar_color} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.name}</p>
                  <p className="text-slate-400 text-sm truncate">{u.email}</p>
                </div>
                <Badge role={u.role} />
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <p className="text-slate-400 text-center py-8">Keine Mitglieder gefunden</p>
          )}
        </div>
      )}

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Mitglied einladen">
        {inviteSuccess ? (
          <p className="text-center text-teal-400 py-4">✓ Einladung gesendet!</p>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input label="E-Mail" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            <div>
              <label className="block text-xs text-slate-400 mb-2">Rolle</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.filter(r => !(!isAdmin && r === 'admin')).map(r => (
                  <button
                    key={r} type="button"
                    onClick={() => setInviteRole(r)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border
                      ${inviteRole === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-slate-400 border-white/5'}`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
            <Button type="submit" loading={inviteLoading} className="w-full">Einladung senden</Button>
          </form>
        )}
      </Modal>

      {selectedUser && isAdmin && (
        <Modal open={true} onClose={() => setSelectedUser(null)} title={selectedUser.name}>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm mb-4">Rolle ändern:</p>
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => handleRoleChange(selectedUser.id, r)}
                className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all text-left border
                  ${selectedUser.role === r ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-white border-white/5'}`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
            {selectedUser.id !== currentUser?.id && (
              <Button
                variant="danger"
                className="w-full mt-4"
                onClick={() => handleDelete(selectedUser.id)}
              >
                Mitglied entfernen
              </Button>
            )}
          </div>
        </Modal>
      )}
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Mitglieder.tsx
git commit -m "feat(mermaids): Mitglieder page — member list, invite modal, role change, delete"
```

---

### Task 8: Dokumente Page

**Files:**
- Create: `src/pages/Dokumente.tsx`

**Interfaces:**
- Consumes: `useAuth`, `listDocuments`, `uploadDocument`, `deleteDocument`, `documentFileUrl`, `PageShell`, `Card`, `Modal`, `Button`, `Input`

- [ ] **Step 1: Create `src/pages/Dokumente.tsx`**

```tsx
import { useState, useEffect, useRef } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { listDocuments, uploadDocument, deleteDocument, documentFileUrl } from '../api/documents'
import { getAccessToken } from '../api/client'
import type { Document } from '../types'

type Category = 'alle' | 'anmeldeformular' | 'vereinsdokument' | 'sonstiges'

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'anmeldeformular', label: 'Anmeldeformulare' },
  { key: 'vereinsdokument', label: 'Vereinsdokumente' },
  { key: 'sonstiges', label: 'Sonstiges' },
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Dokumente() {
  const { isTrainer, isAdmin, user } = useAuth()
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('alle')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<Omit<Category, 'alle'>>('vereinsdokument')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (cat: Category) => {
    setLoading(true)
    listDocuments(cat === 'alle' ? undefined : cat).then(res => {
      if (res.ok) setDocs(res.data)
      setLoading(false)
    })
  }

  useEffect(() => { load(activeCategory) }, [activeCategory])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) { setUploadError('Bitte eine PDF-Datei auswählen'); return }
    setUploadError('')
    setUploadLoading(true)
    const res = await uploadDocument(uploadName, uploadCategory as string, uploadFile)
    setUploadLoading(false)
    if (res.ok) {
      setShowUpload(false)
      setUploadName(''); setUploadFile(null); setUploadCategory('vereinsdokument')
      load(activeCategory)
    } else {
      setUploadError((res as { ok: false; error: string }).error)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return
    const res = await deleteDocument(id)
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== id))
  }

  function downloadDoc(doc: Document) {
    const url = documentFileUrl(doc.id)
    const token = getAccessToken()
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = doc.name + '.pdf'
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  return (
    <PageShell
      title="Dokumente"
      fab={isTrainer ? (
        <button
          onClick={() => setShowUpload(true)}
          className="w-14 h-14 bg-gradient-to-r from-teal-500 to-sky-500 rounded-full flex items-center justify-center text-2xl text-white shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
        >
          +
        </button>
      ) : undefined}
    >
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 -mx-4 px-4 mb-4">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
              ${activeCategory === key ? 'bg-teal-500 text-white' : 'glass text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <Card key={doc.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{doc.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('de-AT')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadDoc(doc)}
                    className="w-8 h-8 glass rounded-lg flex items-center justify-center text-teal-400 active:scale-95 transition-transform"
                  >
                    ↓
                  </button>
                  {(isAdmin || (isTrainer && doc.uploaded_by === user?.id)) && (
                    <button
                      onClick={() => handleDelete(doc.id, doc.name)}
                      className="w-8 h-8 glass rounded-lg flex items-center justify-center text-red-400 active:scale-95 transition-transform"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {docs.length === 0 && (
            <p className="text-slate-400 text-center py-8">Keine Dokumente vorhanden</p>
          )}
        </div>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Dokument hochladen">
        <form onSubmit={handleUpload} className="space-y-4">
          <Input label="Name" value={uploadName} onChange={e => setUploadName(e.target.value)} required />
          <div>
            <label className="block text-xs text-slate-400 mb-2">Kategorie</label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.filter(c => c.key !== 'alle').map(({ key, label }) => (
                <button
                  key={key} type="button"
                  onClick={() => setUploadCategory(key as Omit<Category, 'alle'>)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border text-left
                    ${uploadCategory === key ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'glass text-slate-400 border-white/5'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full glass rounded-xl px-4 py-3 text-sm text-left transition-all hover:bg-white/5"
            >
              {uploadFile ? (
                <span className="text-teal-400">{uploadFile.name}</span>
              ) : (
                <span className="text-slate-400">PDF-Datei auswählen...</span>
              )}
            </button>
          </div>
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          <Button type="submit" loading={uploadLoading} className="w-full">Hochladen</Button>
        </form>
      </Modal>
    </PageShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dokumente.tsx
git commit -m "feat(mermaids): Dokumente page — segmented list, PDF upload, download, delete"
```

---

### Task 9: Dashboard + Profil + Placeholder

**Files:**
- Create: `src/pages/Dashboard.tsx`
- Create: `src/pages/Profil.tsx`
- Create: `src/pages/Placeholder.tsx`
- Modify: `vite.config.ts` (update PWA name to Mermaids)

**Interfaces:**
- Consumes: `useAuth`, `listUsers`, `listDocuments`, `updateMe`, `logout`, `PageShell`, `Card`, `Avatar`, `Badge`, `Button`, `Input`, `Modal`

- [ ] **Step 1: Create `src/pages/Dashboard.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listUsers } from '../api/users'
import { listDocuments } from '../api/documents'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import type { Document } from '../types'

export function Dashboard() {
  const { user, isTrainer } = useAuth()
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [recentDocs, setRecentDocs] = useState<Document[]>([])

  useEffect(() => {
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setMemberCount(res.data.length) })
    }
    listDocuments().then(res => { if (res.ok) setRecentDocs(res.data.slice(0, 3)) })
  }, [isTrainer])

  return (
    <PageShell
      title="Mermaids"
      topBarRight={
        <Link to="/profil">
          <Avatar name={user?.name ?? ''} color={user?.avatar_color} size="sm" />
        </Link>
      }
    >
      {/* Greeting */}
      <div className="mb-6">
        <p className="text-slate-400 text-sm">Willkommen zurück</p>
        <h2 className="text-2xl font-bold text-white mt-0.5">{user?.name?.split(' ')[0]} 👋</h2>
      </div>

      {/* Hero placeholder card */}
      <Card className="mb-6 bg-gradient-to-br from-teal-500/20 to-sky-500/20 border-teal-500/20 glow-teal">
        <p className="text-xs text-teal-400 font-medium mb-1">Nächster Termin</p>
        <p className="text-white font-semibold">Kommt in Sub-Projekt 3</p>
        <p className="text-slate-400 text-sm mt-1">Trainingsplan wird hinzugefügt</p>
      </Card>

      {/* Quick stats */}
      {isTrainer && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <p className="text-3xl font-bold text-teal-400">{memberCount ?? '—'}</p>
            <p className="text-slate-400 text-sm mt-1">Mitglieder</p>
          </Card>
          <Card>
            <Link to="/dokumente">
              <p className="text-3xl font-bold text-sky-400">{recentDocs.length}</p>
              <p className="text-slate-400 text-sm mt-1">Dokumente</p>
            </Link>
          </Card>
        </div>
      )}

      {/* Recent documents */}
      {recentDocs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Letzte Dokumente</p>
            <Link to="/dokumente" className="text-xs text-teal-400">Alle anzeigen</Link>
          </div>
          <div className="space-y-2">
            {recentDocs.map(doc => (
              <Card key={doc.id}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 text-sm shrink-0">
                    📄
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-slate-400 text-xs">{new Date(doc.created_at).toLocaleDateString('de-AT')}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}
```

- [ ] **Step 2: Create `src/pages/Profil.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { updateMe } from '../api/users'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

const AVATAR_COLORS = ['#0EA5E9', '#14B8A6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#F97316']

export function Profil() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleColorChange(color: string) {
    const res = await updateMe({ avatar_color: color })
    if (res.ok) setUser(res.data)
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwError('Passwörter stimmen nicht überein'); return }
    if (newPassword.length < 8) { setPwError('Mindestens 8 Zeichen'); return }
    setPwError(''); setPwLoading(true)
    const res = await updateMe({ password: newPassword })
    setPwLoading(false)
    if (res.ok) {
      setPwSuccess(true)
      setTimeout(() => { setShowPassword(false); setNewPassword(''); setConfirmPassword(''); setPwSuccess(false) }, 1500)
    } else {
      setPwError((res as { ok: false; error: string }).error)
    }
  }

  if (!user) return null

  return (
    <PageShell title="Profil">
      {/* Profile header */}
      <div className="flex flex-col items-center py-6 mb-6">
        <Avatar name={user.name} color={user.avatar_color} size="lg" />
        <h2 className="text-xl font-bold text-white mt-3">{user.name}</h2>
        <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        <div className="mt-2">
          <Badge role={user.role} />
        </div>
      </div>

      {/* Avatar color picker */}
      <Card className="mb-4">
        <p className="text-sm font-medium text-white mb-3">Avatar-Farbe</p>
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map(color => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className="w-8 h-8 rounded-full transition-transform active:scale-95"
              style={{
                backgroundColor: color,
                outline: user.avatar_color === color ? `2px solid ${color}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button variant="secondary" className="w-full" onClick={() => setShowPassword(true)}>
          Passwort ändern
        </Button>
        <Button variant="danger" className="w-full" onClick={handleLogout}>
          Abmelden
        </Button>
      </div>

      <Modal open={showPassword} onClose={() => setShowPassword(false)} title="Passwort ändern">
        {pwSuccess ? (
          <p className="text-center text-teal-400 py-4">✓ Passwort geändert!</p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <Input label="Neues Passwort" type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} required />
            <Input label="Passwort bestätigen" type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required />
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            <Button type="submit" loading={pwLoading} className="w-full">Speichern</Button>
          </form>
        )}
      </Modal>
    </PageShell>
  )
}
```

- [ ] **Step 3: Create `src/pages/Placeholder.tsx`**

```tsx
import { PageShell } from '../components/layout/PageShell'

interface PlaceholderProps {
  title: string
  icon: string
}

export function Placeholder({ title, icon }: PlaceholderProps) {
  return (
    <PageShell title={title}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h2 className="text-xl font-bold text-white mb-2">Kommt bald</h2>
        <p className="text-slate-400 text-sm max-w-xs">
          {title} wird in einem der nächsten Sub-Projekte hinzugefügt.
        </p>
      </div>
    </PageShell>
  )
}
```

- [ ] **Step 4: Update PWA name in `vite.config.ts`**

In `vite.config.ts`, change the manifest block:
```ts
manifest: {
  name: 'Mermaids',
  short_name: 'Mermaids',
  description: 'Schwimmverein Wien — Mermaids App',
  theme_color: '#14B8A6',
  background_color: '#050D1A',
  // rest unchanged
},
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Run server tests one final time**

```bash
cd server && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/Profil.tsx src/pages/Placeholder.tsx vite.config.ts
git commit -m "feat(mermaids): Dashboard, Profil, Placeholder pages — Sub-Projekt 1 frontend complete"
```

---

## Server ENV Template (`server/.env`)

Before first run, create `server/.env`:

```
PORT=3001
DATABASE_URL=postgresql://mermaids_user:YOURPASSWORD@localhost/mermaids
JWT_SECRET=RANDOM_64_BYTE_HEX
JWT_REFRESH_SECRET=ANOTHER_RANDOM_64_BYTE_HEX
SMTP_HOST=mail.hotdomeins.at
SMTP_PORT=587
SMTP_USER=noreply@YOURDOMAIN
SMTP_PASS=YOURPASSWORD
APP_URL=https://YOURDOMAIN
UPLOAD_DIR=/var/www/mermaids/uploads
ADMIN_EMAIL=herman.urban@live.com
ADMIN_PASSWORD=CHOOSE_STRONG_PASSWORD
ALLOWED_ORIGINS=https://YOURDOMAIN,http://localhost:5173
NODE_ENV=production
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Frontend ENV Template (`.env`)

```
VITE_API_URL=http://localhost:3001
```

For production, set `VITE_API_URL=https://YOURDOMAIN`.
