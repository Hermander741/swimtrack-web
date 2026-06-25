# Phase 2: Backend + myresults.eu Live-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Express.js backend proxy in `server/` that scrapes myresults.eu, plus overhaul the Ergebnisse page with three tabs for meet browsing, auto swimmer-result import, and LIVE tracking.

**Architecture:** `server/` is a standalone CommonJS Node.js project with Express + Axios + Cheerio. The Mac Mini runs it via pm2. The React PWA fetches from `VITE_API_URL` (Tailscale IP) via a thin `useApi` hook; localStorage persists the API URL at runtime. Frontend types extend existing `src/types/index.ts`.

**Tech Stack:** Node.js v24, Express 4, Axios 1, Cheerio 1, cors, dotenv, ts-node, vitest (server tests); React 19, Vite 8, Tailwind v4 (frontend)

## Global Constraints

- All UI copy is German (de-AT locale)
- Backend port: 3001 (overridable via `PORT` env var)
- All API responses: `{ ok: true, data: T }` on success, `{ ok: false, error: string }` on failure
- No headless browser — axios + cheerio only; myresults.eu User-Agent: `"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"`
- myresults.eu status images: `status_grey.png` = not started, `status_green.png` = complete, anything else = active/live
- Course: `'LB'` = 50m / LCM, `'KB'` = 25m / SCM
- `SwimTime.event` must be a value from `SWIM_EVENTS` in `src/utils/format.ts`; strip gender suffix when mapping
- TypeScript strict mode throughout; server uses `"module": "commonjs"` (no `.js` extensions in imports)
- Frontend types live in `src/types/index.ts`; server defines its own parallel types in `server/src/types.ts`
- `src/types/index.ts` is at path `src/types/index.ts` (not `src/types.ts`)
- Existing `src/hooks/` directory exists but is empty — create files there directly

---

### Task 1: Shared Frontend Types

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `MeetSummary`, `MeetEvent`, `SwimResult`, `LiveResult`, `SwimmerResult` (all exported); extended `Swimmer` with optional `myresultsName` and `myresultsMeetIds`

- [ ] **Step 1: Add new types to `src/types/index.ts`**

Replace the file entirely with:

```ts
export interface Swimmer {
  id: string
  name: string
  birthYear: number
  club: string
  avatarColor: string
  myresultsName?: string       // e.g. "URBAN Herman" (LASTNAME Firstname)
  myresultsMeetIds?: string[]  // meet IDs linked to this swimmer
}

export interface SwimTime {
  id: string
  swimmerId: string
  event: string
  course: 'LB' | 'KB'
  timeMs: number
  date: string
  competition?: string
  isPersonalBest?: boolean
}

export interface Competition {
  id: string
  name: string
  location: string
  startDate: string
  endDate: string
  course: 'LB' | 'KB'
  organizer?: string
  url?: string
  pdfUrl?: string
  swimmerId?: string
  status: 'upcoming' | 'ongoing' | 'past'
  registered?: boolean
}

export interface PDFDocument {
  id: string
  name: string
  competitionId?: string
  uploadedAt: string
  size: number
  dataUrl: string
}

export type NavItem = 'dashboard' | 'calendar' | 'zeiten' | 'ergebnisse' | 'dokumente'

// --- Phase 2: myresults.eu types ---

export interface MeetSummary {
  id: string           // "2365"
  name: string         // "Finalwettkämpfe der Österr. ..."
  startDate: string    // "2026-06-27"
  endDate: string      // "2026-06-28"
  location: string     // "BSFZ Südstadt"
  organizer: string    // "Österreichischer Schwimmverband"
  course: 'LB' | 'KB'
  status: 'upcoming' | 'today' | 'recent'
  hasLive: boolean
}

export interface MeetEvent {
  id: string       // "84203"
  number: number   // 1
  name: string     // "100m Schmetterling Damen"
  session: string  // "Samstag 27.06.2026 - 1. Abschnitt"
}

export interface SwimResult {
  rank: number
  name: string          // "DOLGOPOLOVA Kristina"
  birthYear: number     // 2021
  club: string          // "VIENNA AQUATIC SC"
  timeMs: number        // milliseconds; 0 = DNS/DSQ/DNF
  participantId: string // myresults.eu participant ID
}

export interface LiveResult {
  status: number        // -1 = no live session, 0 = active
  event?: string        // "100m Freistil Damen"
  results?: SwimResult[]
}

export interface SwimmerResult {
  meetId: string
  meetName: string
  meetDate: string      // startDate of the meet
  eventId: string
  eventName: string     // raw name, e.g. "100m Freistil Herren"
  course: 'LB' | 'KB'
  result: SwimResult
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web
npm run build 2>&1 | head -30
```

Expected: build succeeds (0 errors). If there are errors about unused vars in existing files, check that the new optional fields on `Swimmer` don't break existing call sites — they won't since all new fields are optional.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend types for Phase 2 myresults.eu integration"
```

---

### Task 2: Backend Scaffold

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/types.ts`
- Create: `server/src/httpClient.ts`
- Create: `server/src/cache.ts`
- Create: `server/src/index.ts`
- Create: `server/ecosystem.config.cjs`
- Create: `server/.env.example`

**Interfaces:**
- Produces:
  - `httpClient` — axios instance with correct headers
  - `Cache` class with `get<T>(key): T | undefined` and `set<T>(key, value, ttlMs): void`
  - Express app listening on `PORT` with `GET /health → { ok: true }`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "swimtrack-api",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "ts-node": "^10.9.2",
    "typescript": "~5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src", "test"],
  "ts-node": {
    "files": true
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create `server/src/types.ts`**

```ts
export interface MeetSummary {
  id: string
  name: string
  startDate: string
  endDate: string
  location: string
  organizer: string
  course: 'LB' | 'KB'
  status: 'upcoming' | 'today' | 'recent'
  hasLive: boolean
}

export interface MeetEvent {
  id: string
  number: number
  name: string
  session: string
}

export interface SwimResult {
  rank: number
  name: string
  birthYear: number
  club: string
  timeMs: number
  participantId: string
}

export interface LiveResult {
  status: number
  event?: string
  results?: SwimResult[]
}

export interface SwimmerResult {
  meetId: string
  meetName: string
  meetDate: string
  eventId: string
  eventName: string
  course: 'LB' | 'KB'
  result: SwimResult
}

export type ApiOk<T> = { ok: true; data: T }
export type ApiError = { ok: false; error: string }
export type ApiResponse<T> = ApiOk<T> | ApiError

export function ok<T>(data: T): ApiOk<T> { return { ok: true, data } }
export function err(error: string): ApiError { return { ok: false, error } }
```

- [ ] **Step 5: Create `server/src/httpClient.ts`**

```ts
import axios from 'axios'

export const httpClient = axios.create({
  baseURL: 'https://myresults.eu',
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'de-AT,de;q=0.9',
  },
})
```

- [ ] **Step 6: Create `server/src/cache.ts`**

```ts
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
}

export const cache = new Cache()
```

- [ ] **Step 7: Write cache test**

Create `server/test/cache.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { Cache } from '../src/cache'

describe('Cache', () => {
  it('returns undefined for missing keys', () => {
    const c = new Cache()
    expect(c.get('x')).toBeUndefined()
  })

  it('returns value within TTL', () => {
    const c = new Cache()
    c.set('k', 42, 5000)
    expect(c.get<number>('k')).toBe(42)
  })

  it('returns undefined after TTL expires', () => {
    vi.useFakeTimers()
    const c = new Cache()
    c.set('k', 42, 1000)
    vi.advanceTimersByTime(1001)
    expect(c.get('k')).toBeUndefined()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 8: Run cache test to verify it passes**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | head -20
```

Expected: `✓ 3 tests passed`

- [ ] **Step 9: Create `server/src/index.ts`**

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
}))

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '2.0.0' })
})

