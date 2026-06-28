# Mermaids Zeiten & myresults-Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersetze localStorage-basierte Zeiten/Ergebnisse durch eine vollständige backend-gestützte Seite mit DB-Zeiten, Bestzeiten-Ranking, myresults-Import und LIVE-Tab.

**Architecture:** Neue `swim_times`-Tabelle in PostgreSQL, neuer `zeitenRouter` für alle CRUD- und Abfrage-Endpunkte, `myresults_name`-Erweiterung auf `users`-Tabelle. Frontend: neues `Zeiten.tsx` mit 4 Tabs (Bestzeiten / Meine Zeiten / Wettkämpfe / LIVE) ersetzt komplett das alte `Zeiten.tsx` und `Ergebnisse.tsx`.

**Tech Stack:** Node.js + Express + PostgreSQL (`pg`), React 19 + Tailwind, vitest + supertest, `lucide-react`, `src/api/client.ts` (`apiRequest`), JWT via `requireAuth()`

## Global Constraints

- REST-Responses immer `{ ok: true, data: T }` oder `{ ok: false, error: string }` — Hilfsfunktionen `ok()` / `err()` aus `server/src/types.ts`
- Alle Endpunkte erfordern JWT via `requireAuth()` aus `server/src/middleware/auth.ts`
- `requireAuth()` führt ein DB-Query aus: `pool.query` Call 1 in allen Tests ist immer die User-Lookup vom Auth-Middleware
- Test-Muster: `vi.mock('../src/db/pool', () => ({ pool: { query: vi.fn() } }))` — dann `pool as { query: ReturnType<typeof vi.fn> }`
- Test JWT-Secret: `process.env.JWT_SECRET = 'test-secret-for-vitest'`; Tokens mit `jwt.sign({ sub, email, role }, 'test-secret-for-vitest', { expiresIn: '15m' })`
- `event`-Feld ist kein Freitext: nur Werte aus `SWIM_EVENTS` erlaubt → 400 sonst
- `time_ms` muss positiver Integer sein: `time_ms > 0 && Number.isInteger(time_ms)` → 400 sonst
- `course` muss `'LB' | 'KB' | 'OW'` sein → 400 sonst
- `is_pb` wird **nie gespeichert** — immer on-the-fly per Window-Function
- `is_pb` Window-Function muss in CTE laufen **bevor** WHERE-Filter auf `GET /api/zeiten` angewendet werden
- Migrations-Dateien sind idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) und laufen automatisch beim Server-Start via `runMigrations()` in `server/src/db/migrate.ts`
- Frontend: kein `StoreContext`, kein `ApiConfigContext`, kein `useApi()` — nur `apiRequest()` aus `src/api/client.ts`
- Rolle-Prüfung: Allowlist `if (role !== 'admin' && role !== 'trainer')` (nie Denylist) für Trainer-Level-Zugriff

---

### Task 1: DB-Migration + Server-Konstante

**Files:**
- Create: `server/src/db/migrations/006_zeiten.sql`
- Create: `server/src/constants/swimEvents.ts`

**Interfaces:**
- Produces: `SWIM_EVENTS` (18 Disziplinen), `swim_times`-Tabelle, `myresults_name`-Spalte auf `users`

- [ ] **Step 1: Migration-Datei schreiben**

```sql
-- server/src/db/migrations/006_zeiten.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS myresults_name TEXT;

CREATE TABLE IF NOT EXISTS swim_times (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  course      TEXT NOT NULL CHECK (course IN ('LB', 'KB', 'OW')),
  time_ms     INTEGER NOT NULL,
  date        DATE NOT NULL,
  competition TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swim_times_user_event_course
  ON swim_times(user_id, event, course);
```

- [ ] **Step 2: Server-Konstante schreiben**

```typescript
// server/src/constants/swimEvents.ts
export const SWIM_EVENTS = [
  '50m Freistil', '100m Freistil', '200m Freistil', '400m Freistil', '800m Freistil', '1500m Freistil',
  '50m Rücken', '100m Rücken', '200m Rücken',
  '50m Brust', '100m Brust', '200m Brust',
  '50m Schmetterling', '100m Schmetterling', '200m Schmetterling',
  '100m Lagen', '200m Lagen', '400m Lagen',
] as const
```

- [ ] **Step 3: Migration manuell prüfen**

Starte den Server (`npm run dev` im `server/`-Verzeichnis) und prüfe die Logs auf `Migration applied: 006_zeiten.sql`. Die Migration ist idempotent — kein Rollback nötig.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/migrations/006_zeiten.sql server/src/constants/swimEvents.ts
git commit -m "feat(zeiten): DB migration + SWIM_EVENTS constant"
```

---

### Task 2: zeitenRouter — Lese-Endpunkte + Wiring

**Files:**
- Create: `server/src/routes/zeiten.ts`
- Modify: `server/src/app.ts`
- Create: `server/test/zeiten.test.ts` (Lese-Tests)

**Interfaces:**
- Consumes: `SWIM_EVENTS` aus `../constants/swimEvents`, `requireAuth()`, `ok()`, `err()`, `pool`
- Produces:
  - `GET /api/zeiten/events` → `string[]`
  - `GET /api/zeiten/bestzeiten` → `SwimTimeEntry[]`
  - `GET /api/zeiten` → `{ items: SwimTimeEntry[], total: number }` mit `?user_id`, `?event`, `?course`, `?limit`, `?offset`

**WICHTIG Route-Reihenfolge:** `/events` und `/bestzeiten` **vor** `/:id` definieren, sonst werden sie als Param-Routen abgefangen.

- [ ] **Step 1: Failing Tests schreiben**

```typescript
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
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

```bash
cd server && npx vitest run test/zeiten.test.ts --reporter=verbose
```
Erwartetes Ergebnis: `Cannot find module '../src/routes/zeiten'`

- [ ] **Step 3: zeitenRouter implementieren**

```typescript
// server/src/routes/zeiten.ts
import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'
import { ok, err } from '../types'
import { SWIM_EVENTS } from '../constants/swimEvents'

export const zeitenRouter = Router()

// GET /api/zeiten/events — kanonische Disziplin-Liste
zeitenRouter.get('/events', requireAuth(), (_req, res) => {
  res.json(ok([...SWIM_EVENTS]))
})

// GET /api/zeiten/bestzeiten — nur Bestzeiten pro User/Event/Course
zeitenRouter.get('/bestzeiten', requireAuth(), async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (st.user_id, st.event, st.course)
        st.id, st.user_id, u.name AS user_name,
        st.event, st.course, st.time_ms, st.date::text AS date,
        st.competition, st.created_by, st.created_at,
        true AS is_pb
      FROM swim_times st
      JOIN users u ON u.id = st.user_id
      ORDER BY st.user_id, st.event, st.course, st.time_ms ASC
    `)
    res.json(ok(rows))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// GET /api/zeiten — alle Zeiten mit Filtern + Pagination
