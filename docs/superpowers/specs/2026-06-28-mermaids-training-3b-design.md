# Mermaids App — Sub-Projekt 3b: Anwesenheit, Einträge & Push

**Date:** 2026-06-28
**Status:** Approved
**Scope:** Sub-Projekt 3b — Anwesenheitserfassung, individuelle Mitglieder-Einträge, Push-Benachrichtigungen für bevorstehende Einheiten

## Kontext

Sub-Projekt 3a lieferte den Trainingsplan-Kern (Gruppen, Bausteine, Templates, Sessions, iCal). Sub-Projekt 3b erweitert bestehende Sessions um drei Funktionen:

1. **Anwesenheitserfassung** — Trainer/Admin markiert nachträglich wer bei einer Session anwesend war. Jederzeit änderbar.
2. **Individuelle Mitglieder-Einträge** — Mitglieder hinterlassen nach einer Einheit eine persönliche Notiz, tatsächlich geschwommene Distanz und eine 1–3-Sterne-Bewertung.
3. **Push-Benachrichtigungen** — Erinnerung 1 Stunde vor einer Trainingseinheit. Server-seitiger `node-cron` (einmal pro Minute), kein externes Tool.

## Was dieses Sub-Projekt NICHT enthält

- Push-Einstellungen pro Nutzer (Vorlaufzeit wählbar) → evtl. 3c
- Statistiken / Auswertungen über Anwesenheit → evtl. 3c
- Wettkampftermine → Sub-Projekt 5
- Zeiten & myresults-Integration → Sub-Projekt 4

## Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | bestehender Express-Stack, `node-cron` (neu), `web-push` (vorhanden) |
| Push | `push_subscriptions`-Tabelle (vorhanden), `pushNotify.ts`-Pattern (vorhanden) |
| Frontend | React 19, Tailwind CSS dark ocean, lucide-react |

## Datenbank-Schema (`005_training_3b.sql`)

```sql
-- Anwesenheitserfassung: Trainer markiert wer bei einer Session war
CREATE TABLE IF NOT EXISTS session_attendance (
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- Mitglieder-Einträge: persönliche Notiz + Distanz + 1–3-Sterne-Bewertung
-- 1 Eintrag pro Nutzer pro Session (UPSERT)
CREATE TABLE IF NOT EXISTS session_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  note         TEXT,
  distance_m   INTEGER,
  duration_min INTEGER,
  rating       SMALLINT CHECK (rating BETWEEN 1 AND 3),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- De-Duplikations-Schutz: verhindert doppelte Push-Benachrichtigungen
CREATE TABLE IF NOT EXISTS training_push_sent (
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
```

## Gruppen-Zugriffskontrolle

| Feature | Mitglied | Trainer | Admin |
|---|---|---|---|
| Anwesenheit lesen | Nur eigene | Alle der Gruppe | Alle |
| Anwesenheit setzen | Nein | Ja | Ja |
| Eigenen Eintrag lesen/schreiben | Ja | Ja | Ja |
| Fremde Einträge lesen | Nein | Nein | Nein |
| Push-Erinnerungen empfangen | Ja (eigene Gruppen) | Ja (alle) | Ja (alle) |

## API-Endpunkte

Alle unter `/api/training/sessions/:id/` — in den bestehenden `sessionsRouter` eingehängt.

Alle REST-Responses: `{ ok: true, data: T }` oder `{ ok: false, error: string }`.

### Anwesenheit

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/sessions/:id/attendance` | JWT | Trainer+: `{ attendance: userId[] }`; Mitglied: `{ present: boolean }` |
| POST | `/api/training/sessions/:id/attendance/:userId` | Trainer+ | Mitglied als anwesend markieren (idempotent) |
| DELETE | `/api/training/sessions/:id/attendance/:userId` | Trainer+ | Anwesenheit entfernen |

- `GET` für Trainer/Admin gibt Array aller `user_id` die als anwesend markiert sind
- `GET` für Mitglied gibt nur `{ present: boolean }` für die eigene `user_id`
- Trainer kann für jede `user_id` in der Gruppe markieren, nicht für Externe
- `POST` ist idempotent: ON CONFLICT DO NOTHING

### Mitglieder-Einträge

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/sessions/:id/entry` | JWT | Eigenen Eintrag abrufen (`null` wenn keiner) |
| PUT | `/api/training/sessions/:id/entry` | JWT | Eigenen Eintrag erstellen oder aktualisieren (Upsert) |
| DELETE | `/api/training/sessions/:id/entry` | JWT | Eigenen Eintrag löschen |

`PUT` Body: `{ note?: string, distance_m?: number, duration_min?: number, rating?: 1 | 2 | 3 }` — alle Felder optional. Leerer PUT (alle null/undefined) ist gültig.

`PUT` Response: vollständiger Eintrag mit `id, session_id, user_id, note, distance_m, duration_min, rating, created_at, updated_at`.

## Push-Benachrichtigungen

### Architektur

