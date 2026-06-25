# SwimTrack Phase 2: Backend + myresults.eu Live-Import

**Date:** 2026-06-25  
**Status:** Approved  
**Scope:** Phase 2 of 3 (Phase 1: Multi-Swimmer complete; Phase 3: Charts, FINA-Punkte, Heat Sheet)

## Context

SwimTrack is a German-language PWA for Austrian competitive swimming parents running on a Mac Mini (always on, Node.js + Tailscale already installed). Phase 2 adds a Node.js/Express backend proxy on the Mac Mini that scrapes myresults.eu and exposes a REST API consumed by the PWA over Tailscale.

### myresults.eu Technical Findings

- Server-side rendered HTML (Apache + jQuery/Bootstrap) — no public JSON API
- Results are rendered server-side on POST requests: `POST /de-AT/Meets/{status}/{meetId}/Results/{eventId}` returns HTML with results in `#starts_content`
- No headless browser needed — simple HTTP POST + cheerio HTML parsing works
- LIVE results have a JSON AJAX endpoint: `POST /ajax_liveresults.php` (polled every 1s by browser)
- Athlete search within a meet: `POST /ajax_searchmeetparticipants.php` → JSON
- No authentication or cookies required for public data
- URL patterns:
  - Meet list: `/de-AT/Meets/Today-Upcoming`, `/de-AT/Meets/Recent`
  - Meet events: `/de-AT/Meets/{status}/{meetId}/Results` (event list in `<select>`)
  - Event results: `POST /de-AT/Meets/{status}/{meetId}/Results/{eventId}`
  - Participant results: `/de-AT/Meets/{status}/{meetId}/Participant/{participantId}`
  - LIVE: `POST /ajax_liveresults.php` with `{ pathbase, path, language, meet }`

## Import Scope

- **Zeiten (SwimTime entries):** imported into existing localStorage store
- **Wettkampf-Kalender (Competition entries):** upcoming meets imported as Competition entries
- **LIVE-Tracking:** in-app real-time display during active events (Push Notifications reserved for Phase 3)

## Data Model

### Additions to `Swimmer` type (`src/types.ts`)

```ts
interface Swimmer {
  // ...existing fields unchanged...
  myresultsName?: string        // "URBAN Herman" (LASTNAME Firstname — myresults.eu format)
  myresultsMeetIds?: string[]   // meet IDs the user has linked to this swimmer
}
```

`myresultsName` is optional. If empty, the backend attempts a fuzzy match using `name` + `birthYear`. If set, it is used verbatim as the search string.

### New Shared Types (`src/types.ts` additions)

```ts
interface MeetSummary {
  id: string           // "2365"
  name: string         // "Finalwettkämpfe der Österr..."
  startDate: string    // "2026-06-27"
  endDate: string      // "2026-06-28"
  location: string     // "BSFZ Südstadt"
  status: 'upcoming' | 'today' | 'recent'
  hasLive: boolean     // whether LIVE timing is available
}

interface MeetEvent {
  id: string           // "84203"
  number: number       // 1
  name: string         // "100m Schmetterling Damen"
  session: string      // "Samstag 27.06.2026 - 1. Abschnitt"
}

interface SwimResult {
  rank: number
  name: string         // "URBAN Herman"
  birthYear: number    // 2012
  club: string         // "SV Wien"
  timeMs: number       // 63420
  participantId: string  // myresults.eu participant ID
}

interface LiveResult {
  status: number       // -1 = no live session, 0 = active
  event?: string       // "100m Freistil Damen"
  results?: SwimResult[]
}
```

## Backend Architecture (`server/`)

Located in `server/` within the existing `swimtrack-web` repo. TypeScript, compiled/run via `ts-node`.

### File Structure

```
server/
  src/
    index.ts              # Express setup, CORS, PORT from env
    routes/
      meets.ts            # GET /api/meets?status=upcoming|recent|all
                          # GET /api/meets/:id/events
      results.ts          # GET /api/meets/:id/results/:eventId
      live.ts             # GET /api/meets/:id/live
      swimmer.ts          # GET /api/swimmer/search?meetId=&name=
                          # GET /api/swimmer/results?name=&birthYear=
    scrapers/
      meetList.ts         # Parses /de-AT/Meets/Today-Upcoming + /Recent
      eventList.ts        # Parses event <select> from Results page
      resultTable.ts      # Parses #starts_content → SwimResult[]
      liveResults.ts      # Calls ajax_liveresults.php
      search.ts           # Calls ajax_searchmeetparticipants.php
    cache.ts              # In-memory TTL cache
    httpClient.ts         # axios instance with User-Agent + timeout
  package.json
  tsconfig.json
  ecosystem.config.cjs    # pm2 configuration
  .env.example            # PORT, ALLOWED_ORIGINS
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meets?status=upcoming\|recent\|all` | Meet list from myresults.eu (`all` = upcoming + recent combined) |
| GET | `/api/meets/:id/events` | Event list for a meet |
| GET | `/api/meets/:id/results/:eventId` | Parsed results for one event |
| GET | `/api/meets/:id/live` | Live results (polls ajax_liveresults.php) |
| GET | `/api/swimmer/search?meetId=&name=` | Athlete search within a meet |
| GET | `/api/swimmer/results?name=&birthYear=` | Auto-search across recent meets |

