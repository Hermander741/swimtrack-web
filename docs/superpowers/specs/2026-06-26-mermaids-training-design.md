# Mermaids App — Sub-Projekt 3a: Trainingsplan-Kern

**Date:** 2026-06-26
**Status:** Approved
**Scope:** Sub-Projekt 3a — Trainingsgruppen, Bausteine-Bibliothek, Wochenplan-Templates, Einzeltermine, Listen- & Kalenderansicht, iCal-Export

## Kontext

Sub-Projekt 1 lieferte Fundament (Auth, Rollen, Design-System). Sub-Projekt 2 lieferte Real-Time-Chat. Sub-Projekt 3a ersetzt den `/training`-Placeholder durch einen vollwertigen Trainingsplan: Trainer pflegen Gruppen, eine Bausteine-Bibliothek und wöchentliche Templates. Mitglieder sehen ihre Trainingseinheiten inklusive strukturierter Trainingsinhalte in Listen- und Kalenderansicht. Ein iCal-Feed ermöglicht Abo in Outlook, Apple Calendar und Google Calendar.

Sub-Projekt 3b (Anwesenheitserfassung, individuelle Mitglieder-Einträge, Push-Benachrichtigungen) folgt separat.

## Ziele

- Trainer verwalten Trainingsgruppen und pflegen eine wiederverwendbare Bausteine-Bibliothek
- Wöchentliche Templates pro Gruppe definieren den Regelplan
- Aus Templates werden konkrete Sessions für beliebige Datumsranges generiert
- Einzelsessions können unabhängig vom Template erstellt oder abgeändert werden (inkl. externe Termine)
- Mitglieder sehen ihre Sessions in Listen- oder Kalenderansicht mit vollständigen Trainingsinhalten
- iCal-Export (persönlicher Abo-Link) für Outlook, Apple Calendar, Google Calendar

## Tech Stack

| Schicht | Technologie |
|---|---|
| Backend | Node.js 24, Express 4, TypeScript, pg (node-postgres) |
| iCal-Generierung | `ical-generator` (RFC 5545 konform) |
| Frontend | React 19, TypeScript, bestehender Design-Stack |
| Auth | JWT (bestehend), persönlicher iCal-Token in DB |

## Datenbank-Schema (`004_training.sql`)

```sql
CREATE TABLE IF NOT EXISTS training_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#0EA5E9',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_group_members (
  group_id  UUID REFERENCES training_groups(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  added_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS training_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'sonstiges'
              CHECK (category IN ('aufwaermen','hauptset','abkuehlen','kraft','technik','sonstiges')),
  distance_m  INTEGER,
  stroke      TEXT,
  reps        INTEGER,
  rest_s      INTEGER,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID REFERENCES training_groups(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Montag … 6=Sonntag
  start_time   TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 90,
  location     TEXT,
  title        TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_template_blocks (
  template_id   UUID REFERENCES training_templates(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES training_blocks(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  override_note TEXT,
  PRIMARY KEY (template_id, position)
);

CREATE TABLE IF NOT EXISTS training_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID REFERENCES training_groups(id) ON DELETE CASCADE, -- NULL für externe Termine ohne Gruppe
  template_id  UUID REFERENCES training_templates(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 90,
  location     TEXT,
  notes        TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  is_external  BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_group ON training_sessions(group_id, date);

CREATE TABLE IF NOT EXISTS training_session_blocks (
  session_id    UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES training_blocks(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  override_note TEXT,
  PRIMARY KEY (session_id, position)
);

CREATE TABLE IF NOT EXISTS ical_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  token      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Gruppen-Zugriffskontrolle

Ein User sieht eine Trainingsgruppe und ihre Sessions wenn er Mitglied der Gruppe ist (`training_group_members`). Trainer und Admins sehen alle Gruppen und Sessions.

Externe Sessions (`is_external = true`) sind für alle sichtbar.

## API Endpoints

Alle REST-Responses: `{ ok: true, data: T }` oder `{ ok: false, error: string }`.

### Gruppen

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/groups` | JWT | Eigene Gruppen (Mitglied) oder alle (Trainer+) |
| POST | `/api/training/groups` | Trainer+ | Gruppe erstellen |
| PATCH | `/api/training/groups/:id` | Trainer+ | Name/Beschreibung/Farbe ändern |
| DELETE | `/api/training/groups/:id` | Admin | Gruppe löschen |
| POST | `/api/training/groups/:id/members` | Trainer+ | Mitglied hinzufügen |
| DELETE | `/api/training/groups/:id/members/:userId` | Trainer+ | Mitglied entfernen |