// WICHTIG: CTE berechnet is_pb über ALLE Zeiten, dann erst WHERE-Filter
zeitenRouter.get('/', requireAuth(), async (req, res) => {
  const { user_id, event, course } = req.query as Record<string, string>
  const limit  = Math.min(parseInt((req.query.limit  as string) || '100', 10), 500)
  const offset = parseInt((req.query.offset as string) || '0', 10)

  try {
    const { rows } = await pool.query(`
      WITH times_with_pb AS (
        SELECT st.id, st.user_id, u.name AS user_name,
          st.event, st.course, st.time_ms, st.date::text AS date,
          st.competition, st.created_by, st.created_at,
          (st.time_ms = MIN(st.time_ms) OVER (PARTITION BY st.user_id, st.event, st.course)) AS is_pb
        FROM swim_times st
        JOIN users u ON u.id = st.user_id
      )
      SELECT *, COUNT(*) OVER () AS total_count
      FROM times_with_pb
      WHERE ($1::uuid IS NULL OR user_id = $1)
        AND ($2::text  IS NULL OR event  = $2)
        AND ($3::text  IS NULL OR course = $3)
      ORDER BY date DESC, created_at DESC
      LIMIT $4 OFFSET $5
    `, [user_id || null, event || null, course || null, limit, offset])

    const total = rows[0]?.total_count ? parseInt(rows[0].total_count as string) : 0
    const items = rows.map(({ total_count: _, ...r }) => r)
    res.json(ok({ items, total }))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
```

- [ ] **Step 4: zeitenRouter in app.ts einbinden**

In `server/src/app.ts` folgende Zeilen hinzufügen (nach dem bestehenden `import { trainingRouter }`):

```typescript
import { zeitenRouter } from './routes/zeiten'
```

Und nach `app.use('/api/training', trainingRouter)`:

```typescript
app.use('/api/zeiten', zeitenRouter)
```

- [ ] **Step 5: Tests laufen lassen — müssen bestehen**

```bash
cd server && npx vitest run test/zeiten.test.ts --reporter=verbose
```
Erwartetes Ergebnis: alle 8 Tests grün

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/zeiten.ts server/src/app.ts server/test/zeiten.test.ts
git commit -m "feat(zeiten): GET endpoints — events, bestzeiten, list with pagination"
```

---

### Task 3: zeitenRouter — Schreib-Endpunkte

**Files:**
- Modify: `server/src/routes/zeiten.ts`
- Modify: `server/test/zeiten.test.ts`

**Interfaces:**
- Consumes: Bestehender `zeitenRouter` aus Task 2
- Produces:
  - `POST /api/zeiten` → `SwimTimeEntry` (eingefügte Zeit inkl. `is_pb`)
  - `PATCH /api/zeiten/:id` → `SwimTimeEntry` (aktualisierte Zeit inkl. `is_pb`)
  - `DELETE /api/zeiten/:id` → `null`

- [ ] **Step 1: Failing Tests für POST/PATCH/DELETE anhängen**

Ans Ende von `server/test/zeiten.test.ts` anhängen:

```typescript
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
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

```bash
cd server && npx vitest run test/zeiten.test.ts --reporter=verbose
```
Erwartetes Ergebnis: Die 3 neuen `describe`-Blöcke schlagen fehl mit `404` (Route nicht definiert)

- [ ] **Step 3: Hilfsfunktion + POST/PATCH/DELETE in zeitenRouter ergänzen**

Am Ende von `server/src/routes/zeiten.ts` anhängen (nach dem bestehenden `GET /`):

```typescript
// Hilfsfunktion: Lädt eine Zeit mit berechneter is_pb
async function fetchZeit(id: string) {
  const { rows } = await pool.query<SwimTimeEntry>(`
    SELECT st.id, st.user_id, u.name AS user_name,
      st.event, st.course, st.time_ms, st.date::text AS date,
      st.competition, st.created_by, st.created_at,
      (st.time_ms = MIN(st.time_ms) OVER (PARTITION BY st.user_id, st.event, st.course)) AS is_pb
    FROM swim_times st
    JOIN users u ON u.id = st.user_id
    WHERE st.id = $1
  `, [id])
  return rows[0] ?? null
}

// POST /api/zeiten — Zeit eintragen
zeitenRouter.post('/', requireAuth(), async (req, res) => {
  const { event, course, time_ms, date, competition } = req.body as {
    event?: string; course?: string; time_ms?: number; date?: string; competition?: string
    user_id?: string
  }
  const user_id = req.body.user_id ?? req.user!.id

  if (user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
    res.status(403).json(err('Forbidden')); return
  }
  if (!event || !(SWIM_EVENTS as readonly string[]).includes(event)) {
    res.status(400).json(err('Ungültige Disziplin')); return
  }
  if (!time_ms || !Number.isInteger(time_ms) || time_ms <= 0) {
    res.status(400).json(err('Ungültige Zeit (muss positiver Integer in ms sein)')); return
  }
  if (!course || !['LB', 'KB', 'OW'].includes(course)) {
    res.status(400).json(err('Ungültige Bahn (LB | KB | OW)')); return
  }
  if (!date) {
    res.status(400).json(err('Datum erforderlich')); return
  }

  try {
    const { rows: [{ id }] } = await pool.query(
      `INSERT INTO swim_times (user_id, event, course, time_ms, date, competition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [user_id, event, course, time_ms, date, competition ?? null, req.user!.id],
    )
    const entry = await fetchZeit(id)
    res.json(ok(entry))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// PATCH /api/zeiten/:id — Zeit bearbeiten (eigene: alle; fremde: trainer/admin)
zeitenRouter.patch('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params
  const { event, course, time_ms, date } = req.body as {
    event?: string; course?: string; time_ms?: number; date?: string
  }

  try {
    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM swim_times WHERE id = $1', [id],
    )
    if (!existing) { res.status(404).json(err('Zeit nicht gefunden')); return }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
      res.status(403).json(err('Forbidden')); return
    }

    if (event !== undefined && !(SWIM_EVENTS as readonly string[]).includes(event)) {
      res.status(400).json(err('Ungültige Disziplin')); return
    }
    if (time_ms !== undefined && (!Number.isInteger(time_ms) || time_ms <= 0)) {
      res.status(400).json(err('Ungültige Zeit')); return
    }
    if (course !== undefined && !['LB', 'KB', 'OW'].includes(course)) {
      res.status(400).json(err('Ungültige Bahn')); return
    }

    const parts: string[] = []
    const vals: unknown[] = []

    if (event     !== undefined) { parts.push(`event    = $${vals.length + 1}`); vals.push(event) }
    if (course    !== undefined) { parts.push(`course   = $${vals.length + 1}`); vals.push(course) }
    if (time_ms   !== undefined) { parts.push(`time_ms  = $${vals.length + 1}`); vals.push(time_ms) }
    if (date      !== undefined) { parts.push(`date     = $${vals.length + 1}`); vals.push(date) }
    if ('competition' in req.body) {
      parts.push(`competition = $${vals.length + 1}`)
      vals.push((req.body as { competition?: string }).competition ?? null)
    }

    if (!parts.length) { res.status(400).json(err('Keine Felder zum Aktualisieren')); return }

    vals.push(id)
    const { rows: [{ id: updatedId }] } = await pool.query(
      `UPDATE swim_times SET ${parts.join(', ')} WHERE id = $${vals.length} RETURNING id`,
      vals,
    )
    const entry = await fetchZeit(updatedId)
    res.json(ok(entry))
  } catch { res.status(500).json(err('Interner Fehler')) }
})

// DELETE /api/zeiten/:id
zeitenRouter.delete('/:id', requireAuth(), async (req, res) => {
  const { id } = req.params
  try {
    const { rows: [existing] } = await pool.query(
      'SELECT user_id FROM swim_times WHERE id = $1', [id],
    )
    if (!existing) { res.status(404).json(err('Zeit nicht gefunden')); return }
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'trainer') {
      res.status(403).json(err('Forbidden')); return
    }
    await pool.query('DELETE FROM swim_times WHERE id = $1', [id])
    res.json(ok(null))
  } catch { res.status(500).json(err('Interner Fehler')) }
})
```

Das Interface `SwimTimeEntry` wird am Anfang der Datei importiert (Typ-only, keine Runtime-Abhängigkeit). Da es ein Frontend-Interface ist, hier als lokales Interface definieren oder den Import überspringen und direkt typen:

Am Anfang von `server/src/routes/zeiten.ts` nach den bestehenden Imports hinzufügen:

```typescript
interface SwimTimeEntry {
  id: string; user_id: string; user_name: string
  event: string; course: string; time_ms: number
  date: string; competition: string | null; created_by: string | null
  created_at: string; is_pb: boolean
}
```

- [ ] **Step 4: Alle Tests laufen lassen**

```bash
cd server && npx vitest run test/zeiten.test.ts --reporter=verbose
```
Erwartetes Ergebnis: Alle 23 Tests grün

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/zeiten.ts server/test/zeiten.test.ts
git commit -m "feat(zeiten): POST, PATCH, DELETE endpoints with validation"
```

---

### Task 4: PATCH /me — myresults_name + Auth-Queries aktualisieren

**Files:**
- Modify: `server/src/routes/users.ts`
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/types.ts`

**Interfaces:**
- Produces: `PATCH /api/users/me` akzeptiert `myresults_name?: string`; alle User-SELECT-Queries geben `myresults_name` zurück; `User` Interface enthält `myresults_name?: string`

**WARUM:** `user.myresults_name` wird im Frontend-Tab "Mein Schwimmer" benötigt. Die Auth-Middleware und alle User-SELECT-Queries müssen das Feld zurückgeben damit es nach Login/Refresh im `useAuth()` Context landet.

- [ ] **Step 1: `User`-Interface in `server/src/types.ts` erweitern**

In `server/src/types.ts` das `User`-Interface suchen und `myresults_name` hinzufügen:

```typescript
export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar_color: string
  created_at: string
  myresults_name?: string   // neu
}
```

- [ ] **Step 2: Auth-Middleware — SELECT erweitern**

In `server/src/middleware/auth.ts` die Query-Zeile ändern:

```typescript
// ALT:
'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
// NEU:
'SELECT id, email, name, role, avatar_color, created_at, myresults_name FROM users WHERE id = $1',
```

- [ ] **Step 3: auth.ts — Refresh- und Login-Queries erweitern**

In `server/src/routes/auth.ts`:

Login-Query (Zeile ≈ 20, `WHERE email = $1`):
```typescript
// ALT:
'SELECT id, email, name, role, avatar_color, created_at, password_hash FROM users WHERE email = $1',
// NEU:
'SELECT id, email, name, role, avatar_color, created_at, myresults_name, password_hash FROM users WHERE email = $1',
```

Refresh-Query (Zeile ≈ 57, `WHERE id = $1` nach Token-Lookup):
```typescript
// ALT:
'SELECT id, email, name, role, avatar_color, created_at FROM users WHERE id = $1',
// NEU:
'SELECT id, email, name, role, avatar_color, created_at, myresults_name FROM users WHERE id = $1',
```

- [ ] **Step 4: users.ts — PATCH /me erweitern**

In `server/src/routes/users.ts` die `patch('/me', ...)` Funktion anpassen:

```typescript
usersRouter.patch('/me', requireAuth(), async (req, res) => {
  try {
    const { name, password, avatar_color, myresults_name } = req.body as {
      name?: string; password?: string; avatar_color?: string; myresults_name?: string
    }
    const updates: string[] = []
    const values: unknown[] = []

    if (name) { updates.push(`name = $${updates.length + 1}`); values.push(name.trim()) }
    if (avatar_color) { updates.push(`avatar_color = $${updates.length + 1}`); values.push(avatar_color) }
    if ('myresults_name' in req.body) {
      updates.push(`myresults_name = $${updates.length + 1}`)
      values.push(myresults_name ?? null)
    }
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
       RETURNING id, email, name, role, avatar_color, created_at, myresults_name`,
      values,
    )
    res.json(ok(rows[0]))
  } catch (e) {
    res.status(500).json(err('Interner Fehler'))
  }
})
```

- [ ] **Step 5: Bestehende Tests laufen lassen**

```bash
cd server && npx vitest run --reporter=verbose
```
Erwartetes Ergebnis: Alle Tests grün (keine Regressions)

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware/auth.ts server/src/routes/auth.ts server/src/routes/users.ts server/src/types.ts
git commit -m "feat(zeiten): add myresults_name to User — PATCH /me + auth queries"
```

---

### Task 5: Frontend-Typen + API-Wrapper

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/zeiten.ts`
- Modify: `src/api/users.ts`

**Interfaces:**
- Produces:
  - `SwimTimeEntry` und `ZeitenListResponse` Interfaces in `src/types/index.ts`
  - `User.myresults_name?: string` in `src/types/index.ts`
  - `listZeiten()`, `listBestzeiten()`, `listEvents()`, `createZeit()`, `updateZeit()`, `deleteZeit()` in `src/api/zeiten.ts`
  - `updateMe()` akzeptiert `myresults_name?: string`

Keine Tests für diesen Task — Typen und API-Wrapper werden in Tasks 6-8 durch den UI-Code geprüft.

- [ ] **Step 1: Types in `src/types/index.ts` erweitern**

Den bestehenden `User`-Interface-Block suchen und `myresults_name` hinzufügen:

```typescript
export interface User {
  id: string
  email: string
  name: string
  role: Role
  avatar_color: string
  created_at: string
  myresults_name?: string   // neu
}
```

Ans Ende der Datei (nach `SessionEntry`) hinzufügen:

```typescript
// --- Zeiten types ---

export interface SwimTimeEntry {
  id: string
  user_id: string
  user_name: string
  event: string
  course: 'LB' | 'KB' | 'OW'
  time_ms: number
  date: string              // ISO date "YYYY-MM-DD"
  competition: string | null
  created_by: string | null
  created_at: string
  is_pb: boolean
}

export interface ZeitenListResponse {
  items: SwimTimeEntry[]
  total: number
}
```

- [ ] **Step 2: `src/api/zeiten.ts` erstellen**

```typescript
// src/api/zeiten.ts
import { apiRequest } from './client'
import type { SwimTimeEntry, ZeitenListResponse } from '../types'

export const listEvents = () =>
  apiRequest<string[]>('/api/zeiten/events')

export const listBestzeiten = () =>
  apiRequest<SwimTimeEntry[]>('/api/zeiten/bestzeiten')

export const listZeiten = (params: {
  user_id?: string; event?: string; course?: string; limit?: number; offset?: number
}) => {
  const q = new URLSearchParams()
  if (params.user_id) q.set('user_id', params.user_id)
  if (params.event)   q.set('event',   params.event)
  if (params.course)  q.set('course',  params.course)
  q.set('limit',  String(params.limit  ?? 100))
  q.set('offset', String(params.offset ?? 0))
  return apiRequest<ZeitenListResponse>(`/api/zeiten?${q}`)
}

export const createZeit = (data: {
  user_id?: string; event: string; course: 'LB' | 'KB' | 'OW'
  time_ms: number; date: string; competition?: string
}) => apiRequest<SwimTimeEntry>('/api/zeiten', { method: 'POST', body: JSON.stringify(data) })

export const updateZeit = (id: string, data: {
  event?: string; course?: 'LB' | 'KB' | 'OW'; time_ms?: number
  date?: string; competition?: string | null
}) => apiRequest<SwimTimeEntry>(`/api/zeiten/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteZeit = (id: string) =>
  apiRequest<null>(`/api/zeiten/${id}`, { method: 'DELETE' })
```

- [ ] **Step 3: `src/api/users.ts` — `updateMe` erweitern**

Die bestehende `updateMe`-Funktion anpassen:

```typescript
export const updateMe = (data: {
  name?: string; password?: string; avatar_color?: string; myresults_name?: string
}) =>
  apiRequest<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) })
```

- [ ] **Step 4: TypeScript-Compilation prüfen**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/api/zeiten.ts src/api/users.ts
git commit -m "feat(zeiten): frontend types + API wrappers"
```

---

### Task 6: Zeiten.tsx — Shell + Bestzeiten-Tab

**Files:**
- Create: `src/pages/Zeiten.tsx` (kompletter Ersatz des alten Placeholders)

**Interfaces:**
- Consumes: `listBestzeiten()`, `listEvents()` aus `src/api/zeiten.ts`; `useAuth()`, `SwimTimeEntry` aus `src/types`
- Produces: `Zeiten`-Seite mit 4-Tab-Shell; vollständiger Bestzeiten-Tab

**Hinweise:**
- `formatTime()` aus `src/utils/format.ts` für Zeit-Anzeige
- `Avatar`-Komponente aus `src/components/ui/Avatar`
- `PageShell` aus `src/components/layout/PageShell`

- [ ] **Step 1: Grundstruktur mit Shell und Bestzeiten-Tab**

```tsx
// src/pages/Zeiten.tsx
import { useState, useEffect } from 'react'
import { Trophy, Timer, Award, Radio, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/Card'
import { Avatar } from '../components/ui/Avatar'
import { listBestzeiten, listEvents } from '../api/zeiten'
import { formatTime } from '../utils/format'
import type { SwimTimeEntry } from '../types'

type OuterTab = 'bestzeiten' | 'meine' | 'wettkampf' | 'live'
type BestzetenView = 'ranking' | 'mitglieder'

// ─── Bestzeiten-Tab ──────────────────────────────────────────────────────────

function BestzetenTab() {
  const { user } = useAuth()
  const [view, setView] = useState<BestzetenView>('ranking')
  const [allPbs, setAllPbs] = useState<SwimTimeEntry[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<'LB' | 'KB' | 'OW' | 'alle'>('LB')
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([listBestzeiten(), listEvents()]).then(([pbRes, evRes]) => {
      if (pbRes.ok) setAllPbs(pbRes.data)
      if (evRes.ok) {
        setEvents(evRes.data)
        if (evRes.data.length) setSelectedEvent(evRes.data[0])
      }
      setLoading(false)
    })
  }, [])

  // Ranking-Ansicht: PBs für gewählte Disziplin + Bahn, sortiert nach Zeit
  const rankingRows = allPbs
    .filter(t => t.event === selectedEvent && (selectedCourse === 'alle' || t.course === selectedCourse))
    .sort((a, b) => a.time_ms - b.time_ms)

  // Mitglieder-Ansicht: eine Karte pro User mit allen PBs
  const userMap = new Map<string, { user_name: string; avatar_color?: string; times: SwimTimeEntry[] }>()
  allPbs.forEach(t => {
    if (!userMap.has(t.user_id)) userMap.set(t.user_id, { user_name: t.user_name, times: [] })
    userMap.get(t.user_id)!.times.push(t)
  })
  const userList = Array.from(userMap.entries()).sort((a, b) => a[1].user_name.localeCompare(b[1].user_name, 'de'))

  if (loading) return <p className="text-slate-500 text-sm text-center py-12 animate-pulse">Bestzeiten werden geladen…</p>

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex bg-slate-800/50 p-1 rounded-xl">
        {(['ranking', 'mitglieder'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${
              view === v ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {v === 'ranking' ? 'Ranking' : 'Mitglieder'}
          </button>
        ))}
      </div>

      {view === 'ranking' && (
        <>
          {/* Filter row */}
          <div className="flex gap-2">
            <select
              value={selectedEvent}
              onChange={e => setSelectedEvent(e.target.value)}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value as typeof selectedCourse)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              <option value="LB">LB</option>
              <option value="KB">KB</option>
              <option value="OW">OW</option>
              <option value="alle">Alle</option>
            </select>
          </div>

          {/* Ranking table */}
          {rankingRows.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">Keine Zeiten für diese Auswahl</p>
          ) : (
            <div className="space-y-1.5">
              {rankingRows.map((t, i) => (
                <Card
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 ${t.user_id === user?.id ? 'border-teal-500/40 bg-teal-500/5' : ''}`}
                >
                  <span className="text-slate-500 text-xs w-5 text-right font-mono">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${t.user_id === user?.id ? 'text-teal-300' : 'text-white'}`}>
                      {t.user_name}
                    </p>
                    {t.competition && <p className="text-slate-600 text-xs truncate">{t.competition}</p>}
                    <p className="text-slate-600 text-xs">{t.date}</p>
                  </div>
                  <p className="font-mono text-white font-bold text-sm">{formatTime(t.time_ms)}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'mitglieder' && (
        <div className="space-y-2">
          {userList.map(([uid, { user_name, times }]) => {
            const expanded = expandedUsers.has(uid)
            const toggle = () => setExpandedUsers(prev => {
              const next = new Set(prev)
              expanded ? next.delete(uid) : next.add(uid)
              return next
            })
            return (
              <Card key={uid} className="overflow-hidden">
                <button
                  onClick={toggle}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <Avatar name={user_name} color="#0ea5e9" size={32} />
                  <span className={`flex-1 text-left text-sm font-medium ${uid === user?.id ? 'text-teal-300' : 'text-white'}`}>
                    {user_name}
                  </span>
                  <span className="text-slate-500 text-xs">{times.length} PB{times.length !== 1 ? 's' : ''}</span>
                  {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </button>
                {expanded && (
                  <div className="border-t border-white/5 divide-y divide-white/5">
                    {times.sort((a, b) => a.event.localeCompare(b.event, 'de')).map(t => (
                      <div key={t.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-white text-xs font-medium">{t.event}</p>
                          <p className="text-slate-600 text-[11px]">{t.course} · {t.date}</p>
                        </div>
                        <p className="font-mono text-teal-300 text-sm font-bold">{formatTime(t.time_ms)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Platzhalter für noch nicht implementierte Tabs ──────────────────────────

function MeineZeitenTab() {
  return <p className="text-slate-500 text-sm text-center py-12">Meine Zeiten — wird implementiert</p>
}

function WettkampfTab() {
  return <p className="text-slate-500 text-sm text-center py-12">Wettkämpfe — wird implementiert</p>
}

function LiveTab() {
  return <p className="text-slate-500 text-sm text-center py-12">LIVE — wird implementiert</p>
}

// ─── Seite ───────────────────────────────────────────────────────────────────

const TABS: { id: OuterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'bestzeiten', label: 'Bestzeiten', icon: <Trophy size={14} /> },
  { id: 'meine',      label: 'Meine Zeiten', icon: <Timer size={14} /> },
  { id: 'wettkampf',  label: 'Wettkämpfe',  icon: <Award size={14} /> },
  { id: 'live',       label: 'LIVE',         icon: <Radio size={14} /> },
]

export function Zeiten() {
  const [tab, setTab] = useState<OuterTab>('bestzeiten')

  return (
    <PageShell title="Zeiten">
      <div className="flex bg-slate-800/50 p-1 rounded-xl mb-4 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap px-2 ${
              tab === t.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'bestzeiten' && <BestzetenTab />}
      {tab === 'meine'      && <MeineZeitenTab />}
      {tab === 'wettkampf'  && <WettkampfTab />}
      {tab === 'live'       && <LiveTab />}
    </PageShell>
  )
}
```

- [ ] **Step 2: App.tsx updaten — Zeiten importieren**

In `src/App.tsx`:

```typescript
// Nach den bestehenden Imports hinzufügen:
import { Zeiten } from './pages/Zeiten'
```

Route von Placeholder auf Zeiten ändern:
```tsx
// ALT:
<Route path="/zeiten" element={<RequireAuth><Placeholder title="Zeiten" icon="⏱" /></RequireAuth>} />
// NEU:
<Route path="/zeiten" element={<RequireAuth><Zeiten /></RequireAuth>} />
```

- [ ] **Step 3: TypeScript-Compilation prüfen**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 4: Commit**

```bash
git add src/pages/Zeiten.tsx src/App.tsx
git commit -m "feat(zeiten): Zeiten page shell + Bestzeiten tab (ranking + Mitglieder)"
```

---

### Task 7: Zeiten.tsx — Meine-Zeiten-Tab

**Files:**
- Modify: `src/pages/Zeiten.tsx`

**Interfaces:**
- Consumes: `listZeiten()`, `listEvents()`, `createZeit()`, `updateZeit()`, `deleteZeit()`, `listUsers()` (für Trainer); `parseTimeInput()` aus `src/utils/format.ts`; `useAuth()`
- Produces: vollständiger `MeineZeitenTab` mit Pagination, FAB (+), Inline-Edit, Löschen; ersetzt den Platzhalter aus Task 6

- [ ] **Step 1: `MeineZeitenTab` implementieren**

Die Platzhalter-Funktion `MeineZeitenTab` in `src/pages/Zeiten.tsx` vollständig ersetzen:

```tsx
function MeineZeitenTab() {
  const { user, isTrainer } = useAuth()
  const [times, setTimes]       = useState<SwimTimeEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [events, setEvents]     = useState<string[]>([])
  const [filterEvent, setFilterEvent] = useState('')
  const [filterCourse, setFilterCourse] = useState('')
  const [targetUserId, setTargetUserId] = useState(user?.id ?? '')
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({
    event: '', course: 'LB' as 'LB' | 'KB' | 'OW',
    timeInput: '', date: new Date().toISOString().split('T')[0], competition: '',
  })
  const [timeError, setTimeError] = useState('')
  const LIMIT = 100

  // Events + Users einmalig laden
  useEffect(() => {
    listEvents().then(res => {
      if (res.ok) {
        setEvents(res.data)
        setForm(f => ({ ...f, event: res.data[0] ?? '' }))
      }
    })
    if (isTrainer) {
      listUsers().then(res => { if (res.ok) setAllUsers(res.data) })
    }
  }, [isTrainer])

  // Zeiten laden / neu laden bei Filter-Änderung
  useEffect(() => {
    setOffset(0)
    setTimes([])
    load(0, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, filterEvent, filterCourse])

  async function load(off: number, replace: boolean) {
    replace ? setLoading(true) : setLoadingMore(true)
    const res = await listZeiten({
      user_id: targetUserId || undefined,
      event:  filterEvent  || undefined,
      course: filterCourse || undefined,
      limit: LIMIT, offset: off,
    })
    if (res.ok) {
      setTimes(prev => replace ? res.data.items : [...prev, ...res.data.items])
      setTotal(res.data.total)
    }
    replace ? setLoading(false) : setLoadingMore(false)
  }

  function loadMore() {
    const newOffset = offset + LIMIT
    setOffset(newOffset)
    load(newOffset, false)
  }

  function startAdd() {
    setEditId(null)
    setForm({ event: events[0] ?? '', course: 'LB', timeInput: '', date: new Date().toISOString().split('T')[0], competition: '' })
    setTimeError('')
    setShowForm(true)
  }

  function startEdit(t: SwimTimeEntry) {
    setEditId(t.id)
    // formatTime gibt z.B. "1:03,42" zurück — direkt als Input-Wert verwenden
    setForm({ event: t.event, course: t.course, timeInput: formatTime(t.time_ms), date: t.date, competition: t.competition ?? '' })
    setTimeError('')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ms = parseTimeInput(form.timeInput)
    if (!ms) { setTimeError('Format: 1:03,42 oder 63,42'); return }
    setTimeError('')
    setSaving(true)
    try {
      if (editId) {
        const res = await updateZeit(editId, {
          event: form.event, course: form.course, time_ms: ms,
          date: form.date, competition: form.competition || null,
        })
        if (res.ok) {
          setTimes(prev => prev.map(t => t.id === editId ? res.data : t))
          setShowForm(false); setEditId(null)
        }
      } else {
        const res = await createZeit({
          user_id: targetUserId !== user?.id ? targetUserId : undefined,
          event: form.event, course: form.course, time_ms: ms,
          date: form.date, competition: form.competition || undefined,
        })
        if (res.ok) {
          setTimes(prev => [res.data, ...prev])
          setTotal(t => t + 1)
          setShowForm(false)
        }
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    const res = await deleteZeit(id)
    if (res.ok) {
      setTimes(prev => prev.filter(t => t.id !== id))
      setTotal(t => t - 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Trainer: User-Selektor */}
      {isTrainer && allUsers.length > 0 && (
        <select
          value={targetUserId}
          onChange={e => setTargetUserId(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name}{u.id === user?.id ? ' (ich)' : ''}</option>
          ))}
        </select>
      )}

      {/* Filter-Zeile */}
      <div className="flex gap-2">
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          <option value="">Alle Disziplinen</option>
          {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
        >
          <option value="">Alle Bahnen</option>
          <option value="LB">LB</option>
          <option value="KB">KB</option>
          <option value="OW">OW</option>
        </select>
      </div>

      {/* Formular — Eintragen / Bearbeiten */}
      {showForm && (
        <Card className="p-4 space-y-3 border-teal-500/30">
          <p className="text-white text-sm font-medium">{editId ? 'Zeit bearbeiten' : 'Zeit eintragen'}</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={form.event}
              onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            >
              {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
            <div className="flex gap-2">
              <select
                value={form.course}
                onChange={e => setForm(f => ({ ...f, course: e.target.value as 'LB' | 'KB' | 'OW' }))}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
              >
                <option value="LB">LB</option>
                <option value="KB">KB</option>
                <option value="OW">OW</option>
              </select>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="1:03,42 oder 63,42"
                  value={form.timeInput}
                  onChange={e => setForm(f => ({ ...f, timeInput: e.target.value }))}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 font-mono"
                />
                {timeError && <p className="text-rose-400 text-xs mt-1">{timeError}</p>}
              </div>
            </div>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            />
            <input
              type="text"
              placeholder="Wettkampf (optional)"
              value={form.competition}
              onChange={e => setForm(f => ({ ...f, competition: e.target.value }))}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null) }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Wird gespeichert…' : (editId ? 'Speichern' : 'Eintragen')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Zeitenliste */}
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-12 animate-pulse">Zeiten werden geladen…</p>
      ) : times.length === 0 ? (
        <div className="text-center py-12">
          <TrendingDown size={36} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-600 text-sm">Noch keine Zeiten eingetragen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {times.map(t => (
            <Card key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-white text-sm font-medium">{t.event}</p>
                  {t.is_pb && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">PB</span>
                  )}
                </div>
                <p className="text-slate-500 text-xs">{t.course} · {t.date}{t.competition ? ` · ${t.competition}` : ''}</p>
              </div>
              <p className="font-mono text-white font-bold text-sm">{formatTime(t.time_ms)}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(t)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 transition-colors"
                  aria-label="Bearbeiten"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                  aria-label="Löschen"
                >
                  🗑
                </button>
              </div>
            </Card>
          ))}
          {times.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-slate-400 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Wird geladen…' : `${total - times.length} weitere laden`}
            </button>
          )}
        </div>
      )}

      {/* FAB */}
      {!showForm && (
        <div className="fixed bottom-24 right-4 z-40">
          <button
            onClick={startAdd}
            className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 active:scale-95 transition-transform text-white text-2xl font-light"
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}
```

Außerdem folgende Imports ans Ende der Import-Zeilen in `src/pages/Zeiten.tsx` hinzufügen:

```typescript
import { listZeiten, createZeit, updateZeit, deleteZeit } from '../api/zeiten'
import { listUsers } from '../api/users'
import { parseTimeInput } from '../utils/format'
```

(Alle anderen Imports — `listBestzeiten`, `listEvents`, `formatTime` — sind bereits aus Task 6 vorhanden.)

- [ ] **Step 2: TypeScript-Compilation prüfen**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 3: Commit**

```bash
git add src/pages/Zeiten.tsx
git commit -m "feat(zeiten): Meine-Zeiten tab with pagination, CRUD, PB indicator"
```

---

### Task 8: Zeiten.tsx — Wettkämpfe + LIVE + Profil.tsx + Cleanup

**Files:**
- Modify: `src/pages/Zeiten.tsx`
- Modify: `src/pages/Profil.tsx`
- Delete: `src/pages/Ergebnisse.tsx`

**Interfaces:**
- Consumes: `createZeit()` aus `src/api/zeiten.ts`; `apiRequest` aus `src/api/client.ts`; `useAuth()` für `user.myresults_name`; `MeetSummary`, `SwimmerResult`, `LiveResult` aus `src/types`
- Produces: Vollständige Zeiten.tsx mit allen 4 Tabs; Profil.tsx mit `myresults_name`-Feld; Ergebnisse.tsx gelöscht

**Hinweis:** `WettkämpfeTab` und `LiveTab` stammen aus `Ergebnisse.tsx` — der Code wird übernommen, **ohne** `StoreContext`, `ApiConfigContext`, `useApi()`. Statt `api.get<T>(path)` wird `apiRequest<T>(path)` verwendet. `addToCalendar` (lokalStorage-Store) wird entfernt.

- [ ] **Step 1: Fehlende Imports in Zeiten.tsx ergänzen**

Ans Ende der Import-Zeilen in `src/pages/Zeiten.tsx` hinzufügen:

```typescript
import { apiRequest } from '../api/client'
import type { MeetSummary, SwimmerResult, LiveResult } from '../types'
import { RefreshCw, Download, Check, Wifi, User as UserIcon } from 'lucide-react'
```

(Die Lucide-Icons `Trophy`, `Timer`, `Award`, `Radio`, `ChevronDown`, `ChevronUp`, `TrendingDown` sind bereits aus Task 6 vorhanden.)

- [ ] **Step 2: Hilfsfunktion + WettkämpfeTab implementieren**

Die Platzhalter-Funktion `WettkampfTab` in `src/pages/Zeiten.tsx` vollständig ersetzen:

```tsx
// Hilfsfunktion aus Ergebnisse.tsx (unverändert)
function normalizeEventName(raw: string): string {
  return raw
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i, '')
    .trim()
}

type WettkämpfeSubTab = 'meets' | 'swimmer'

function WettkampfTab() {
  const [subTab, setSubTab] = useState<WettkämpfeSubTab>('meets')
  return (
    <div className="space-y-4">
      <div className="flex bg-slate-800/50 p-1 rounded-xl">
        {(['meets', 'swimmer'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              subTab === t ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'meets' ? 'Wettkämpfe' : 'Mein Schwimmer'}
          </button>
        ))}
      </div>
      {subTab === 'meets'   && <WettkämpfeInner />}
      {subTab === 'swimmer' && <MeinSchwimmerInner />}
    </div>
  )
}

function WettkämpfeInner() {
  const [meets, setMeets]   = useState<MeetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    const res = await apiRequest<MeetSummary[]>('/api/meets?status=all')
    if (res.ok) setMeets(res.data)
    else setError(res.error)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-xs">{meets.length} Wettkämpfe</p>
        <button onClick={load} disabled={loading} className="text-slate-500 hover:text-white p-1">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {error && <p className="text-rose-400 text-sm text-center py-4">{error}</p>}
      {loading && !meets.length && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">Wettkämpfe werden geladen…</p>
      )}
      {meets.map(m => (
        <Card key={m.id} className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {m.status === 'recent' ? 'Abgeschlossen' : m.status === 'today' ? 'Heute' : 'Geplant'}
                </span>
                <span className="text-[10px] text-slate-500">{m.course}</span>
              </div>
              <p className="text-white text-sm font-medium leading-tight">{m.name}</p>
              <p className="text-slate-500 text-xs mt-0.5">{m.location}</p>
              <p className="text-slate-600 text-xs">{m.startDate}{m.startDate !== m.endDate ? ` – ${m.endDate}` : ''}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function MeinSchwimmerInner() {
  const { user } = useAuth()
  const [results, setResults]   = useState<SwimmerResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [imported, setImported] = useState<Set<string>>(new Set())

  const searchName = user?.myresults_name ?? (user?.name.toUpperCase() ?? '')

  const load = async () => {
    if (!user) return
    setLoading(true); setError('')
    const params = new URLSearchParams({ name: searchName })
    const res = await apiRequest<SwimmerResult[]>(`/api/swimmer/results?${params}`)
    if (res.ok) setResults(res.data)
    else setError(res.error)
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.id])

  async function importResult(r: SwimmerResult) {
    if (!user) return
    const eventName = normalizeEventName(r.eventName)
    const key = `${r.meetDate}-${r.eventId}-${r.result.timeMs}`
    const res = await createZeit({
      event: eventName, course: r.course,  // SwimmerResult.course ist 'LB' | 'KB', assignierbar zu 'LB'|'KB'|'OW'
      time_ms: r.result.timeMs, date: r.meetDate, competition: r.meetName,
    })
    if (res.ok) setImported(prev => new Set([...prev, key]))
  }

  async function importAll() {
    const pending = results.filter(r => !imported.has(`${r.meetDate}-${r.eventId}-${r.result.timeMs}`))
    await Promise.allSettled(pending.map(r => importResult(r)))
  }

  if (!user?.myresults_name && searchName === user?.name.toUpperCase()) {
    return (
      <div className="text-center py-12">
        <UserIcon size={36} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-500 text-sm">Hinterlege deinen myresults.eu-Namen im Profil</p>
        <p className="text-slate-600 text-xs mt-1">Format: NACHNAME Vorname</p>
      </div>
    )
  }

  const notYetImported = results.filter(r => !imported.has(`${r.meetDate}-${r.eventId}-${r.result.timeMs}`))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">Suche: <span className="text-slate-300">{searchName}</span></p>
          <p className="text-slate-600 text-xs">Letzte 5 Wettkämpfe</p>
        </div>
        <div className="flex items-center gap-2">
          {notYetImported.length > 0 && (
            <button onClick={importAll} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
              <Download size={12} /> Alle ({notYetImported.length})
            </button>
          )}
          <button onClick={load} disabled={loading} className="text-slate-500 hover:text-white p-1">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {error && <p className="text-rose-400 text-sm text-center py-4">{error}</p>}
      {loading && !results.length && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">Ergebnisse werden gesucht…</p>
      )}
      {!loading && results.length === 0 && !error && (
        <p className="text-slate-600 text-sm text-center py-8">Keine Ergebnisse gefunden</p>
      )}
      {results.map(r => {
        const key = `${r.meetDate}-${r.eventId}-${r.result.timeMs}`
        const isImported = imported.has(key)
        return (
          <Card key={key} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium">{normalizeEventName(r.eventName)}</p>
              <p className="text-slate-500 text-xs">{r.meetName}</p>
              <p className="text-slate-600 text-xs">{r.meetDate} · Platz {r.result.rank}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-white font-bold text-sm">
                {r.result.timeMs > 0 ? formatTime(r.result.timeMs) : '—'}
              </p>
              <button
                onClick={() => importResult(r)}
                disabled={isImported}
                className={`p-2 rounded-xl transition-colors ${isImported ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
              >
                {isImported ? <Check size={15} /> : <Download size={15} />}
              </button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: LiveTab implementieren**

Die Platzhalter-Funktion `LiveTab` in `src/pages/Zeiten.tsx` vollständig ersetzen:

```tsx
function LiveTab() {
  const { user } = useAuth()
  const [meets, setMeets]               = useState<MeetSummary[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState('')
  const [liveData, setLiveData]         = useState<LiveResult | null>(null)
  const [loading, setLoading]           = useState(false)
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null)
  const [savedIds, setSavedIds]         = useState<Set<string>>(new Set())

  useEffect(() => {
    apiRequest<MeetSummary[]>('/api/meets?status=upcoming').then(res => {
      if (!res.ok) return
      const liveMeets = res.data.filter(m => m.hasLive || m.status === 'today' || m.status === 'upcoming')
      setMeets(liveMeets)
      if (liveMeets.length && !selectedMeetId) setSelectedMeetId(liveMeets[0].id)
    })
  }, [])

  const fetchLive = async () => {
    if (!selectedMeetId) return
    const res = await apiRequest<LiveResult>(`/api/meets/${selectedMeetId}/live?urlStatus=Today-Upcoming`)
    if (res.ok) { setLiveData(res.data); setLastUpdated(new Date()) }
  }

  useEffect(() => {
    if (!selectedMeetId) return
    setLoading(true)
    fetchLive().finally(() => setLoading(false))
    const interval = setInterval(fetchLive, 10000)
    return () => clearInterval(interval)
  }, [selectedMeetId])

  async function saveTime(result: SwimResult) {
    if (!user || !liveData?.event) return
    const eventName = normalizeEventName(liveData.event)
    const today = new Date().toISOString().split('T')[0]
    const res = await createZeit({
      event: eventName,
      course: meets.find(m => m.id === selectedMeetId)?.course ?? 'LB',
      time_ms: result.timeMs,
      date: today,
      competition: meets.find(m => m.id === selectedMeetId)?.name,
    })
    if (res.ok) setSavedIds(prev => new Set([...prev, result.participantId]))
  }

  return (
    <div className="space-y-4">
      {meets.length > 0 && (
        <select
          value={selectedMeetId}
          onChange={e => { setSelectedMeetId(e.target.value); setSavedIds(new Set()) }}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-500"
        >
          {meets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      <div className="flex items-center justify-between">
        <div>
          {liveData?.status === 0 ? (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="text-slate-600 text-xs">Kein LIVE-Stream aktiv</span>
          )}
        </div>
        {lastUpdated && (
          <p className="text-slate-700 text-[10px]">
            Aktualisiert {lastUpdated.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      {liveData?.status === 0 && liveData.event && (
        <div>
          <h3 className="text-slate-300 text-sm font-medium mb-2">{liveData.event}</h3>
          <div className="space-y-1.5">
            {(liveData.results ?? []).map(r => {
              const isMe = user && (
                r.name.toLowerCase().includes(user.name.toLowerCase().split(' ')[0])
                || (user.myresults_name && r.name.toLowerCase().includes(user.myresults_name.toLowerCase().split(' ')[0]))
              )
              return (
                <Card key={r.participantId} className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? 'border-sky-500/40 bg-sky-500/5' : ''}`}>
                  <span className="text-slate-500 text-xs w-5 text-right">{r.rank}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isMe ? 'text-sky-300' : 'text-white'}`}>{r.name}</p>
                    <p className="text-slate-600 text-xs">{r.club}</p>
                  </div>
                  <p className="font-mono text-white text-sm">{r.timeMs > 0 ? formatTime(r.timeMs) : '—'}</p>
                  {isMe && r.timeMs > 0 && (
                    <button
                      onClick={() => saveTime(r)}
                      disabled={savedIds.has(r.participantId)}
                      className={`p-1.5 rounded-lg transition-colors ${savedIds.has(r.participantId) ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
                    >
                      {savedIds.has(r.participantId) ? <Check size={13} /> : <Download size={13} />}
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {loading && !liveData && (
        <p className="text-slate-500 text-sm text-center py-8 animate-pulse">LIVE-Daten werden geladen…</p>
      )}
    </div>
  )
}
```

Zusätzlich: `SwimResult` Type-Import am Anfang der Datei ergänzen (falls noch nicht vorhanden):

```typescript
import type { MeetSummary, SwimmerResult, LiveResult, SwimResult } from '../types'
```

- [ ] **Step 4: Profil.tsx — myresults_name-Feld ergänzen**

In `src/pages/Profil.tsx` nach dem Import-Block `updateMe` (bereits importiert) nun `myresults_name` im Formular ergänzen.

State hinzufügen (nach den bestehenden States wie `icalToken`):

```typescript
const [myresultsName, setMyresultsName] = useState(user?.myresults_name ?? '')
const [myresultsSaving, setMyresultsSaving] = useState(false)
const [myresultsSaved, setMyresultsSaved] = useState(false)
```

Neue Speicher-Funktion (nach den anderen Handler-Funktionen):

```typescript
async function handleSaveMyresults() {
  setMyresultsSaving(true)
  const res = await updateMe({ myresults_name: myresultsName || undefined })
  if (res.ok) { setUser(res.data); setMyresultsSaved(true); setTimeout(() => setMyresultsSaved(false), 2000) }
  setMyresultsSaving(false)
}
```

Im JSX nach der iCal-Sektion (`</Card>` der iCal-Karte) einfügen:

```tsx
<Card className="p-4 space-y-3">
  <div>
    <h3 className="text-white font-medium text-sm">myresults.eu</h3>
    <p className="text-slate-500 text-xs mt-0.5">Dein Suchname für automatische Ergebnis-Importe</p>
  </div>
  <input
    type="text"
    placeholder="NACHNAME Vorname (z.B. URBAN Herman)"
    value={myresultsName}
    onChange={e => { setMyresultsName(e.target.value); setMyresultsSaved(false) }}
    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500"
  />
  <Button
    onClick={handleSaveMyresults}
    disabled={myresultsSaving}
    size="sm"
    variant="secondary"
  >
    {myresultsSaved ? '✓ Gespeichert' : myresultsSaving ? 'Wird gespeichert…' : 'Speichern'}
  </Button>
</Card>
```

- [ ] **Step 5: Ergebnisse.tsx löschen**

```bash
rm src/pages/Ergebnisse.tsx
```

Prüfe dass `Ergebnisse` nirgends mehr importiert wird:

```bash
grep -r "Ergebnisse" src/ --include="*.tsx" --include="*.ts"
```
Erwartetes Ergebnis: keine Treffer

- [ ] **Step 6: TypeScript-Compilation prüfen**

```bash
cd /Users/hermanurban/swimtrack-web && npx tsc --noEmit
```
Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 7: Alle Tests laufen lassen**

```bash
cd server && npx vitest run --reporter=verbose
```
Erwartetes Ergebnis: Alle Tests grün

- [ ] **Step 8: Commit**

```bash
git add src/pages/Zeiten.tsx src/pages/Profil.tsx
git rm src/pages/Ergebnisse.tsx
git commit -m "feat(zeiten): Wettkämpfe + LIVE tabs, myresults Profil-Feld, delete Ergebnisse.tsx"
```
