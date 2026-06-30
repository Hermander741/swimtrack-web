CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 hour',
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
