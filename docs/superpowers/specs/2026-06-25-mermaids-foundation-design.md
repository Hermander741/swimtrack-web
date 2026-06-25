# Mermaids App — Sub-Projekt 1: Foundation

**Date:** 2026-06-25
**Status:** Approved
**Scope:** Sub-Projekt 1 von 5 — Authentifizierung, Benutzerverwaltung, Dokumentenverwaltung, Design-System

## Kontext

Die bestehende SwimTrack Austria App ist eine localStorage-basierte Single-User-PWA. Die neue **Mermaids App** ist eine Multi-User-Vereinsplattform für einen österreichischen Schwimmverein. Sub-Projekt 1 legt das Fundament: Server-seitige Datenbank, Auth, Rollen, E-Mail-Einladungen, Dokumentenverwaltung und das neue Premium-Design-System.

Die bestehende Codebasis (React 19 + TypeScript + Vite + Tailwind v4) wird als Basis behalten, aber vollständig neu strukturiert. Der bestehende localStorage-Store entfällt; alle Daten kommen vom neuen Backend.

## Ziele

- Mitglieder können sich über einen Einladungslink registrieren
- Rollen steuern Berechtigungen (Admin, Trainer, Eltern, Mitglied)
- Dokumente (PDFs, Formulare) können hochgeladen und heruntergeladen werden
- Das Design-System definiert das "Apple iPhone App"-Feeling für alle weiteren Sub-Projekte

## Tech Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS v4 |
| Backend | Node.js v24, Express 4, TypeScript via ts-node |
| Datenbank | PostgreSQL (auf hotdomeins.at VPS) |
| ORM | `pg` (node-postgres, kein ORM-Overhead) |
| Auth | JWT — Access Token (15min) + Refresh Token (30 Tage, httpOnly Cookie) |
| E-Mail | Nodemailer (SMTP via hotdomeins.at oder Gmail SMTP) |
| Dateien | Multer + lokales Filesystem auf dem Server (`/uploads/`) |
| PWA | Vite PWA Plugin (bestehend) |

## Architektur-Überblick

```
Browser (PWA)
    ↕ HTTPS + JSON
Express API (hotdomeins.at, Port 3001)
    ↕ SQL
PostgreSQL (gleicher Server)
    + /uploads/ (Dateisystem)
```

Frontend und Backend laufen auf demselben Server. Das Frontend wird via `npm run build` gebaut und als statische Dateien von Nginx oder Apache ausgeliefert. Das Backend läuft als pm2-Prozess.

## Datenbank-Schema

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','trainer','eltern','mitglied')),
  password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#0EA5E9',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','trainer','eltern','mitglied')),
  token       TEXT UNIQUE NOT NULL,
  invited_by  UUID REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('anmeldeformular','vereinsdokument','sonstiges')),
  filename    TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API Endpoints

Alle Responses: `{ ok: true, data: T }` oder `{ ok: false, error: string }`.

### Auth
| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| POST | `/api/auth/login` | — | E-Mail + Passwort → Access Token + setzt Refresh Cookie |
| POST | `/api/auth/refresh` | Cookie | Refresh Token → neuer Access Token |
| POST | `/api/auth/logout` | — | Löscht Refresh Cookie |
| GET | `/api/auth/me` | JWT | Gibt eigenes User-Objekt zurück |

### Einladungen
| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| POST | `/api/invitations` | Admin/Trainer | Einladung erstellen + E-Mail senden |
| GET | `/api/invitations/:token` | — | Token prüfen (existiert + nicht abgelaufen) |
| POST | `/api/invitations/:token/accept` | — | Name + Passwort → Account erstellen |

### Mitglieder
| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/users` | Admin/Trainer | Alle Mitglieder mit Rolle |
| PATCH | `/api/users/:id/role` | Admin | Rolle ändern |
| DELETE | `/api/users/:id` | Admin | Mitglied entfernen |
| PATCH | `/api/users/me` | JWT | Eigenes Profil (Name, Passwort) bearbeiten |

### Dokumente
| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/documents` | JWT | Alle Dokumente (gefiltert nach Kategorie) |
| POST | `/api/documents` | Admin/Trainer | PDF hochladen (multipart/form-data) |
| GET | `/api/documents/:id/file` | JWT | Datei herunterladen |
| DELETE | `/api/documents/:id` | Admin/Trainer | Dokument löschen |

