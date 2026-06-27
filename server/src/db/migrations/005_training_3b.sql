-- Attendance tracking: trainer marks who attended a session
CREATE TABLE IF NOT EXISTS session_attendance (
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- Personal member entries: note + distance + 1-3 star rating (one per member per session)
CREATE TABLE IF NOT EXISTS session_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT,
  distance_m INTEGER,
  rating     SMALLINT CHECK (rating BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- De-duplication guard: prevents sending push twice for the same session+user
CREATE TABLE IF NOT EXISTS training_push_sent (
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- Compound partial index for the cron query (only non-cancelled sessions)
-- idx_training_sessions_date already exists from 004_training.sql (single column)
CREATE INDEX IF NOT EXISTS idx_training_sessions_date_time
  ON training_sessions(date, start_time)
  WHERE is_cancelled = false;
