# Mermaids App — Sub-Projekt 4: Zeiten & myresults-Integration

**Date:** 2026-06-28
**Status:** Approved
**Scope:** Sub-Projekt 4 — Vereins-Zeitenliste, persönliche Zeiten-Verwaltung, myresults.eu-Import in Backend-DB, zusammengeführte Zeiten+Ergebnisse-Seite

## Kontext

Sub-Projekt 3b lieferte Anwesenheitserfassung, Einträge und Push-Benachrichtigungen. Sub-Projekt 4 ersetzt die bestehende localStorage-basierte `Zeiten.tsx` und `Ergebnisse.tsx` durch eine einzige, backend-gestützte Seite auf Basis von PostgreSQL und JWT-Auth. Der `StoreContext`-Tech-Debt in diesen zwei Seiten wird vollständig aufgeräumt.

## Was dieses Sub-Projekt NICHT enthält

- Wettkampf-Management (Anmeldung, Startlisten) → Sub-Projekt 5
- Statistiken / Progressions-Charts → evtl. Sub-Projekt 6
- Push-Benachrichtigungen für neue Bestzeiten
- Öffentliche Vereins-Rangliste (nicht eingeloggter Zugriff)

## Kanonische Disziplin-Liste (SWIM_EVENTS)

`event` ist kein Freitext — nur Werte aus der kanonischen Liste sind gültig. Die Liste ist in `src/utils/format.ts` als `SWIM_EVENTS` definiert und wird **auch serverseitig** in `server/src/constants/swimEvents.ts` gespiegelt:

```typescript
export const SWIM_EVENTS = [
  '50m Freistil', '100m Freistil', '200m Freistil', '400m Freistil', '800m Freistil', '1500m Freistil',
  '50m Rücken', '100m Rücken', '200m Rücken',
  '50m Brust', '100m Brust', '200m Brust',
  '50m Schmetterling', '100m Schmetterling', '200m Schmetterling',
  '100m Lagen', '200m Lagen', '400m Lagen',
]
```

`100m Lagen` ist kein offizieller Wettkampf-Einzelstart, bleibt aber in der Liste für **Trainingszeiten** (z.B. Testsatz im Training).

`GET /api/zeiten/events` liefert diese Liste — Frontend befüllt Dropdowns daraus. `POST` und `PATCH` validieren `event` gegen die Liste → 400 wenn ungültig. Kein DB-Enum (leicht erweiterbar ohne Migration).

## Zeit-Format & Parsing

Frontend-Eingabe: `1:03,42` (Minuten:Sekunden,Hundertstel) oder `63,42` (nur Sekunden) oder `63.42` (Punkt statt Komma). Die bestehende Funktion `parseTimeInput()` in `src/utils/format.ts` handhabt alle drei Formate und liefert Millisekunden oder `null` bei ungültigem Format:

```
"1:03,42" → 63_420 ms
"63,42"   → 63_420 ms
"63.42"   → 63_420 ms
"abc"     → null (ungültig)
```

Backend validiert: `time_ms` muss positiver Integer sein (`time_ms > 0 && Number.isInteger(time_ms)`). Frontend zeigt Fehlermeldung `"Format: 1:03,42 oder 63,42"` wenn `parseTimeInput()` null liefert.

## Datenbank-Schema (`006_zeiten.sql`)

```sql
-- Persönliche Schwimmzeiten aller Vereinsmitglieder
CREATE TABLE IF NOT EXISTS swim_times (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,   -- validiert gegen SWIM_EVENTS-Liste (API-Ebene, kein DB-Enum)
  course       TEXT NOT NULL CHECK (course IN ('LB', 'KB', 'OW')),
  time_ms      INTEGER NOT NULL,
  date         DATE NOT NULL,
  competition  TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_swim_times_user_event_course ON swim_times(user_id, event, course);

-- myresults.eu-Suchname pro Nutzer (z.B. "URBAN Herman")
ALTER TABLE users ADD COLUMN IF NOT EXISTS myresults_name TEXT;
```

`is_personal_best` wird **nicht gespeichert** — immer on-the-fly berechnet (`MIN(time_ms) GROUP BY user_id, event, course`). Kein Sync-Problem möglich.

`course`-Werte: `'LB'` (Langbahn 50m), `'KB'` (Kurzbahn 25m), `'OW'` (Open Water).

## Zugriffskontrolle

| Aktion | Mitglied | Trainer | Admin |
|---|---|---|---|
| Alle Zeiten lesen | Ja | Ja | Ja |
| Eigene Zeit eintragen | Ja | Ja | Ja |
| Eigene Zeit bearbeiten | Ja | Ja | Ja |
| Eigene Zeit löschen | Ja | Ja | Ja |
| Fremde Zeit eintragen | Nein | Ja | Ja |
| Fremde Zeit bearbeiten | Nein | Ja | Ja |
| Fremde Zeit löschen | Nein | Ja | Ja |

## API-Endpunkte

Alle unter `/api/zeiten`, alle erfordern JWT-Auth.