app.listen(PORT, () => {
  console.log(`SwimTrack API running on port ${PORT}`)
})
```

- [ ] **Step 10: Create `server/.env.example`**

```
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173
```

- [ ] **Step 11: Create `server/ecosystem.config.cjs`**

```js
module.exports = {
  apps: [{
    name: 'swimtrack-api',
    script: 'src/index.ts',
    interpreter: 'ts-node',
    interpreter_args: '--project tsconfig.json',
    cwd: '/Users/hermanurban/swimtrack-web/server',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
      ALLOWED_ORIGINS: 'http://localhost:5173',
    },
  }],
}
```

- [ ] **Step 12: Verify server starts**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm run dev &
sleep 2
curl -s http://localhost:3001/health
kill %1
```

Expected output: `{"ok":true,"version":"2.0.0"}`

- [ ] **Step 13: Commit**

```bash
cd /Users/hermanurban/swimtrack-web
git add server/
git commit -m "feat: add backend scaffold with Express, cache, and health endpoint"
```

---

### Task 3: Meet List Scraper + Route

**Files:**
- Create: `server/src/scrapers/meetList.ts`
- Create: `server/test/meetList.test.ts`
- Modify: `server/src/index.ts` (mount routes)
- Create: `server/src/routes/meets.ts`

**Interfaces:**
- Consumes: `httpClient` from `../httpClient`, `cache` from `../cache`, types from `../types`
- Produces: `scrapeMeetList(urlStatus: 'Today-Upcoming' | 'Recent'): Promise<MeetSummary[]>`, route `GET /api/meets?status=upcoming|recent|all`

**Meet list HTML structure (from myresults.eu):**
```html
<div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
  <div class="col-xs-10 col-sm-6 col-md-6 col-lg-7">
    <a href="/de-AT/Meets/Today-Upcoming/2365/Overview">Meet Name<i class="fa fa-angle-double-right"></i></a>
    <span class="myresults_content_divtable_details_black">50m (LCM), Hallenbad, Automatik</span>
    <span class="myresults_content_divtable_details">Organizer - Location</span>
    <div class="hidden-sm hidden-md hidden-lg">27.-28.06.2026</div>
  </div>
  <div class="hidden-xs col-sm-2">27.-28.06.2026</div>
  <div class="col-xs-1"><img src="/images/status_grey.png"></div>
</div>
```

- [ ] **Step 1: Write failing test `server/test/meetList.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseMeetRow, parseDateRange } from '../src/scrapers/meetList'
import * as cheerio from 'cheerio'

const ROW_HTML = `
<div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
  <div class="col-xs-10 col-sm-6 col-md-6 col-lg-7">
    <a href="/de-AT/Meets/Today-Upcoming/2365/Overview">Finalwettkämpfe<i class="fa fa-angle-double-right"></i></a>
    <span class="myresults_content_divtable_details_black">50m (LCM), Hallenbad</span>
    <span class="myresults_content_divtable_details">ÖSV - BSFZ Südstadt</span>
    <div class="hidden-sm hidden-md hidden-lg">27.-28.06.2026</div>
  </div>
  <div class="hidden-xs col-sm-2">27.-28.06.2026</div>
  <div class="col-xs-1"><img src="/images/status_grey.png"></div>
</div>`

describe('meetList scraper', () => {
  it('parseDateRange: single day', () => {
    expect(parseDateRange('28.06.2026')).toEqual({ startDate: '2026-06-28', endDate: '2026-06-28' })
  })

  it('parseDateRange: multi-day', () => {
    expect(parseDateRange('27.-28.06.2026')).toEqual({ startDate: '2026-06-27', endDate: '2026-06-28' })
  })

  it('parseDateRange: multi-day cross-month', () => {
    expect(parseDateRange('30.06.-01.07.2026')).toEqual({ startDate: '2026-06-30', endDate: '2026-07-01' })
  })

  it('parseMeetRow: extracts meet data from HTML row', () => {
    const $ = cheerio.load(ROW_HTML)
    const row = $('.myresults_content_divtablerow').first()
    const meet = parseMeetRow($, row, 'upcoming')
    expect(meet).not.toBeNull()
    expect(meet!.id).toBe('2365')
    expect(meet!.name).toBe('Finalwettkämpfe')
    expect(meet!.startDate).toBe('2026-06-27')
    expect(meet!.endDate).toBe('2026-06-28')
    expect(meet!.location).toBe('BSFZ Südstadt')
    expect(meet!.organizer).toBe('ÖSV')
    expect(meet!.course).toBe('LB')
    expect(meet!.status).toBe('upcoming')
    expect(meet!.hasLive).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | grep -E "FAIL|pass|Cannot find"
```

Expected: fails with "Cannot find module '../src/scrapers/meetList'"

- [ ] **Step 3: Implement `server/src/scrapers/meetList.ts`**

```ts
import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { MeetSummary } from '../types'

const TTL_MS = 5 * 60 * 1000

export function parseDateRange(s: string): { startDate: string; endDate: string } {
  const clean = s.trim()
  // Cross-month: "30.06.-01.07.2026"
  const crossMonth = clean.match(/^(\d{2})\.(\d{2})\.-(\d{2})\.(\d{2})\.(\d{4})$/)
  if (crossMonth) {
    const [, d1, m1, d2, m2, yyyy] = crossMonth
    return { startDate: `${yyyy}-${m1}-${d1}`, endDate: `${yyyy}-${m2}-${d2}` }
  }
  // Same-month multi-day: "27.-28.06.2026"
  const sameMonth = clean.match(/^(\d{1,2})\.-(\d{2})\.(\d{2})\.(\d{4})$/)
  if (sameMonth) {
    const [, d1, d2, mm, yyyy] = sameMonth
    return {
      startDate: `${yyyy}-${mm}-${d1.padStart(2, '0')}`,
      endDate: `${yyyy}-${mm}-${d2}`,
    }
  }
  // Single day: "28.06.2026"
  const single = clean.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (single) {
    const [, dd, mm, yyyy] = single
    return { startDate: `${yyyy}-${mm}-${dd}`, endDate: `${yyyy}-${mm}-${dd}` }
  }
  return { startDate: '', endDate: '' }
}

export function parseMeetRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<cheerio.Element>,
  status: MeetSummary['status'],
): MeetSummary | null {
  const link = row.find('a[href*="/Overview"]').first()
  const href = link.attr('href') ?? ''
  const idMatch = href.match(/\/(\d+)\/Overview/)
  if (!idMatch) return null

  const rawName = link.clone().children('i').remove().end().text().trim()
  const detailsBlack = row.find('.myresults_content_divtable_details_black').first().text().trim()
  const details = row.find('.myresults_content_divtable_details').first().text().trim()

  const parts = details.split(' - ')
  const organizer = parts[0]?.trim() ?? ''
  const location = parts[1]?.trim() ?? ''

  const dateText = (row.find('.hidden-xs.col-sm-2').text().trim()
    || row.find('.hidden-sm.hidden-md.hidden-lg').text().trim())
  const { startDate, endDate } = parseDateRange(dateText)

  const course: 'LB' | 'KB' = (detailsBlack.includes('25m') || detailsBlack.includes('SCM')) ? 'KB' : 'LB'

  const statusImg = row.find('img[src*="status_"]').attr('src') ?? ''
  const hasLive = !statusImg.includes('status_grey') && !statusImg.includes('status_green')

  return { id: idMatch[1], name: rawName, startDate, endDate, location, organizer, course, status, hasLive }
}

export async function scrapeMeetList(urlStatus: 'Today-Upcoming' | 'Recent'): Promise<MeetSummary[]> {
  const cacheKey = `meets:${urlStatus}`
  const cached = cache.get<MeetSummary[]>(cacheKey)
  if (cached) return cached

  const status: MeetSummary['status'] = urlStatus === 'Recent' ? 'recent' : 'upcoming'
  const { data: html } = await httpClient.get<string>(`/de-AT/Meets/${urlStatus}`)
  const $ = cheerio.load(html)

  const meets: MeetSummary[] = []
  $('.myresults_content_divtablerow').each((_, el) => {
    const row = $(el)
    if (row.hasClass('myresults_content_divtablerow_header')) return
    const meet = parseMeetRow($, row, status)
    if (meet && !meets.some(m => m.id === meet.id)) meets.push(meet)
  })

  cache.set(cacheKey, meets, TTL_MS)
  return meets
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | head -30
```