### Bausteine

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/blocks` | Trainer+ | Alle Bausteine (Bibliothek) |
| POST | `/api/training/blocks` | Trainer+ | Baustein erstellen |
| PATCH | `/api/training/blocks/:id` | Trainer+ (eigener) / Admin | Baustein bearbeiten |
| DELETE | `/api/training/blocks/:id` | Trainer+ (eigener) / Admin | Baustein löschen |

### Templates

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/templates` | Trainer+ | Alle Templates |
| POST | `/api/training/templates` | Trainer+ | Template erstellen |
| PATCH | `/api/training/templates/:id` | Trainer+ | Template bearbeiten |
| DELETE | `/api/training/templates/:id` | Admin | Template löschen |
| POST | `/api/training/templates/:id/generate` | Trainer+ | Sessions für Datumsrange generieren |

`POST /generate` Body: `{ from: "YYYY-MM-DD", to: "YYYY-MM-DD" }` — überspringt bereits existierende Sessions für Gruppe/Datum.

### Sessions

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/sessions` | JWT | Sessions in Zeitraum (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| POST | `/api/training/sessions` | Trainer+ | Manuelle Session erstellen (auch extern) |
| PATCH | `/api/training/sessions/:id` | Trainer+ | Session bearbeiten / absagen |
| DELETE | `/api/training/sessions/:id` | Admin | Session löschen |

### iCal

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/training/sessions/ical` | Token-Param (`?token=`) | RFC 5545 `.ics`-Feed (eigene Gruppen, 90 Tage) — muss vor `/:id` registriert sein |
| GET | `/api/training/ical-token` | JWT | Eigenen iCal-Token abrufen (erstellt ihn bei Bedarf) |
| POST | `/api/training/ical-token/regenerate` | JWT | Token rotieren (invalidiert alten Link) |

## Frontend-Struktur

```
src/
  api/
    training.ts              # REST-Wrapper für alle Endpunkte
  hooks/
    useTraining.ts           # Sessions/Gruppen-State, Woche/Zeitraum, View-Toggle
  pages/
    Training.tsx             # Haupt-Layout: Toggle Liste/Woche + Trainer-FAB
  components/
    training/
      WeekView.tsx           # 7-Tage-Grid, horizontal scrollbar auf Mobile
      ListView.tsx           # Chronologische Liste (diese Woche / nächste Woche / später)
      SessionCard.tsx        # Kompakte Karte: Zeit, Gruppe-Chip, Ort, Titel, Abgesagt-Badge
      SessionDetail.tsx      # Modal: vollständige Session mit Baustein-Liste
      BlockItem.tsx          # Einzelner Baustein: Kategorie-Badge, Distanz, Reps, Pause, Notiz
      TrainerPanel.tsx       # Sheet/Modal mit 4 Tabs: Übersicht, Gruppen, Bausteine, Templates
      GroupEditor.tsx        # Gruppe erstellen/bearbeiten + Mitglieder-Liste
      BlockLibrary.tsx       # Bausteine-Bibliothek: Kategorie-Filter + CRUD
      TemplateEditor.tsx     # Template erstellen/bearbeiten: Tag, Zeit, Ort, Bausteine
      SessionEditor.tsx      # Session erstellen/bearbeiten: Baustein-Auswahl aus Bibliothek
```

### Mitglieder-Ansicht (`/training`)