## Frontend-Struktur

```
src/
  api/          # fetch-Wrapper mit JWT-Interceptor + Auto-Refresh
    client.ts
    auth.ts
    users.ts
    documents.ts
  components/
    ui/          # Design-System-Primitives
      Button.tsx
      Card.tsx
      Input.tsx
      Modal.tsx
      Avatar.tsx
      Badge.tsx
    layout/
      BottomNav.tsx
      TopBar.tsx
      PageShell.tsx
  pages/
    Login.tsx
    Register.tsx   # via Einladungslink
    Dashboard.tsx
    Mitglieder.tsx
    Dokumente.tsx
    Profil.tsx
    Placeholder.tsx  # für Chat, Training, Zeiten (kommen in späteren Sub-Projekten)
  hooks/
    useAuth.ts     # AuthContext: currentUser, login, logout, isAdmin, isTrainer
    useApi.ts      # bestehend, angepasst für neue Endpoints
  store/
    # entfällt — kein localStorage-Store mehr
  types/
    index.ts       # User, Invitation, Document, Role
```

## Design-System

### Farb-Palette
```ts
// Tailwind CSS v4 custom theme
--color-ocean-950: #050D1A  // Haupthintergrund
--color-ocean-900: #0A1628  // Card-Hintergrund
--color-ocean-800: #0F2040  // Border, Subtles
--color-teal-500:  #14B8A6  // Primär-Akzent
--color-teal-400:  #2DD4BF  // Hover-Akzent
--color-sky-500:   #0EA5E9  // Sekundär-Akzent
--color-white:     #FFFFFF
--color-slate-400: #94A3B8  // Subtiler Text
--color-slate-600: #475569  // Placeholder
```

### Design-Prinzipien
- **Glassmorphism Cards:** `background: rgba(255,255,255,0.05)`, `backdrop-filter: blur(20px)`, Border `rgba(255,255,255,0.08)`
- **Typografie:** `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display'` — systemnahe Schrift
- **Spacing:** 4px-Grid, großzügige Padding (16/24/32px)
- **Radii:** 16px für Cards, 12px für Buttons, 24px für Modals
- **Schatten:** Subtle glow statt harte Schatten: `box-shadow: 0 0 40px rgba(14,165,233,0.15)`
- **Animationen:** `transition: all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)` — Apple Spring-Feeling
- **Safe Areas:** `padding-top: env(safe-area-inset-top)` für iPhone-Notch

### Bottom Navigation (5 Tabs)
```
[Home]  [Chat]  [Training]  [Zeiten]  [Mehr]
  🏠      💬       📅          ⏱       ···
```
Chat, Training, Zeiten zeigen in Sub-Projekt 1 einen schönen "Coming Soon"-Placeholder.

### Screens

**Login**
- Vollbild, dunkles Ocean-Hintergrund
- Mermaids-Logo (SVG — stilisierter Wellenbogen + Text)
- E-Mail + Passwort Input mit floating Labels
- "Anmelden"-Button in Teal-Gradient
- "Einladungslink verwenden" — öffnet Token-Eingabe

**Register (via Einladungslink)**
- URL: `/register?token=XYZ`
- Zeigt: "Du wurdest als [Rolle] eingeladen"
- Felder: Name, Passwort, Passwort bestätigen
- Bei Fehler: "Link abgelaufen" State

**Dashboard**
- Header: "Hallo, [Name]!" + Avatar-Chip rechts
- Hero-Card: Nächster Termin (Placeholder in Sub-Projekt 1)
- Quick-Stats: Mitgliederanzahl, Dokumente
- Letzte Dokumente (2–3 Einträge)

