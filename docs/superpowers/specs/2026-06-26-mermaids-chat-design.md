# Mermaids App — Sub-Projekt 2: Chat & Messaging

**Date:** 2026-06-26
**Status:** Approved
**Scope:** Sub-Projekt 2 von 5 — Real-Time-Chat mit Channels, Anhängen, Reaktionen, Pins, Read Receipts und Push Notifications

## Kontext

Sub-Projekt 1 lieferte Fundament: Auth, Rollen, Dokumente, Design-System. Sub-Projekt 2 ersetzt den Chat-Placeholder (`/chat`) durch eine vollwertige WhatsApp-ähnliche Messaging-Funktion auf Basis von Socket.io.

## Ziele

- Mehrere Channels mit rollenbasierter + mitgliederbasierter Sichtbarkeit
- Real-Time-Nachrichten via Socket.io (Typing-Indikatoren, Reactions, Read Receipts)
- Anhänge: Bilder, Videos, Dokumente
- Pinnen von Nachrichten, Antworten auf Nachrichten, Bearbeiten und Löschen
- Push Notifications via Web Push API (auch wenn App geschlossen)

## Tech Stack

| Schicht | Technologie |
|---|---|
| Real-Time | Socket.io 4 (läuft auf demselben Express-Server) |
| File Upload | Multer (erweitert aus Sub-Projekt 1) |
| MIME-Validierung | `file-type` Package (Magic-Byte-Prüfung) |
| Push Notifications | `web-push` Package + VAPID Keys |
| Rate Limiting | `express-rate-limit` (bereits vorhanden) |
| Frontend | React 19, Socket.io-client, bestehender Design-Stack |

## Datenbank-Schema

```sql
CREATE TABLE channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  min_role    TEXT NOT NULL DEFAULT 'mitglied'
              CHECK (min_role IN ('admin','trainer','eltern','mitglied')),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE channel_members (
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  content         TEXT,
  reply_to        UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited_at       TIMESTAMPTZ,
  deleted_for_all BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);

CREATE TABLE message_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID REFERENCES messages(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,        -- UUID-prefixed gespeicherter Dateiname
  original_name TEXT NOT NULL,        -- originaler Dateiname für Download
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_reactions (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE channel_reads (
  channel_id      UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
-- "Wer hat Nachricht X gelesen?" = SELECT user_id FROM channel_reads
-- WHERE channel_id = X.channel_id
-- AND last_message_id IN (SELECT id FROM messages WHERE created_at >= X.created_at)

CREATE TABLE pinned_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  pinned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, message_id)
);

CREATE TABLE deleted_messages (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT UNIQUE NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Channel-Zugriffskontrolle

Ein User kann einen Channel sehen und schreiben wenn **eine** der folgenden Bedingungen zutrifft:

1. Seine Rolle erfüllt `min_role` (Hierarchie: `admin > trainer > eltern > mitglied`)
2. Er ist explizit in `channel_members` eingetragen

Diese Prüfung erfolgt an **drei Stellen**:
- REST: SQL-Query mit Zugriffsprüfung (WHERE-Klausel)
- Socket.io `join-channels`: Server prüft jeden Channel-ID vor dem Room-Join
- Socket.io per Event: Jeder `send-message`, `add-reaction`, etc. prüft nochmals den Zugriff (kein blindes Vertrauen auf bereits gejointen Room)

## API Endpoints

Alle REST-Responses: `{ ok: true, data: T }` oder `{ ok: false, error: string }`.

### Channels

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/chat/channels` | JWT | Alle zugänglichen Channels des Users |
| POST | `/api/chat/channels` | Admin/Trainer | Channel erstellen |
| PATCH | `/api/chat/channels/:id` | Admin/Trainer | Name, Beschreibung, min_role ändern |
| DELETE | `/api/chat/channels/:id` | Admin | Channel archivieren (soft delete) |
| POST | `/api/chat/channels/:id/members` | Admin/Trainer | Mitglied hinzufügen |
| DELETE | `/api/chat/channels/:id/members/:userId` | Admin/Trainer | Mitglied entfernen |

### Nachrichten

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/chat/channels/:id/messages` | JWT | Paginierte History (`?before=<uuid>&limit=50`) |
| POST | `/api/chat/channels/:id/attachments` | JWT | Datei hochladen → gibt `attachmentId` zurück |
| GET | `/api/chat/attachments/:id/file` | JWT | Datei herunterladen |

### Pins

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| GET | `/api/chat/channels/:id/pins` | JWT | Alle gepinnten Nachrichten |
| POST | `/api/chat/channels/:id/pins` | Admin/Trainer | Nachricht pinnen |
| DELETE | `/api/chat/channels/:id/pins/:pinId` | Admin/Trainer | Nachricht entpinnen |

### Push

| Method | Path | Auth | Beschreibung |
|---|---|---|---|
| POST | `/api/push/subscribe` | JWT | Push-Subscription speichern |
| DELETE | `/api/push/subscribe` | JWT | Push-Subscription löschen |
| GET | `/api/push/vapid-public-key` | — | VAPID Public Key für Client |

## Socket.io Protokoll

### Verbindungsaufbau

```ts
// Client
const socket = io(BASE, {
  auth: { token: getAccessToken() },
  transports: ['websocket'],
})