Expected: `✓ 7 tests passed` (3 cache + 4 meetList)

- [ ] **Step 5: Create `server/src/routes/meets.ts`**

```ts
import { Router } from 'express'
import { scrapeMeetList } from '../scrapers/meetList'
import { ok, err } from '../types'

export const meetsRouter = Router()

meetsRouter.get('/', async (req, res) => {
  const status = (req.query.status as string) ?? 'all'
  try {
    let meets = []
    if (status === 'upcoming' || status === 'all') {
      meets.push(...await scrapeMeetList('Today-Upcoming'))
    }
    if (status === 'recent' || status === 'all') {
      meets.push(...await scrapeMeetList('Recent'))
    }
    res.json(ok(meets))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
```

- [ ] **Step 6: Mount router in `server/src/index.ts`**

Add these lines before `app.listen`:

```ts
import { meetsRouter } from './routes/meets'

// (add after cors/json middleware, before listen)
app.use('/api/meets', meetsRouter)
```

Full `server/src/index.ts`:

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { meetsRouter } from './routes/meets'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
}))

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '2.0.0' })
})

app.use('/api/meets', meetsRouter)

app.listen(PORT, () => {
  console.log(`SwimTrack API running on port ${PORT}`)
})
```

- [ ] **Step 7: Manual smoke test**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm run dev &
sleep 3
curl -s "http://localhost:3001/api/meets?status=upcoming" | python3 -m json.tool | head -30
kill %1
```

Expected: JSON with `ok: true` and `data` array of meets including id "2365".

- [ ] **Step 8: Commit**

```bash
cd /Users/hermanurban/swimtrack-web
git add server/src/scrapers/meetList.ts server/src/routes/meets.ts server/src/index.ts server/test/meetList.test.ts
git commit -m "feat: meet list scraper and GET /api/meets route"
```

---

### Task 4: Event List + Result Table Scrapers + Routes

**Files:**
- Create: `server/src/scrapers/eventList.ts`
- Create: `server/src/scrapers/resultTable.ts`
- Create: `server/test/eventList.test.ts`
- Create: `server/test/resultTable.test.ts`
- Create: `server/src/routes/results.ts`
- Modify: `server/src/routes/meets.ts` (add GET /api/meets/:id/events)
- Modify: `server/src/index.ts` (mount results router)

**Interfaces:**
- Consumes: `httpClient`, `cache`, types
- Produces:
  - `scrapeEventList(meetId, urlStatus): Promise<MeetEvent[]>` — GET /api/meets/:id/events
  - `scrapeResultTable(meetId, eventId, urlStatus): Promise<SwimResult[]>` — GET /api/meets/:id/results/:eventId

**HTML fixtures:**

Event list (from `select#selectevent`):
```html
<select id="selectevent">
  <optgroup label="Samstag 27.06.2026&lt;br&gt;1. Abschnitt - Einschwimmen 13:00, Beginn 14:00">
    <option selected value="84203">1 - 100m Schmetterling Damen</option>
    <option value="84204">2 - 100m Schmetterling Herren</option>
  </optgroup>
</select>
```

Result table (`#starts_content`):
```html
<div id="starts_content">
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_header">
    <div class="col-xs-12 myresults_content_divtablecol">Jahrgang 2021</div>
  </div>
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
    <div class="col-xs-1"><span class="msecm-place msecm-place-gold">1.</span></div>
    <div class="col-xs-11 col-sm-4">
      <a href="/de-AT/Meets/Recent/2391/Participant/332838">DOLGOPOLOVA Kristina<i class="fa fa-angle-double-right"></i></a>
      <span class="myresults_content_divtable_details">2021 W</span>
    </div>
    <div class="hidden-xs col-sm-4"><a href="/de-AT/Meets/Recent/2391/Club/7519">VIENNA AQUATIC SC<i class="fa fa-angle-double-right"></i></a></div>
    <div class="hidden-xs col-sm-2 col-md-1 text-right myresults_content_divtable_right">39.76</div>
  </div>
</div>
```

- [ ] **Step 1: Write failing test `server/test/eventList.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseEventList } from '../src/scrapers/eventList'
import * as cheerio from 'cheerio'

const HTML = `
<select id="selectevent">
  <optgroup label="Samstag 27.06.2026&lt;br&gt;1. Abschnitt - Einschwimmen 13:00, Beginn 14:00">
    <option selected value="84203">1 - 100m Schmetterling Damen</option>
    <option value="84204">2 - 100m Schmetterling Herren</option>
  </optgroup>
  <optgroup label="Sonntag 28.06.2026&lt;br&gt;2. Abschnitt">
    <option value="84205">3 - 100m Rücken Damen</option>
  </optgroup>
</select>`

describe('eventList scraper', () => {
  it('parses events from select element', () => {
    const $ = cheerio.load(HTML)
    const events = parseEventList($)
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({
      id: '84203',
      number: 1,
      name: '100m Schmetterling Damen',
      session: 'Samstag 27.06.2026 - 1. Abschnitt - Einschwimmen 13:00, Beginn 14:00',
    })
    expect(events[1].id).toBe('84204')
    expect(events[2].id).toBe('84205')
  })
})
```

- [ ] **Step 2: Write failing test `server/test/resultTable.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { parseResultTable, parseTimeMs } from '../src/scrapers/resultTable'
import * as cheerio from 'cheerio'

const HTML = `
<div id="starts_content">
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_header">
    <div class="col-xs-12 myresults_content_divtablecol">Jahrgang 2021</div>
  </div>
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_odd">
    <div class="col-xs-1"><span class="msecm-place msecm-place-gold">1.</span></div>
    <div class="col-xs-11 col-sm-4">
      <a href="/de-AT/Meets/Recent/2391/Participant/332838">DOLGOPOLOVA Kristina<i class="fa fa-angle-double-right"></i></a>
      <span class="myresults_content_divtable_details">2021 W</span>
    </div>
    <div class="hidden-xs col-sm-4"><a href="/de-AT/Meets/Recent/2391/Club/7519">VIENNA AQUATIC SC<i></i></a></div>
    <div class="hidden-xs col-sm-2 col-md-1 text-right myresults_content_divtable_right">39.76</div>
  </div>
  <div class="row myresults_content_divtablerow myresults_content_divtablerow_even">
    <div class="col-xs-1"><span class="msecm-place msecm-place-silver">2.</span></div>
    <div class="col-xs-11 col-sm-4">
      <a href="/de-AT/Meets/Recent/2391/Participant/332829">MUSTERMANN Max<i></i></a>
      <span class="myresults_content_divtable_details">2010 M</span>
    </div>
    <div class="hidden-xs col-sm-4"><a href="/de-AT/Meets/Recent/2391/Club/100">SV WIEN<i></i></a></div>
    <div class="hidden-xs col-sm-2 col-md-1 text-right myresults_content_divtable_right">1:03.42</div>
  </div>