**Mitglieder** *(sichtbar für Admin + Trainer)*
- Liste: Avatar (Initialen + Farbe), Name, Rolle-Badge, E-Mail
- FAB "+" → Einladungsmodal (E-Mail + Rolle wählen)
- Admin: Swipe/Long-Press → Rolle ändern, Entfernen

**Dokumente**
- Segment-Control: Alle | Anmeldeformulare | Vereinsdokumente | Sonstiges
- Datei-Karten: Icon, Name, Größe, Datum, Download-Button
- FAB "+" (Admin/Trainer) → Upload-Modal (Kategorie wählen + Datei)

**Profil**
- Avatar mit Initialen (editierbar: Farbe wählen)
- Name, E-Mail (readonly), Rolle-Badge
- "Passwort ändern"-Button
- "Abmelden"-Button (destructive)

## Auth-Flow

```
Login → POST /api/auth/login
      ← Access Token (15min, im Memory) + Refresh Token (Cookie, 30 Tage)

Jede API-Anfrage → Bearer Token im Authorization Header
Token abgelaufen → Auto-Refresh via POST /api/auth/refresh
Refresh abgelaufen → Redirect zu /login

Einladung:
Admin → POST /api/invitations (E-Mail + Rolle)
      → Nodemailer sendet E-Mail mit Link: https://[domain]/register?token=XYZ
Neuer User → GET /api/invitations/:token (prüfen)
           → POST /api/invitations/:token/accept (Name + Passwort)
           → Auto-Login
```

## Berechtigungen

| Aktion | Admin | Trainer | Eltern | Mitglied |
|---|---|---|---|---|
| Mitglieder einladen | ✓ | ✓ | — | — |
| Rolle ändern | ✓ | — | — | — |
| Mitglied entfernen | ✓ | — | — | — |
| Dokument hochladen | ✓ | ✓ | — | — |
| Dokument löschen | ✓ | ✓* | — | — |
| Dokument herunterladen | ✓ | ✓ | ✓ | ✓ |

*Trainer können nur eigene Dokumente löschen

## Sicherheit

- Passwörter: `bcrypt` mit cost factor 12
- Access Token: JWT, HS256, signiert mit `JWT_SECRET` (ENV)
- Refresh Token: zufälliger UUID, nur Hash in DB gespeichert, httpOnly + Secure Cookie
- Datei-Upload: max 10MB, nur `application/pdf` erlaubt, Dateiname sanitized
- CORS: nur die eigene Domain erlaubt
- Rate Limiting: max 10 Login-Versuche pro Minute per IP (`express-rate-limit`)

## Server-Setup auf hotdomeins.at

```bash
# PostgreSQL installieren
sudo apt install postgresql

# Datenbank anlegen
sudo -u postgres psql -c "CREATE DATABASE mermaids;"
sudo -u postgres psql -c "CREATE USER mermaids_user WITH PASSWORD 'xxx';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mermaids TO mermaids_user;"

# pm2 + Node.js
npm install -g pm2
pm2 start server/ecosystem.config.cjs
pm2 startup && pm2 save

# Nginx als Reverse Proxy
# /api/* → localhost:3001
# /* → dist/ (statische React-Dateien)
```

## ENV-Variablen (server/.env)

```
PORT=3001
DATABASE_URL=postgresql://mermaids_user:xxx@localhost/mermaids
JWT_SECRET=<zufälliger 64-Byte-String>
JWT_REFRESH_SECRET=<anderer zufälliger 64-Byte-String>
SMTP_HOST=mail.hotdomeins.at
SMTP_PORT=587
SMTP_USER=noreply@[domain]
SMTP_PASS=xxx
APP_URL=https://[domain]
UPLOAD_DIR=/var/www/mermaids/uploads
```

## Was dieses Sub-Projekt NICHT enthält

- Chat / Messaging (Sub-Projekt 2)
- Trainingsplan (Sub-Projekt 3)
- Zeiten & myresults-Integration (Sub-Projekt 4)
- Wettkampf / msecm.at (Sub-Projekt 5)
- Instagram-Integration (zukünftiges Feature)
- Push-Notifications