- `node-cron` läuft im selben Prozess wie der Express-Server, gestartet in `server/src/index.ts`
- Cron-Ausdruck: `'* * * * *'` (jede Minute)
- Neues Utility: `server/src/utils/trainingPushCron.ts`

### Logik pro Cron-Tick

```
1. Query: alle nicht-abgesagten Sessions die in 55–65 Minuten starten
   (Timezone: Europe/Vienna)
2. Für jede solche Session:
   a. Bestimme Ziel-Nutzer:
      - Reguläre Session (group_id): Mitglieder der Gruppe (training_group_members)
        + alle Trainer/Admins
      - Externe Session (is_external = true): ALLE Nutzer
   b. Filter: Nutzer mit push_subscriptions die noch kein Eintrag in
      training_push_sent haben (session_id + user_id Kombination)
   c. Sende Push (web-push, Promise.allSettled wie in pushNotify.ts)
   d. INSERT INTO training_push_sent (session_id, user_id) ... ON CONFLICT DO NOTHING
```

### Push-Payload

```json
{
  "title": "Mermaids Training",
  "body": "Training beginnt in 1 Stunde: [Titel]",
  "icon": "/mermaids-logo.svg",
  "badge": "/mermaids-logo.svg",
  "data": { "sessionId": "...", "url": "/training" }
}
```

Der bestehende Service Worker (`public/sw.js`) leitet Tap-Events bereits auf `/training` weiter.

### Timezone-Berechnung (PostgreSQL)

```sql
SELECT ts.id, ts.title, ts.group_id, ts.is_external
FROM training_sessions ts
WHERE ts.is_cancelled = false
  AND (ts.date + ts.start_time) AT TIME ZONE 'Europe/Vienna'
      BETWEEN (now() AT TIME ZONE 'Europe/Vienna' + INTERVAL '55 minutes')
          AND (now() AT TIME ZONE 'Europe/Vienna' + INTERVAL '65 minutes')
  AND ts.id NOT IN (
    SELECT DISTINCT session_id FROM training_push_sent
    WHERE user_id = ANY($1::uuid[])
  )
```

## Frontend-Änderungen

Nur `SessionDetail.tsx` wird erweitert — keine neuen Seiten oder Routen.

### Anwesenheits-Sektion (Trainer/Admin, nach den Bausteinen)

```
┌─ ANWESENHEIT ────────────────────────────────┐
│  ☑ Anna Muster                               │
│  ☐ Max Mustermann                            │
│  ☑ Lisa Leitner                              │
└──────────────────────────────────────────────┘
```

- Sichtbar nur für `role === 'trainer' | 'admin'`
- Lädt beim Öffnen: `GET /attendance` → markierte `user_id[]`
- Lädt Gruppenmitglieder: aus `session.group_id` via `listGroupMembers()`
- Klick togglet einzelne Einträge via `POST/DELETE /attendance/:userId`
- Kein "Speichern"-Button — optimistisches UI mit sofortigem API-Call

### Mitglieder-Eintrag-Sektion (alle Nutzer, unterhalb der Anwesenheit)

```
┌─ MEIN EINTRAG ───────────────────────────────┐
│  Bewertung:  👎  😐  👍                       │
│  Distanz:    [____] m                        │
│  Notiz:      [________________________]      │
│                              [Speichern]     │
└──────────────────────────────────────────────┘
```

- Sichtbar für alle eingeloggten Nutzer
- Kein Zeitlimit (nicht nur für vergangene Sessions)
- Lädt beim Öffnen: `GET /entry` → vorhandener Eintrag oder `null`
- "Speichern" ruft `PUT /entry` auf (Upsert)
- Löschen-Icon wenn Eintrag vorhanden

## Neue Dateien

```
server/
  src/
    db/migrations/005_training_3b.sql
    routes/training/attendance.ts    # attendanceRouter
    routes/training/entries.ts       # entriesRouter
    utils/trainingPushCron.ts        # startTrainingPushCron()
  test/
    training-attendance.test.ts
    training-entries.test.ts

src/
  api/training.ts                    # +6 neue Funktionen (attendance + entry)
  types/index.ts                     # +SessionAttendance, SessionEntry
```

## Geänderte Dateien

```
server/
  src/
    routes/training/index.ts         # attendanceRouter + entriesRouter einbinden
    index.ts                         # startTrainingPushCron() aufrufen
  package.json                       # node-cron hinzufügen

src/
  components/training/SessionDetail.tsx  # Attendance + Entry Sektionen
```

## Sicherheit

| Punkt | Maßnahme |
|---|---|
| Attendance schreiben | `requireAuth(['admin', 'trainer'])` |
| Attendance lesen (fremde) | Backend gibt Trainer alle, Mitglied nur eigene `present: boolean` |
| Entry schreiben | JWT, `user_id = req.user!.id` — kein Fremdschreiben möglich |
| Push-Duplikat | `training_push_sent` mit Primary Key (session_id, user_id) |
| Cron-Sicherheit | Kein HTTP-Endpunkt, kein Zugriff von außen |