</div>`

describe('resultTable scraper', () => {
  it('parseTimeMs: seconds only', () => {
    expect(parseTimeMs('39.76')).toBe(39760)
  })

  it('parseTimeMs: minutes and seconds', () => {
    expect(parseTimeMs('1:03.42')).toBe(63420)
  })

  it('parseTimeMs: DNS/DSQ returns 0', () => {
    expect(parseTimeMs('DNS')).toBe(0)
    expect(parseTimeMs('DSQ')).toBe(0)
  })

  it('parses result table rows', () => {
    const $ = cheerio.load(HTML)
    const results = parseResultTable($)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      rank: 1,
      name: 'DOLGOPOLOVA Kristina',
      birthYear: 2021,
      club: 'VIENNA AQUATIC SC',
      timeMs: 39760,
      participantId: '332838',
    })
    expect(results[1].rank).toBe(2)
    expect(results[1].name).toBe('MUSTERMANN Max')
    expect(results[1].timeMs).toBe(63420)
    expect(results[1].birthYear).toBe(2010)
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: failures for both new test files.

- [ ] **Step 4: Implement `server/src/scrapers/eventList.ts`**

```ts
import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { MeetEvent } from '../types'

const TTL_MS = 10 * 60 * 1000

export function parseEventList($: cheerio.CheerioAPI): MeetEvent[] {
  const events: MeetEvent[] = []
  $('select#selectevent optgroup').each((_, group) => {
    const rawLabel = $(group).attr('label') ?? ''
    const session = rawLabel.replace(/<br>/gi, ' - ').replace(/&lt;br&gt;/gi, ' - ').trim()
    $(group).find('option').each((_, opt) => {
      const val = $(opt).attr('value') ?? ''
      const text = $(opt).text().trim()
      const match = text.match(/^(\d+)\s*-\s*(.+)$/)
      if (!match || !val) return
      events.push({ id: val, number: parseInt(match[1], 10), name: match[2].trim(), session })
    })
  })
  return events
}

export async function scrapeEventList(meetId: string, urlStatus: string): Promise<MeetEvent[]> {
  const key = `events:${meetId}`
  const cached = cache.get<MeetEvent[]>(key)
  if (cached) return cached

  const { data: html } = await httpClient.get<string>(`/de-AT/Meets/${urlStatus}/${meetId}/Results`)
  const $ = cheerio.load(html)
  const events = parseEventList($)
  cache.set(key, events, TTL_MS)
  return events
}
```

- [ ] **Step 5: Implement `server/src/scrapers/resultTable.ts`**

```ts
import * as cheerio from 'cheerio'
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import type { SwimResult } from '../types'

const TTL_MS = 2 * 60 * 1000

export function parseTimeMs(s: string): number {
  const clean = s.trim()
  if (!clean || ['DNS', 'DSQ', 'DNF', 'DQ', '---'].some(x => clean.toUpperCase().includes(x))) return 0
  const parts = clean.split(':')
  if (parts.length === 2) {
    return Math.round((parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000)
  }
  return Math.round(parseFloat(clean) * 1000)
}

export function parseResultTable($: cheerio.CheerioAPI): SwimResult[] {
  const results: SwimResult[] = []
  $('#starts_content .myresults_content_divtablerow').each((_, el) => {
    const row = $(el)
    if (row.hasClass('myresults_content_divtablerow_header')) return

    const placeEl = row.find('.msecm-place').first()
    if (!placeEl.length) return
    const rank = parseInt(placeEl.text().replace('.', '').trim(), 10)
    if (isNaN(rank)) return

    const participantLink = row.find('a[href*="/Participant/"]').first()
    const href = participantLink.attr('href') ?? ''
    const pidMatch = href.match(/\/Participant\/(\d+)/)
    if (!pidMatch) return

    const name = participantLink.clone().children('i').remove().end().text().trim()
    const details = row.find('.myresults_content_divtable_details').first().text().trim()
    const birthYear = parseInt(details.split(' ')[0], 10) || 0

    const clubLink = row.find('a[href*="/Club/"]').first()
    const club = clubLink.clone().children('i').remove().end().text().trim()

    // Time is in .hidden-xs.col-sm-2.col-md-1 or similar right-aligned cell
    const timeEl = row.find('.myresults_content_divtable_right').filter((_, e) => {
      return $(e).hasClass('hidden-xs')
    }).last()
    const timeMs = parseTimeMs(timeEl.text().trim())

    results.push({ rank, name, birthYear, club, timeMs, participantId: pidMatch[1] })
  })
  return results
}

export async function scrapeResultTable(
  meetId: string, eventId: string, urlStatus: string,
): Promise<SwimResult[]> {
  const key = `results:${meetId}:${eventId}`
  const cached = cache.get<SwimResult[]>(key)
  if (cached) return cached

  const { data: html } = await httpClient.post<string>(
    `/de-AT/Meets/${urlStatus}/${meetId}/Results/${eventId}`,
    null,
    { headers: { Referer: `https://myresults.eu/de-AT/Meets/${urlStatus}/${meetId}/Results` } },
  )
  const $ = cheerio.load(html)
  const results = parseResultTable($)
  cache.set(key, results, TTL_MS)
  return results
}
```

- [ ] **Step 6: Run all tests — all must pass**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | head -30
```

Expected: `✓ 11 tests passed`

- [ ] **Step 7: Add `/api/meets/:id/events` to `server/src/routes/meets.ts`**

```ts
import { Router } from 'express'
import { scrapeMeetList } from '../scrapers/meetList'
import { scrapeEventList } from '../scrapers/eventList'
import { ok, err } from '../types'

export const meetsRouter = Router()

meetsRouter.get('/', async (req, res) => {
  const status = (req.query.status as string) ?? 'all'
  try {
    const meets = []
    if (status === 'upcoming' || status === 'all') meets.push(...await scrapeMeetList('Today-Upcoming'))
    if (status === 'recent' || status === 'all') meets.push(...await scrapeMeetList('Recent'))
    res.json(ok(meets))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})

meetsRouter.get('/:id/events', async (req, res) => {
  const { id } = req.params
  const urlStatus = (req.query.urlStatus as string) ?? 'Recent'
  try {
    const events = await scrapeEventList(id, urlStatus)
    res.json(ok(events))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
```

- [ ] **Step 8: Create `server/src/routes/results.ts`**

```ts
import { Router } from 'express'
import { scrapeResultTable } from '../scrapers/resultTable'
import { ok, err } from '../types'

export const resultsRouter = Router()

resultsRouter.get('/:meetId/results/:eventId', async (req, res) => {
  const { meetId, eventId } = req.params
  const urlStatus = (req.query.urlStatus as string) ?? 'Recent'
  try {
    const results = await scrapeResultTable(meetId, eventId, urlStatus)
    res.json(ok(results))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
```

- [ ] **Step 9: Mount results router in `server/src/index.ts`**

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { meetsRouter } from './routes/meets'
import { resultsRouter } from './routes/results'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
}))

app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }))
app.use('/api/meets', meetsRouter)
app.use('/api/meets', resultsRouter)

app.listen(PORT, () => console.log(`SwimTrack API running on port ${PORT}`))
```

- [ ] **Step 10: Commit**

```bash
cd /Users/hermanurban/swimtrack-web
git add server/src/scrapers/eventList.ts server/src/scrapers/resultTable.ts \
        server/src/routes/results.ts server/src/routes/meets.ts server/src/index.ts \
        server/test/eventList.test.ts server/test/resultTable.test.ts
git commit -m "feat: event list + result table scrapers and routes"
```

---

### Task 5: LIVE Results + Swimmer Auto-Results Routes

**Files:**
- Create: `server/src/scrapers/liveResults.ts`
- Create: `server/test/liveResults.test.ts`
- Create: `server/src/routes/live.ts`
- Create: `server/src/routes/swimmer.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `httpClient`, `cache`, `scrapeEventList`, `scrapeResultTable`, `scrapeMeetList`
- Produces:
  - `GET /api/meets/:id/live` → `{ ok: true, data: LiveResult }`
  - `GET /api/swimmer/results?name=NAME&birthYear=YEAR` → `{ ok: true, data: SwimmerResult[] }`