- **Toggle** oben: `Liste | Woche`
- **Liste:** nächste Sessions chronologisch, gruppiert nach "Diese Woche / Nächste Woche / Später"; Tap öffnet `SessionDetail`
- **Woche:** 7-Tage-Grid (Mo–So), Einheiten als farbige Chips (Gruppenfarbe), horizontaler Scroll auf Mobile; Tap öffnet `SessionDetail`
- **SessionDetail:** Titel, Datum/Zeit/Dauer, Ort, Gruppe, Abgesagt-Banner, alle Bausteine (Kategorie-Badge, Distanz, Stil, Wiederholungen, Pause, Notiz), allgemeine Session-Notizen

### Trainer-Ansicht

FAB (unten rechts) öffnet **TrainerPanel** als Bottom-Sheet mit 4 Tabs:

1. **Übersicht** — alle Sessions dieser Woche über alle Gruppen (Kompaktliste mit Gruppenfarbe)
2. **Gruppen** — Gruppen erstellen/bearbeiten, Mitglieder zuweisen
3. **Bausteine** — Bibliothek: Kategorie-Filter, Baustein erstellen/bearbeiten/löschen
4. **Templates** — Wochenpläne: pro Gruppe Wochentage/Zeiten definieren, Bausteine zuweisen, Sessions für Datumsrange generieren

### SessionEditor — Baustein-Auswahl

Bibliothek wird als filterbare Liste (Kategorie-Tabs) angezeigt. Trainer tippt Bausteine an → erscheinen als geordnete Liste unten. Reihenfolge über Auf/Ab-Pfeile änderbar. Pro Baustein optionaler `override_note` (z.B. "heute nur 5× statt 10×").

### iCal-Export

Im Profil (`/mehr` → Profil): "Kalender abonnieren" → zeigt Abo-URL zum Kopieren + Download-Button für einmalige `.ics`-Datei. Token-Rotation per Button ("Link zurücksetzen").

## Externe Termine

`is_external: true` + kein Template-Bezug. Erscheinen in Listen- und Kalenderansicht mit orangefarbenem Chip statt Gruppenfarbe. Kein Baustein-Set nötig — nur Titel, Datum, Zeit, Ort und optionale Notizen.

## iCal-Details

- Bibliothek: `ical-generator`
- Feed enthält Sessions der eigenen Gruppen für die nächsten 90 Tage
- Pro Session: `SUMMARY` = Titel, `DTSTART`/`DTEND`, `LOCATION`, `DESCRIPTION` = Bausteine als Textliste
- Content-Type: `text/calendar; charset=utf-8`
- Token ist UUID, wird beim ersten Abruf von `/api/training/ical-token` automatisch erstellt

## Sicherheit

| Punkt | Maßnahme |
|---|---|
| Gruppen-Sichtbarkeit | Mitglieder sehen nur eigene Gruppen (WHERE-Klausel mit `training_group_members`) |
| Trainer-Aktionen | Backend prüft `role IN ('trainer','admin')` auf allen schreibenden Endpunkten |
| Baustein-Bearbeitung | Backend prüft `created_by = req.user.id OR role = 'admin'` |
| iCal-Token | UUID, kein JWT nötig — Rotation invalidiert alten Token sofort |
| Template-Generate | Duplizierungsschutz per Application-Logik: `POST /generate` überspringt Gruppe/Datum-Kombinationen bei denen bereits eine Session aus diesem Template existiert |

## ENV-Variablen (neu)

Keine neuen ENV-Variablen erforderlich. `ical-generator` benötigt keine externe Konfiguration.

## Was dieses Sub-Projekt NICHT enthält

- Anwesenheitserfassung → Sub-Projekt 3b
- Individuelle Mitglieder-Einträge (eigene Trainings, Notizen zu Sessions) → Sub-Projekt 3b
- Push-Benachrichtigungen für bevorstehende Einheiten → Sub-Projekt 3b
- Wettkampftermine / msecm.at → Sub-Projekt 5
- Zeiten & myresults-Integration → Sub-Projekt 4