Alle REST-Responses: `{ ok: true, data: T }` oder `{ ok: false, error: string }`.

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/api/zeiten` | JWT | Zeiten mit Filtern + Pagination, inkl. `is_pb` |
| `GET` | `/api/zeiten/bestzeiten` | JWT | Nur PBs pro User/Event/Course (klein, für Bestzeiten-Tab) |
| `GET` | `/api/zeiten/events` | JWT | Kanonische Disziplin-Liste (`SWIM_EVENTS`) |
| `POST` | `/api/zeiten` | JWT | Zeit eintragen; Trainer/Admin dürfen `user_id` setzen |
| `PATCH` | `/api/zeiten/:id` | JWT | Zeit bearbeiten (alle Felder optional); eigene für alle, fremde nur Trainer/Admin |
| `DELETE` | `/api/zeiten/:id` | JWT | Zeit löschen; eigene für alle, fremde nur Trainer/Admin |

### GET /api/zeiten/events

Response: `string[]` — die kanonische `SWIM_EVENTS`-Liste. Kein Auth-Overhead nötig für Caching, aber JWT trotzdem erforderlich (konsistent mit anderen Endpunkten).

### GET /api/zeiten/bestzeiten

Gibt nur die jeweils beste Zeit pro User/Event/Course zurück — weit kleiner als alle Zeiten. Wird vom **Bestzeiten-Tab** verwendet.

Response: `SwimTimeEntry[]` (immer `is_pb: true`)

```sql
SELECT DISTINCT ON (st.user_id, st.event, st.course)
  st.id, st.user_id, u.name AS user_name,
  st.event, st.course, st.time_ms, st.date, st.competition, st.created_by, st.created_at,
  true AS is_pb