**LIVE API:** `POST /ajax_liveresults.php` with body `pathbase=&path=de-AT%2FMeets%2F{urlStatus}%2F{meetId}&language=de-AT&meet={meetId}` — returns JSON: `{ status: -1, title1: null }` when no live session, or `{ status: 0, ... }` with results when live.

**Swimmer auto-results:** For each of the last 5 recent meets, fetch all events, fetch result table for each event, filter by name (case-insensitive partial match) AND birthYear. Returns matching `SwimmerResult[]`.

- [ ] **Step 1: Write failing test `server/test/liveResults.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { parseLiveResponse } from '../src/scrapers/liveResults'

describe('liveResults scraper', () => {
  it('handles no-live-session response (status -1)', () => {
    const result = parseLiveResponse({ status: -1, title1: null, statustext: null })
    expect(result.status).toBe(-1)
    expect(result.results).toBeUndefined()
  })

  it('handles active live session (status 0)', () => {
    const raw = {
      status: 0,
      title1: '100m Freistil Damen',
      results: [
        { rank: '1', name: 'MUSTER Anna', year: '2010', club: 'SV Wien', time: '1:02.45', participantid: '999' },
      ],
    }
    const result = parseLiveResponse(raw)
    expect(result.status).toBe(0)
    expect(result.event).toBe('100m Freistil Damen')
    expect(result.results).toHaveLength(1)
    expect(result.results![0].timeMs).toBe(62450)
    expect(result.results![0].name).toBe('MUSTER Anna')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: fails with "Cannot find module '../src/scrapers/liveResults'"

- [ ] **Step 3: Implement `server/src/scrapers/liveResults.ts`**

```ts
import { httpClient } from '../httpClient'
import { cache } from '../cache'
import { parseTimeMs } from './resultTable'
import type { LiveResult, SwimResult } from '../types'

const TTL_MS = 10 * 1000

interface RawLiveResult {
  status: number
  title1?: string | null
  statustext?: string | null
  results?: Array<{
    rank: string
    name: string
    year: string
    club: string
    time: string
    participantid: string
  }>
}

export function parseLiveResponse(raw: RawLiveResult): LiveResult {
  if (raw.status !== 0 || !raw.results) return { status: raw.status }
  const results: SwimResult[] = raw.results.map(r => ({
    rank: parseInt(r.rank, 10) || 0,
    name: r.name,
    birthYear: parseInt(r.year, 10) || 0,
    club: r.club,
    timeMs: parseTimeMs(r.time),
    participantId: r.participantid,
  }))
  return { status: raw.status, event: raw.title1 ?? undefined, results }
}

export async function scrapeLiveResults(meetId: string, urlStatus: string): Promise<LiveResult> {
  const key = `live:${meetId}`
  const cached = cache.get<LiveResult>(key)
  if (cached) return cached

  const path = `de-AT/Meets/${urlStatus}/${meetId}`
  const { data } = await httpClient.post<RawLiveResult>(
    '/ajax_liveresults.php',
    new URLSearchParams({ pathbase: '', path, language: 'de-AT', meet: meetId }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
  const result = parseLiveResponse(data)
  cache.set(key, result, TTL_MS)
  return result
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test 2>&1 | head -20
```

Expected: `✓ 13 tests passed`

- [ ] **Step 5: Create `server/src/routes/live.ts`**

```ts
import { Router } from 'express'
import { scrapeLiveResults } from '../scrapers/liveResults'
import { ok, err } from '../types'

export const liveRouter = Router()

liveRouter.get('/:id/live', async (req, res) => {
  const { id } = req.params
  const urlStatus = (req.query.urlStatus as string) ?? 'Today-Upcoming'
  try {
    const result = await scrapeLiveResults(id, urlStatus)
    res.json(ok(result))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
```

- [ ] **Step 6: Create `server/src/routes/swimmer.ts`**

```ts
import { Router } from 'express'
import { scrapeMeetList } from '../scrapers/meetList'
import { scrapeEventList } from '../scrapers/eventList'
import { scrapeResultTable } from '../scrapers/resultTable'
import { ok, err } from '../types'
import type { SwimmerResult } from '../types'

export const swimmerRouter = Router()

swimmerRouter.get('/results', async (req, res) => {
  const name = (req.query.name as string ?? '').trim().toLowerCase()
  const birthYear = parseInt(req.query.birthYear as string ?? '0', 10)

  if (!name) {
    res.status(400).json(err('name query param required'))
    return
  }

  try {
    const recentMeets = await scrapeMeetList('Recent')
    const meetsToSearch = recentMeets.slice(0, 5)
    const swimmerResults: SwimmerResult[] = []

    for (const meet of meetsToSearch) {
      const events = await scrapeEventList(meet.id, 'Recent')
      for (const event of events) {
        const rows = await scrapeResultTable(meet.id, event.id, 'Recent')
        for (const row of rows) {
          const nameMatch = row.name.toLowerCase().includes(name)
            || name.split(' ').every(part => row.name.toLowerCase().includes(part))
          const yearMatch = !birthYear || row.birthYear === birthYear
          if (nameMatch && yearMatch && row.timeMs > 0) {
            swimmerResults.push({
              meetId: meet.id,
              meetName: meet.name,
              meetDate: meet.startDate,
              eventId: event.id,
              eventName: event.name,
              course: meet.course,
              result: row,
            })
          }
        }
      }
    }

    res.json(ok(swimmerResults))
  } catch (e) {
    res.status(502).json(err(e instanceof Error ? e.message : 'Scrape failed'))
  }
})
```

- [ ] **Step 7: Mount new routers in `server/src/index.ts`**

```ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { meetsRouter } from './routes/meets'
import { resultsRouter } from './routes/results'
import { liveRouter } from './routes/live'
import { swimmerRouter } from './routes/swimmer'

const app = express()
const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',')

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
}))

app.use(express.json())
app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }))
app.use('/api/meets', meetsRouter)
app.use('/api/meets', liveRouter)
app.use('/api/meets', resultsRouter)
app.use('/api/swimmer', swimmerRouter)

app.listen(PORT, () => console.log(`SwimTrack API running on port ${PORT}`))
```

- [ ] **Step 8: Commit**

```bash
cd /Users/hermanurban/swimtrack-web
git add server/src/scrapers/liveResults.ts server/test/liveResults.test.ts \
        server/src/routes/live.ts server/src/routes/swimmer.ts server/src/index.ts
git commit -m "feat: LIVE results and swimmer auto-results routes"
```

---

### Task 6: Frontend — API Hook + Config Modal

**Files:**
- Create: `src/hooks/useApi.ts`
- Create: `src/components/ApiConfigModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  - `useApi()` — returns `{ get<T>(path): Promise<T>, baseUrl: string, isConfigured: boolean }`
  - `ApiConfigModal` — `{ open: boolean, onClose: () => void }`

**API URL resolution order:** localStorage key `swimtrack_api_url` → `import.meta.env.VITE_API_URL` → empty string (unconfigured state)

- [ ] **Step 1: Create `src/hooks/useApi.ts`**

```ts
const STORAGE_KEY = 'swimtrack_api_url'

export function useApi() {
  function baseUrl(): string {
    return localStorage.getItem(STORAGE_KEY)
      ?? import.meta.env.VITE_API_URL
      ?? ''
  }

  const isConfigured = !!baseUrl()

  async function get<T>(path: string): Promise<T> {
    const url = `${baseUrl()}${path}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string }
    if (!json.ok) throw new Error(json.error ?? 'API error')
    return json.data as T
  }

  function saveUrl(url: string) {
    const trimmed = url.trim().replace(/\/$/, '')
    localStorage.setItem(STORAGE_KEY, trimmed)
  }

  return { get, baseUrl, isConfigured, saveUrl }
}
```

- [ ] **Step 2: Create `src/components/ApiConfigModal.tsx`**

```tsx
import { useState } from 'react'
import { Modal } from './Modal'
import { useApi } from '../hooks/useApi'
import { Wifi, WifiOff, Check } from 'lucide-react'

