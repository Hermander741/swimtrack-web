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
