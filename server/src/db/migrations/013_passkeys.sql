CREATE TABLE IF NOT EXISTS passkey_credentials (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key    BYTEA NOT NULL,
  counter       BIGINT NOT NULL DEFAULT 0,
  device_type   TEXT,
  backed_up     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);