// Bei auth-error: Token refreshen, neu verbinden
socket.on('auth-error', async () => {
  const ok = await tryRefresh()
  if (ok) socket.auth = { token: getAccessToken() }
  socket.connect()
})
```

Der Server verifiziert den Token in `io.use()` (Socket.io Middleware) via `verifyAccess()`. Bei ungültigem Token wird die Verbindung mit `auth-error` abgelehnt.

### Client → Server Events

| Event | Payload | Beschreibung |
|---|---|---|
| `join-channels` | — | Server leitet erlaubte Channels aus DB + JWT ab, joined Rooms |
| `send-message` | `{ channelId, content?, replyTo?, attachmentIds: string[] }` | Nachricht senden |
| `edit-message` | `{ messageId, content }` | Nur eigene Nachrichten |
| `delete-message` | `{ messageId, forAll: boolean }` | forAll nur Sender + Admin |
| `add-reaction` | `{ messageId, emoji }` | Emoji-Reaktion hinzufügen |
| `remove-reaction` | `{ messageId, emoji }` | Reaktion entfernen |
| `typing-start` | `{ channelId }` | Tipp-Indikator starten |
| `typing-stop` | `{ channelId }` | Tipp-Indikator stoppen |
| `mark-read` | `{ channelId, lastMessageId }` | Setzt `last_message_id` in `channel_reads` via UPSERT |

### Server → Client Events

| Event | Payload | Beschreibung |
|---|---|---|
| `new-message` | Vollständiges Message-Objekt | An alle Channel-Mitglieder |
| `message-edited` | `{ messageId, content, editedAt }` | An alle Channel-Mitglieder |
| `message-deleted` | `{ messageId, deletedForAll }` | An alle Channel-Mitglieder |
| `reaction-added` | `{ messageId, userId, emoji }` | An alle Channel-Mitglieder |
| `reaction-removed` | `{ messageId, userId, emoji }` | An alle Channel-Mitglieder |
| `typing` | `{ channelId, userId, name }` | An andere Channel-Mitglieder |
| `stopped-typing` | `{ channelId, userId }` | An andere Channel-Mitglieder |
| `message-read` | `{ channelId, lastMessageId, userId, readAt }` | An alle Channel-Mitglieder (zeigt wer bis wohin gelesen hat) |
| `auth-error` | — | JWT abgelaufen/ungültig |

### Typing Debounce

- `typing-start` bei Keydown (max 1x alle 2 Sekunden senden)
- `typing-stop` nach 3 Sekunden ohne Keydown (automatisch via Timer)
- Server broadcastet nie zurück an den Sender (`socket.broadcast.to(room)`)

## Datei-Uploads

### Limits

| Typ | MIME Types | Max Größe |
|---|---|---|
| Bilder | `image/jpeg`, `image/png`, `image/gif`, `image/webp` | 20 MB |
| Videos | `video/mp4`, `video/quicktime` | 250 MB |
| Dokumente | `application/pdf` | 25 MB |

### Sicherheit

- **Magic-Byte-Validierung** via `file-type` Package: nach Multer-Upload die tatsächlichen Bytes prüfen, bei Mismatch Datei löschen und 400 zurückgeben
- **UUID-Prefix** auf gespeichertem Dateinamen (kein Original-Dateiname im Filesystem)
- **Path-Traversal-Guard** identisch zu Sub-Projekt 1: `path.resolve()` + `startsWith(safeBase + sep)`
- **Upload-Verzeichnis:** `UPLOAD_DIR/chat/` (separates Unterverzeichnis von `/documents`)

### Upload-Flow

1. Client lädt Datei hoch: `POST /api/chat/channels/:id/attachments` → erhält `{ attachmentId }`
2. Client schickt `send-message` via Socket mit `attachmentIds: [attachmentId]`
3. Server verknüpft Attachment mit der neuen Message in der DB

Anhänge ohne zugehörige Message (Upload-Abbruch) werden per Cron-Job nach 24h gelöscht.

## Push Notifications

### Setup

```
VAPID_PUBLIC_KEY=<base64url>
VAPID_PRIVATE_KEY=<base64url>
VAPID_CONTACT=mailto:admin@[domain]
```

VAPID Keys einmalig generieren: `npx web-push generate-vapid-keys`

### Ablauf

1. Client ruft `GET /api/push/vapid-public-key` auf
2. Service Worker abonniert: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
3. Client sendet Subscription an `POST /api/push/subscribe`
4. Bei neuer Nachricht: Server sendet Push an alle Channel-Mitglieder die **nicht** per Socket verbunden sind

### Notification-Inhalt

```json
{
  "title": "#channel-name",
  "body": "Anna: Hallo alle! 👋",
  "icon": "/mermaids-logo.svg",
  "data": { "channelId": "uuid" }
}
```

Body wird auf 100 Zeichen gekürzt. Klick auf Notification öffnet App auf `/chat?channel=<id>`.

## Sicherheit

| Punkt | Maßnahme |
|---|---|
| Socket-Auth | JWT-Verifikation in `io.use()` Middleware, Ablehnung bei ungültigem Token |
| JWT-Ablauf | Server sendet `auth-error`, Client refresht und reconnectet |
| Per-Event Channel-Auth | Jeder Socket-Event prüft DB-Zugriff (kein blindes Room-Vertrauen) |
| Edit-Autorisierung | Backend prüft `sender_id = req.user.id` |
| Delete-for-all | Nur Sender oder Admin; Backend prüft Bedingung |
| Pin/Unpin | Nur Admin/Trainer |
| Channel erstellen/bearbeiten | Nur Admin/Trainer |
| MIME-Validierung | `file-type` Magic-Byte-Check nach Upload |
| Rate Limiting | Max 30 Nachrichten/Minute per User (Socket-Ebene) |
| Push-Subscription | User kann nur eigene Subscription löschen |
| Path Traversal | `path.resolve()` + `startsWith(safeBase + sep)` auf Datei-Downloads |

## Frontend-Struktur

```
src/
  api/
    chat.ts           # REST-Wrapper: channels, messages, pins, attachments
    push.ts           # subscribe/unsubscribe
  hooks/
    useSocket.ts      # Socket.io-Verbindung, auth-error-Handling, reconnect
    useChat.ts        # Channel-State, Message-History, optimistische Updates
  pages/
    Chat.tsx          # Haupt-Layout: ChannelList + MessageView
  components/
    chat/
      ChannelList.tsx         # Liste + Unread-Dots + FAB für Admin/Trainer
      CreateChannelModal.tsx  # Channel erstellen/bearbeiten
      MessageList.tsx         # Infinite Scroll nach oben, Datumsgruppen
      MessageBubble.tsx       # Eigene rechts/teal, fremde links/glass
      MessageInput.tsx        # Textfeld + Anhang-Picker + Reply-Preview-Bar
      ReactionPicker.tsx      # Emoji-Picker + Aktionsmenü (Long-Press)
      PinnedMessages.tsx      # Ausklappbares Panel oben
      TypingIndicator.tsx     # "Anna schreibt gerade…"
      AttachmentPreview.tsx   # Bild/Video/Dokument-Vorschau in Bubble