All endpoints return `{ ok: true, data: ... }` on success and `{ ok: false, error: string }` on failure.

### Cache TTLs

| Data | TTL |
|------|-----|
| Meet list | 5 minutes |
| Event list | 10 minutes |
| Results table | 2 minutes |
| Live results | 10 seconds |
| Athlete search | 1 minute |

### CORS & Access

- Server runs on port `3001` (configurable via `PORT` in `.env`)
- CORS restricted to `localhost` + configured Tailscale origins via `ALLOWED_ORIGINS` env var
- Frontend accesses backend via `VITE_API_URL` (e.g., `http://100.x.x.x:3001`) stored in `.env.local`

### pm2 Configuration

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'swimtrack-api',
    script: 'src/index.ts',
    interpreter: 'ts-node',
    cwd: './server',
    watch: false,
    env: { PORT: 3001, NODE_ENV: 'production' }
  }]
}
```

Auto-starts on Mac Mini reboot via `pm2 startup`.

## Frontend Changes

### `src/types.ts`
Add `MeetSummary`, `MeetEvent`, `SwimResult`, `LiveResult` types and extend `Swimmer` with `myresultsName?` and `myresultsMeetIds?`.

### `src/hooks/useApi.ts` (new)
Thin wrapper around `fetch` that reads `VITE_API_URL` from env and handles error responses.

```ts
export function useApi() {
  const base = import.meta.env.VITE_API_URL ?? ''
  async function get<T>(path: string): Promise<T>
  // throws on non-ok responses; caller handles via try/catch
  return { get }
}
```

### `src/pages/Ergebnisse.tsx` (replaces existing empty page)

Three tabs:

**Tab 1 — Wettkämpfe**
- Meet list from `/api/meets?status=all`
- Search field (filters locally)
- Each meet row: name, date, location, badge for LIVE/upcoming/recent
- Tap → opens meet detail with event list + results per event
- "In Kalender" button → imports as `Competition` entry via `store.addCompetition`

**Tab 2 — Mein Schwimmer**
- Automatically searches the last 5 recent meets for the active swimmer by name + birth year
- Shows found results grouped by meet
- "Importieren" button per result → `store.addTime` with duplicate guard (`event + date + timeMs`)
- "Alle importieren" bulk action
- Empty state: "Kein myresults.eu Name hinterlegt" → link to swimmer settings

**Tab 3 — LIVE**
- Dropdown to select a meet with `hasLive: true`
- Polls `GET /api/meets/:id/live` every 10 seconds via `setInterval` (cleared on unmount)
- Shows current event name + live result table
- "Als Zeit speichern" button appears next to the active swimmer's result row
- Shows last-updated timestamp; stops polling if `status === -1`

### `src/components/SwimmerFormModal.tsx` (modified)
Add optional `myresultsName` field at the bottom of the form:
```
myresults.eu Name (optional):
[URBAN Herman                  ]
 Format: NACHNAME Vorname
```

### `src/components/ApiConfigModal.tsx` (new)
Shown on first launch if `VITE_API_URL` is not set, or via settings icon. Single input for the backend URL. Tests connection with `GET /api/meets?status=upcoming&limit=1`. Shows green checkmark or red error. Saves to localStorage as `swimtrack_api_url` (overrides env at runtime).

## Import Duplicate Guard

Before calling `store.addTime`, the frontend checks:
```ts
const isDuplicate = store.times.some(t =>
  t.swimmerId === activeSwimmer.id &&
  t.event === result.event &&
  t.date === result.date &&
  t.timeMs === result.timeMs
)
```
Duplicates are silently skipped; the import button shows "Bereits importiert" (greyed out).

## Error Handling

- Backend unreachable → `Ergebnisse` page shows "Backend nicht erreichbar — prüfe die Verbindung zu deinem Mac Mini" with a "Einstellungen" link
- myresults.eu unreachable → backend returns `{ ok: false, error: 'myresults.eu nicht erreichbar' }`
- No results found for swimmer → empty state with hint to set `myresultsName`

## What This Phase Explicitly Excludes

- Push notifications (reserved for Phase 3)
- Authentication / user accounts
- ÖSV as a data source (myresults.eu covers Austrian meets; ÖSV rankings use same data)
- Persistent result cache / SQLite (in-memory cache only; can be added later)
- Start lists / heat sheets (Phase 3)

## Roadmap

- **Phase 3:** Time progression charts, World Aquatics point calculation, competition heat sheet / start list, Push Notifications
