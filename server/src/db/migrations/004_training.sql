CREATE TABLE IF NOT EXISTS training_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#0EA5E9',
  channel_id  UUID REFERENCES channels(id) ON DELETE SET NULL,
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
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
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
  group_id     UUID REFERENCES training_groups(id) ON DELETE CASCADE,
  template_id  UUID REFERENCES training_templates(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 90,
  location     TEXT,
  notes        TEXT,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  is_external  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT group_or_external CHECK (group_id IS NOT NULL OR is_external = true),
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_group ON training_sessions(group_id, date);

CREATE TABLE IF NOT EXISTS training_session_blocks (
  session_id    UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES training_blocks(id) ON DELETE SET NULL,
  position      SMALLINT NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  distance_m    INTEGER,
  stroke        TEXT,
  reps          INTEGER,
  rest_s        INTEGER,
  description   TEXT,
  override_note TEXT,
  PRIMARY KEY (session_id, position)
);

CREATE TABLE IF NOT EXISTS ical_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  token      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