```

### Chat-Layout

**Desktop (≥ md):** Zweispaltig — Channel-Liste links (280px), Message-View rechts.

**Mobil (< md):** Zweistufig — Channel-Liste als erster Screen, Tap öffnet Message-View (Channel-Liste verschwindet), Back-Button kehrt zurück.

### MessageBubble

- Eigene Nachrichten: rechtsbündig, teal-Gradient-Hintergrund
- Fremde: linksbündig, Glassmorphism-Card
- Reply-Vorschau: grauer Balken oben in der Bubble mit gekürtztem Original-Text
- `[Nachricht gelöscht]` in kursiv für `deleted_for_all = true`
- `bearbeitet` Label in klein neben Timestamp wenn `edited_at != null`
- Reactions: horizontale Emoji-Chips unter der Bubble mit Zähler
- Long-Press / Rechtsklick öffnet Aktionsmenü: Antworten | Bearbeiten | Löschen | Pinnen | Reaktion

### Unread-Zähler

Client merkt sich `lastReadMessageId` pro Channel (im State). Unread-Badge = Anzahl Nachrichten nach diesem ID.

## Service Worker (PWA)

Bestehender Service Worker aus Sub-Projekt 1 wird erweitert:

```js
self.addEventListener('push', event => {
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      data: data.data,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(`/chat?channel=${event.notification.data.channelId}`)
  )
})
```

## ENV-Variablen (neu)

```
VAPID_PUBLIC_KEY=<base64url>
VAPID_PRIVATE_KEY=<base64url>
VAPID_CONTACT=mailto:noreply@[domain]
```

## Was dieses Sub-Projekt NICHT enthält

- Direkt-Nachrichten (1:1 Chat) — ggf. Sub-Projekt 6
- Nachrichtensuche — späteres Feature
- Sprach- oder Videonachrichten
- Channel-Archive durchsuchen
- Message-Threads (Antwort-Kette, à la Slack) — nur flache Replies wie WhatsApp