FROM swim_times st
JOIN users u ON u.id = st.user_id
ORDER BY st.user_id, st.event, st.course, st.time_ms ASC
```

### GET /api/zeiten

**Für Meine-Zeiten-Tab** (eigene Zeiten chronologisch) und Trainer-Übersichten.

**Optionale Query-Parameter** (alle kombinierbar):
- `?user_id=<uuid>` — nur Zeiten dieses Users
- `?event=<string>` — nur diese Disziplin
- `?course=LB|KB|OW` — nur diese Bahn
- `?limit=<n>` — Anzahl Einträge (default: 100, max: 500)
- `?offset=<n>` — Offset für Pagination (default: 0)

Beispiel: `GET /api/zeiten?user_id=<me>&event=100m+Freistil&limit=100&offset=0`

Response: `{ data: SwimTimeEntry[], total: number }` — `total` für Pagination-Anzeige.

```typescript
interface SwimTimeEntry {
  id: string
  user_id: string
  user_name: string
  event: string
  course: 'LB' | 'KB' | 'OW'
  time_ms: number
  date: string          // ISO date "YYYY-MM-DD"
  competition: string | null
  created_by: string | null
  created_at: string
  is_pb: boolean        // true wenn MIN(time_ms) für diesen user/event/course
}
```

**WICHTIG — `is_pb` muss per CTE berechnet werden, BEVOR die WHERE-Filter angewendet werden.** Sonst würde `is_pb` nur gegen die gefilterten Einträge stimmen statt gegen alle Zeiten des Users für diesen Event/Course:

```sql
WITH times_with_pb AS (
  SELECT st.*,
    u.name AS user_name,
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
```

`total_count` aus dem Window wird serverseitig ausgelesen und als `total` im Response mitgegeben.

### POST /api/zeiten

Body: `{ user_id?: string, event: string, course: 'LB'|'KB'|'OW', time_ms: number, date: string, competition?: string }`

- `user_id` fehlt → eigene `req.user!.id`
- `user_id` gesetzt und nicht eigene ID → 403 wenn `role === 'mitglied'`
- Validierung: `event` in `SWIM_EVENTS` → 400 sonst; `time_ms > 0 && Number.isInteger(time_ms)` → 400 sonst; `course` in `('LB','KB','OW')` → 400 sonst; `date` vorhanden → 400 sonst
- Response: eingefügter `SwimTimeEntry`

### PATCH /api/zeiten/:id

Body: `{ event?, course?, time_ms?, date?, competition? }` — alle Felder optional.

- Eigene Zeit: immer erlaubt
- Fremde Zeit: 403 wenn `role === 'mitglied'`
- 404 wenn Zeit nicht gefunden
- Validierung: falls `event` gesetzt → muss in `SWIM_EVENTS` sein; falls `time_ms` gesetzt → `> 0 && Number.isInteger`; falls `course` gesetzt → in `('LB','KB','OW')`
- Response: aktualisierter `SwimTimeEntry`

### DELETE /api/zeiten/:id

- Eigene Zeit: immer erlaubt
- Fremde Zeit: 403 wenn `role === 'mitglied'`
- 404 wenn Zeit nicht gefunden
- Response: `null`

### PATCH /api/users/me (Erweiterung bestehend)

Bestehender Endpunkt bekommt `myresults_name?: string` als zusätzlich erlaubtes Feld.

## Frontend

### Navigation

`Ergebnisse` aus der Bottom-Nav entfernen. `Zeiten` bleibt erhalten. `Ergebnisse.tsx` und das alte `Zeiten.tsx` werden durch eine neue `Zeiten.tsx` ersetzt.

### Seite: Zeiten (4 Tabs)

#### Tab 1: Bestzeiten

Zwei umschaltbare Ansichten (Toggle-Buttons oben):

**Ranking-Ansicht:**
- Dropdown: Disziplin wählen (aus `GET /api/zeiten/events`)
- Dropdown: Bahn (LB / KB / OW / Alle)
- Tabelle: Rang · Name · Zeit · Datum · Wettkampf
- Sortiert nach `time_ms` aufsteigend (schnellste zuerst)
- Eigener Eintrag hervorgehoben (teal)

**Mitglieder-Ansicht:**
- Pro Mitglied eine Karte: Avatar-Farbe · Name
- Karte aufklappbar: alle Bestzeiten des Mitglieds (je event+course)
- Sortiert: alphabetisch nach Name

Beide Ansichten verwenden `GET /api/zeiten/bestzeiten` (keine Pagination nötig, da nur eine Zeit pro User/Event/Course).

#### Tab 2: Meine Zeiten

- Eigene Zeiten chronologisch (neueste zuerst) via `GET /api/zeiten?user_id=<me>&limit=100&offset=0`
- Filter: Disziplin / Bahn (nutzen Query-Params, kein Client-Side-Filter)
- Pagination: „Mehr laden"-Button wenn `offset + limit < total`
- Jeder Eintrag zeigt: Zeit (PB-Indikator wenn `is_pb`) · Disziplin · Bahn · Datum · Wettkampf
- **Eintragen:** FAB (+) öffnet Formular: Disziplin (Dropdown aus `SWIM_EVENTS`), Bahn (LB/KB/OW), Zeit (Texteingabe, Format `1:03,42` oder `63,42`; `parseTimeInput()` → 400-Fehlermeldung wenn `null`), Datum, Wettkampf (optional)
- **Bearbeiten:** Bleistift-Icon → Inline-Edit-Formular → `PATCH /api/zeiten/:id`
- **Löschen:** Trash-Icon (mit Bestätigung)

Trainer/Admin sehen zusätzlich einen Mitglieder-Selektor (Dropdown) um Zeiten für andere einzutragen/zu bearbeiten.

#### Tab 3: Wettkämpfe

Unverändert aus `Ergebnisse.tsx` übernommen (`WettkämpfeTab` + `MeinSchwimmerTab`).

**Änderung im `MeinSchwimmerTab`:** Import-Button schreibt via `POST /api/zeiten` in die DB statt in den `StoreContext`. `myresults_name` kommt aus `user.myresults_name` (neues Profilfeld) statt aus `swimmer.myresultsName`.

#### Tab 4: LIVE

Unverändert aus `Ergebnisse.tsx` übernommen. Kein StoreContext mehr — Import via `POST /api/zeiten`.

### Profil-Erweiterung

In `Profil.tsx` neben der iCal-Sektion: neues Eingabefeld `myresults_name` (Text, optional). Speichert via `PATCH /api/users/me`. Hinweistext: „Format wie auf myresults.eu, z.B. MUSTERMANN Max".

### StoreContext-Bereinigung

`Zeiten.tsx` und `Ergebnisse.tsx`: alle `StoreContext`-Imports und -Verwendungen entfernt. Keine Abhängigkeit auf `store.times`, `store.addTime`, `store.removeTime`, `store.activeSwimmer` mehr.

## Neue Dateien

```
server/
  src/
    db/migrations/006_zeiten.sql
    constants/swimEvents.ts    # kanonische SWIM_EVENTS-Liste (gespiegelt von src/utils/format.ts)
    routes/zeiten.ts           # zeitenRouter
  test/
    zeiten.test.ts

src/
  pages/Zeiten.tsx             # Ersetzt altes Zeiten.tsx + Ergebnisse.tsx
  api/zeiten.ts                # API-Wrapper-Funktionen
  types/index.ts               # +SwimTimeEntry
```

## Geänderte Dateien

```
server/
  src/
    app.ts (oder index.ts)     # zeitenRouter einbinden
    routes/users.ts            # PATCH /me: myresults_name erlauben

src/
  App.tsx                      # Ergebnisse-Route entfernen, Zeiten-Route anpassen
  pages/Profil.tsx             # myresults_name Eingabefeld
  types/index.ts               # +SwimTimeEntry, User +myresults_name
```

## Gelöschte Dateien

```
src/pages/Ergebnisse.tsx       # Vollständig in neues Zeiten.tsx integriert
```

## Sicherheit

| Punkt | Maßnahme |
|---|---|
| Fremde Zeiten schreiben | `user_id` im Body gegen `req.user!.id` geprüft; 403 für Mitglied |
| Fremde Zeiten bearbeiten/löschen | Ownership-Check: `user_id = req.user!.id OR role IN ('trainer','admin')` |
| `myresults_name` | Nur eigenes Profil via `PATCH /api/users/me` |