interface ApiConfigModalProps {
  open: boolean
  onClose: () => void
}

export function ApiConfigModal({ open, onClose }: ApiConfigModalProps) {
  const api = useApi()
  const [url, setUrl] = useState(api.baseUrl() ?? '')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function testConnection(testUrl: string) {
    setStatus('testing')
    setErrorMsg('')
    try {
      const res = await fetch(`${testUrl.trim().replace(/\/$/, '')}/health`)
      const json = await res.json() as { ok?: boolean }
      if (json.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrorMsg('Server antwortet, aber meldet Fehler')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Verbindung fehlgeschlagen — prüfe URL und Tailscale')
    }
  }

  function save() {
    api.saveUrl(url)
    onClose()
    window.location.reload()
  }

  return (
    <Modal open={open} onClose={onClose} title="Backend verbinden">
      <div className="space-y-4">
        <p className="text-slate-400 text-sm">
          Gib die URL deines Mac Mini Backends ein (erreichbar via Tailscale).
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Backend URL</label>
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setStatus('idle') }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-sky-500 outline-none"
            placeholder="http://100.x.x.x:3001"
          />
        </div>
        <button
          type="button"
          onClick={() => testConnection(url)}
          disabled={!url || status === 'testing'}
          className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {status === 'testing' ? (
            <span className="animate-pulse">Verbindung testen…</span>
          ) : status === 'ok' ? (
            <><Check size={14} className="text-emerald-400" /> Verbindung OK</>
          ) : status === 'error' ? (
            <><WifiOff size={14} className="text-rose-400" /> {errorMsg}</>
          ) : (
            <><Wifi size={14} /> Verbindung testen</>
          )}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!url}
          className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Speichern
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 3: Add API config trigger to `src/App.tsx`**

Replace `src/App.tsx`:

```tsx
import { createContext, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { Kalender } from './pages/Kalender'
import { Zeiten } from './pages/Zeiten'
import { Ergebnisse } from './pages/Ergebnisse'
import { Dokumente } from './pages/Dokumente'
import { ApiConfigModal } from './components/ApiConfigModal'

type StoreType = ReturnType<typeof useStore>
export const StoreContext = createContext<StoreType | null>(null)
export const ApiConfigContext = createContext<{ openConfig: () => void }>({ openConfig: () => {} })

export default function App() {
  const store = useStore()
  const [configOpen, setConfigOpen] = useState(false)
  return (
    <StoreContext.Provider value={store}>
      <ApiConfigContext.Provider value={{ openConfig: () => setConfigOpen(true) }}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kalender" element={<Kalender />} />
            <Route path="/zeiten" element={<Zeiten />} />
            <Route path="/ergebnisse" element={<Ergebnisse />} />
            <Route path="/dokumente" element={<Dokumente />} />
          </Routes>
          <BottomNav />
        </BrowserRouter>
        <ApiConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
      </ApiConfigContext.Provider>
    </StoreContext.Provider>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web
npm run build 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Start dev server and manually test config modal**

```bash
npm run dev
```

Open browser to `http://localhost:5173`. No visible change yet — ApiConfigModal is only opened programmatically from Ergebnisse page.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useApi.ts src/components/ApiConfigModal.tsx src/App.tsx
git commit -m "feat: add useApi hook and ApiConfigModal for backend URL configuration"
```

---

### Task 7: Frontend — Ergebnisse (Tabs 1 & 2: Wettkämpfe + Mein Schwimmer)

**Files:**
- Modify: `src/pages/Ergebnisse.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useApi()`, `StoreContext`, `ApiConfigContext`, types from `../types`
- Tab 1 (Wettkämpfe): calls `GET /api/meets?status=all` → `MeetSummary[]`; each meet row has "In Kalender" button that calls `store.addCompetition`
- Tab 2 (Mein Schwimmer): calls `GET /api/swimmer/results?name=NAME&birthYear=YEAR` → `SwimmerResult[]`; each result has "Importieren" button calling `store.addTime` with duplicate guard

**Duplicate guard:** before `store.addTime`, check `store.times.some(t => t.swimmerId === swimmer.id && t.event === eventName && t.date === result.meetDate && t.timeMs === result.result.timeMs)`

**Event name normalization:** strip gender suffix: `/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i`

- [ ] **Step 1: Rewrite `src/pages/Ergebnisse.tsx` (Tabs 1 & 2 + skeleton for Tab 3)**

```tsx
import { useContext, useState, useEffect, useCallback } from 'react'
import { Trophy, Calendar, User, Wifi, RefreshCw, Download, Check, Radio } from 'lucide-react'
import { StoreContext, ApiConfigContext } from '../App'
import { Card } from '../components/Card'
import { SwimmerChip } from '../components/SwimmerChip'
import { useApi } from '../hooks/useApi'
import { generateId } from '../utils/format'
import type { MeetSummary, SwimmerResult } from '../types'

type Tab = 'meets' | 'swimmer' | 'live'

function normalizeEventName(raw: string): string {
  return raw
    .replace(/^\d+\s*-\s*/, '')
    .replace(/\s+(Damen|Herren|Mixed|gemischt|Frauen|Männer)$/i, '')
    .trim()
}

function StatusBadge({ meet }: { meet: MeetSummary }) {
  if (meet.hasLive) return (
    <span className="flex items-center gap-1 bg-emerald-400/20 text-emerald-300 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-400/30">
      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> LIVE
    </span>
  )
  if (meet.status === 'recent') return (
    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Abgeschlossen</span>
  )
  return (
    <span className="text-[10px] text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full">Geplant</span>
  )
}

function MeetCard({ meet, onAddToCalendar, alreadyInCalendar }: {
  meet: MeetSummary
  onAddToCalendar: (m: MeetSummary) => void
  alreadyInCalendar: boolean
}) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge meet={meet} />
            <span className="text-[10px] text-slate-500">{meet.course}</span>
          </div>
          <p className="text-white text-sm font-medium leading-tight">{meet.name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{meet.location}</p>
          <p className="text-slate-600 text-xs">{meet.startDate}{meet.startDate !== meet.endDate ? ` – ${meet.endDate}` : ''}</p>
        </div>
        <button
          onClick={() => onAddToCalendar(meet)}
          disabled={alreadyInCalendar}
          className={`flex-shrink-0 p-2 rounded-xl transition-colors ${alreadyInCalendar ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
          title={alreadyInCalendar ? 'Bereits im Kalender' : 'In Kalender hinzufügen'}
        >
          {alreadyInCalendar ? <Check size={16} /> : <Calendar size={16} />}
        </button>
      </div>
    </Card>
  )
}

function WettkämpfeTab() {
  const store = useContext(StoreContext)!
  const api = useApi()
  const { openConfig } = useContext(ApiConfigContext)
  const [meets, setMeets] = useState<MeetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!api.isConfigured) return
    setLoading(true)
    setError('')
    try {
      const data = await api.get<MeetSummary[]>('/api/meets?status=all')
      setMeets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  function addToCalendar(meet: MeetSummary) {
    const today = new Date().toISOString().split('T')[0]
    store.addCompetition({
      id: `myresults-${meet.id}`,
      name: meet.name,
      location: meet.location,
      startDate: meet.startDate,
      endDate: meet.endDate,
      course: meet.course,
      organizer: meet.organizer,
      status: meet.status === 'recent' ? 'past' : meet.startDate <= today ? 'ongoing' : 'upcoming',
    })
  }

  if (!api.isConfigured) {
    return (
      <div className="text-center py-16">
        <Wifi size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm mb-4">Kein Backend verbunden</p>
        <button onClick={openConfig} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
          Backend verbinden
        </button>
      </div>
    )
  }

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
        <MeetCard
          key={m.id}
          meet={m}
          onAddToCalendar={addToCalendar}
          alreadyInCalendar={store.competitions.some(c => c.id === `myresults-${m.id}`)}
        />
      ))}
    </div>
  )
}

function MeinSchwimmerTab() {
  const store = useContext(StoreContext)!
  const api = useApi()
  const { openConfig } = useContext(ApiConfigContext)
  const swimmer = store.activeSwimmer
  const [results, setResults] = useState<SwimmerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imported, setImported] = useState<Set<string>>(new Set())

  const searchName = swimmer?.myresultsName
    ?? swimmer?.name.toUpperCase()
    ?? ''

  const load = useCallback(async () => {
    if (!api.isConfigured || !swimmer) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        name: searchName,
        birthYear: swimmer.birthYear.toString(),
      })
      const data = await api.get<SwimmerResult[]>(`/api/swimmer/results?${params}`)
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [api, swimmer, searchName])

  useEffect(() => { load() }, [load])

  function importResult(r: SwimmerResult) {
    if (!swimmer) return
    const eventName = normalizeEventName(r.eventName)
    const key = `${r.meetDate}-${r.eventId}`

    const isDuplicate = store.times.some(t =>
      t.swimmerId === swimmer.id &&
      t.event === eventName &&
      t.date === r.meetDate &&
      t.timeMs === r.result.timeMs,
    )
    if (isDuplicate) {
      setImported(prev => new Set([...prev, key]))
      return
    }

    store.addTime({
      id: generateId(),
      swimmerId: swimmer.id,
      event: eventName,
      course: r.course,
      timeMs: r.result.timeMs,
      date: r.meetDate,
      competition: r.meetName,
      isPersonalBest: false,
    })
    setImported(prev => new Set([...prev, key]))
  }

  function importAll() {
    results.forEach(r => importResult(r))
  }

  if (!api.isConfigured) {
    return (
      <div className="text-center py-16">
        <Wifi size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm mb-4">Kein Backend verbunden</p>
        <button onClick={openConfig} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
          Backend verbinden
        </button>
      </div>
    )
  }

  if (!swimmer) {
    return (
      <div className="text-center py-16">
        <User size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm">Kein aktiver Schwimmer ausgewählt</p>
      </div>
    )
  }

  const notYetImported = results.filter(r => !imported.has(`${r.meetDate}-${r.eventId}`))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-xs">Suche: <span className="text-slate-300">{searchName}</span></p>
          <p className="text-slate-600 text-xs">Letzte 5 Wettkämpfe</p>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && notYetImported.length > 0 && (
            <button
              onClick={importAll}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
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
        <div className="text-center py-12 text-slate-600">
          <User size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Keine Ergebnisse gefunden</p>
          <p className="text-xs mt-1 text-slate-700">
            {!swimmer.myresultsName ? 'Tipp: Hinterlege den myresults.eu-Namen im Schwimmer-Profil' : ''}
          </p>
        </div>
      )}

      {results.map(r => {
        const key = `${r.meetDate}-${r.eventId}`
        const isImported = imported.has(key)
        return (
          <Card key={key} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{normalizeEventName(r.eventName)}</p>
                <p className="text-slate-500 text-xs">{r.meetName}</p>
                <p className="text-slate-600 text-xs">{r.meetDate} · Platz {r.result.rank}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-white font-bold text-sm">
                  {r.result.timeMs > 0 ? `${Math.floor(r.result.timeMs / 60000) > 0 ? `${Math.floor(r.result.timeMs / 60000)}:` : ''}${String(Math.floor((r.result.timeMs % 60000) / 1000)).padStart(2, '0')},${String(Math.floor((r.result.timeMs % 1000) / 10)).padStart(2, '0')}` : '—'}
                </p>
                <button
                  onClick={() => importResult(r)}
                  disabled={isImported}
                  className={`flex-shrink-0 p-2 rounded-xl transition-colors ${isImported ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
                >
                  {isImported ? <Check size={15} /> : <Download size={15} />}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function Ergebnisse() {
  const store = useContext(StoreContext)!
  const [tab, setTab] = useState<Tab>('meets')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'meets', label: 'Wettkämpfe', icon: <Trophy size={14} /> },
    { id: 'swimmer', label: 'Mein Schwimmer', icon: <User size={14} /> },
    { id: 'live', label: 'LIVE', icon: <Radio size={14} /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 pb-24">
      <div className="px-4 pt-14 pb-4 max-w-lg mx-auto">
        {store.activeSwimmer && (
          <div className="mb-4">
            <SwimmerChip swimmer={store.activeSwimmer} swimmerCount={store.swimmers.length} mode="readonly" />
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-white font-bold text-2xl">Ergebnisse</h1>
          <p className="text-slate-400 text-sm">myresults.eu · Österreichische Wettkämpfe</p>
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-800/50 p-1 rounded-xl mb-5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                tab === t.id ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === 'meets' && <WettkämpfeTab />}
        {tab === 'swimmer' && <MeinSchwimmerTab />}
        {tab === 'live' && (
          <div className="text-center py-16 text-slate-600">
            <Radio size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">LIVE-Tab wird in Task 8 hinzugefügt</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web
npm run build 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Manual UI test**

```bash
npm run dev
```

1. Open `http://localhost:5173/ergebnisse`
2. Verify 3-tab bar renders (Wettkämpfe / Mein Schwimmer / LIVE)
3. "Wettkämpfe" tab: shows "Kein Backend verbunden" with "Backend verbinden" button
4. Click "Backend verbinden" → ApiConfigModal opens
5. "Mein Schwimmer" tab: shows swimmer info or "Kein aktiver Schwimmer" message
6. SwimmerChip appears in top-left (readonly)

- [ ] **Step 4: Commit**

```bash
git add src/pages/Ergebnisse.tsx
git commit -m "feat: Ergebnisse page — Wettkämpfe and Mein Schwimmer tabs"
```

---

### Task 8: Frontend — LIVE Tab + SwimmerFormModal Extension

**Files:**
- Modify: `src/pages/Ergebnisse.tsx` (add LiveTab component)
- Modify: `src/components/SwimmerFormModal.tsx` (add myresultsName field)

**Interfaces:**
- LIVE tab: calls `GET /api/meets/:id/live?urlStatus=Today-Upcoming` every 10 seconds while mounted; shows current event + result table; "Als Zeit speichern" button on swimmer's row
- SwimmerFormModal: new optional text field for `myresultsName`; store uses existing `updateSwimmer` / `addSwimmer`

- [ ] **Step 1: Add LiveTab component to `src/pages/Ergebnisse.tsx`**

Add this component above the `Ergebnisse` function:

```tsx
function LiveTab() {
  const store = useContext(StoreContext)!
  const api = useApi()
  const { openConfig } = useContext(ApiConfigContext)
  const swimmer = store.activeSwimmer
  const [meets, setMeets] = useState<MeetSummary[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState('')
  const [liveData, setLiveData] = useState<import('../types').LiveResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!api.isConfigured) return
    api.get<MeetSummary[]>('/api/meets?status=upcoming')
      .then(data => {
        const liveMeets = data.filter(m => m.hasLive || m.status === 'today' || m.status === 'upcoming')
        setMeets(liveMeets)
        if (liveMeets.length && !selectedMeetId) setSelectedMeetId(liveMeets[0].id)
      })
      .catch(() => {})
  }, [api, selectedMeetId])

  const fetchLive = useCallback(async () => {
    if (!selectedMeetId || !api.isConfigured) return
    try {
      const data = await api.get<import('../types').LiveResult>(
        `/api/meets/${selectedMeetId}/live?urlStatus=Today-Upcoming`,
      )
      setLiveData(data)
      setLastUpdated(new Date())
    } catch { /* ignore */ }
  }, [selectedMeetId, api])

  useEffect(() => {
    if (!selectedMeetId) return
    setLoading(true)
    fetchLive().finally(() => setLoading(false))
    const interval = setInterval(fetchLive, 10000)
    return () => clearInterval(interval)
  }, [selectedMeetId, fetchLive])

  function saveTime(result: import('../types').SwimResult) {
    if (!swimmer || !liveData?.event) return
    const eventName = normalizeEventName(liveData.event)
    const today = new Date().toISOString().split('T')[0]
    store.addTime({
      id: generateId(),
      swimmerId: swimmer.id,
      event: eventName,
      course: meets.find(m => m.id === selectedMeetId)?.course ?? 'LB',
      timeMs: result.timeMs,
      date: today,
      competition: meets.find(m => m.id === selectedMeetId)?.name,
      isPersonalBest: false,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!api.isConfigured) {
    return (
      <div className="text-center py-16">
        <Wifi size={40} className="mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 text-sm mb-4">Kein Backend verbunden</p>
        <button onClick={openConfig} className="bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
          Backend verbinden
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {meets.length > 0 && (
        <select
          value={selectedMeetId}
          onChange={e => { setSelectedMeetId(e.target.value); setSaved(false) }}
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-sky-500"
        >
          {meets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
              const isSwimmer = swimmer && (
                r.name.toLowerCase().includes(swimmer.name.toLowerCase().split(' ')[0])
                || (swimmer.myresultsName && r.name.toLowerCase().includes(swimmer.myresultsName.toLowerCase().split(' ')[0]))
              )
              return (
                <Card key={r.participantId} className={`flex items-center gap-3 px-4 py-2.5 ${isSwimmer ? 'border-sky-500/40 bg-sky-500/5' : ''}`}>
                  <span className="text-slate-500 text-xs w-5 text-right">{r.rank}.</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isSwimmer ? 'text-sky-300' : 'text-white'}`}>{r.name}</p>
                    <p className="text-slate-600 text-xs">{r.club}</p>
                  </div>
                  <p className="font-mono text-white text-sm">
                    {r.timeMs > 0 ? `${Math.floor(r.timeMs / 60000) > 0 ? `${Math.floor(r.timeMs / 60000)}:` : ''}${String(Math.floor((r.timeMs % 60000) / 1000)).padStart(2, '0')},${String(Math.floor((r.timeMs % 1000) / 10)).padStart(2, '0')}` : '—'}
                  </p>
                  {isSwimmer && r.timeMs > 0 && (
                    <button
                      onClick={() => saveTime(r)}
                      disabled={saved}
                      className={`p-1.5 rounded-lg transition-colors ${saved ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-400/10'}`}
                    >
                      {saved ? <Check size={13} /> : <Download size={13} />}
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

- [ ] **Step 2: Replace the LIVE placeholder in `Ergebnisse` with `<LiveTab />`**

In the `Ergebnisse` function, replace:
```tsx
        {tab === 'live' && (
          <div className="text-center py-16 text-slate-600">
            <Radio size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">LIVE-Tab wird in Task 8 hinzugefügt</p>
          </div>
        )}
```
With:
```tsx
        {tab === 'live' && <LiveTab />}
```

Also add missing import at the top of the file (useCallback is already imported, but verify):
```tsx
import { useContext, useState, useEffect, useCallback } from 'react'
```

- [ ] **Step 3: Add `myresultsName` field to `src/components/SwimmerFormModal.tsx`**

Replace the file:

```tsx
import { useState, useEffect, useContext } from 'react'
import { Modal } from './Modal'
import { StoreContext } from '../App'
import { AVATAR_COLORS, generateId } from '../utils/format'
import type { Swimmer } from '../types'

interface SwimmerFormModalProps {
  open: boolean
  onClose: () => void
  swimmer?: Swimmer | null
}

export function SwimmerFormModal({ open, onClose, swimmer }: SwimmerFormModalProps) {
  const store = useContext(StoreContext)!
  const isEdit = !!swimmer
  const [form, setForm] = useState({
    name: '',
    birthYear: '',
    club: '',
    avatarColor: AVATAR_COLORS[0],
    myresultsName: '',
  })

  useEffect(() => {
    setForm({
      name: swimmer?.name ?? '',
      birthYear: swimmer?.birthYear?.toString() ?? '',
      club: swimmer?.club ?? '',
      avatarColor: swimmer?.avatarColor ?? AVATAR_COLORS[0],
      myresultsName: swimmer?.myresultsName ?? '',
    })
  }, [swimmer])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const year = parseInt(form.birthYear)
    const base: Swimmer = {
      id: isEdit ? swimmer!.id : generateId(),
      name: form.name,
      birthYear: year,
      club: form.club,
      avatarColor: form.avatarColor,
      myresultsName: form.myresultsName.trim() || undefined,
    }
    if (isEdit) {
      store.updateSwimmer(base)
    } else {
      store.addSwimmer(base)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Schwimmer bearbeiten' : 'Schwimmer hinzufügen'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-xs mb-1">Name *</label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. Max Muster"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Geburtsjahr *</label>
          <input
            required
            type="number"
            min={1950}
            max={new Date().getFullYear()}
            value={form.birthYear}
            onChange={e => setForm(f => ({ ...f, birthYear: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. 2012"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Verein *</label>
          <input
            required
            value={form.club}
            onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-sky-500 outline-none"
            placeholder="z.B. SV Wien"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-2">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setForm(f => ({ ...f, avatarColor: color }))}
                className={`w-8 h-8 rounded-full transition-all ${form.avatarColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">
            myresults.eu Name <span className="text-slate-600">(optional)</span>
          </label>
          <input
            value={form.myresultsName}
            onChange={e => setForm(f => ({ ...f, myresultsName: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-sky-500 outline-none"
            placeholder="NACHNAME Vorname"
          />
          <p className="text-slate-700 text-[10px] mt-1">Format von myresults.eu — leer lassen für Auto-Suche</p>
        </div>
        <button
          type="submit"
          className="w-full bg-sky-500 hover:bg-sky-400 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {isEdit ? 'Speichern' : 'Hinzufügen'}
        </button>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/hermanurban/swimtrack-web
npm run build 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Manual UI test — LIVE tab + SwimmerFormModal**

```bash
npm run dev
```

1. Open `/ergebnisse` → LIVE tab — shows meet selector and "Kein LIVE-Stream aktiv" (correct, no live meet right now)
2. Open Dashboard → tap active swimmer avatar → edit swimmer → verify "myresults.eu Name" field appears at bottom
3. Enter `MUSTER Max` as myresultsName, save → check localStorage has updated swimmer
4. Return to Ergebnisse → Mein Schwimmer → search name should now show `MUSTER MAX`

- [ ] **Step 6: Run server tests one final time**

```bash
cd /Users/hermanurban/swimtrack-web/server
npm test
```

Expected: all 13 tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/hermanurban/swimtrack-web
git add src/pages/Ergebnisse.tsx src/components/SwimmerFormModal.tsx
git commit -m "feat: LIVE tab with 10s polling and myresultsName field in swimmer form"
```

---

## Post-Implementation: pm2 Setup on Mac Mini

After all tasks are complete, run these commands on the Mac Mini to start the backend as a persistent service:

```bash
# Install pm2 globally (if not already installed)
npm install -g pm2

# Start the API server
cd /Users/hermanurban/swimtrack-web
pm2 start server/ecosystem.config.cjs

# Save pm2 process list and set up startup script
pm2 save
pm2 startup

# Verify
pm2 status
curl http://localhost:3001/health
```

Set `VITE_API_URL` in the PWA: create `server/.env` with your Mac Mini's Tailscale IP:
```
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4173,https://YOUR-TAILSCALE-HOSTNAME
```

Then in the PWA, open Ergebnisse → any tab → "Backend verbinden" → enter `http://mac-mini-tailscale-ip:3001`.
