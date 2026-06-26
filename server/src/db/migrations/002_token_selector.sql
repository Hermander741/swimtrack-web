ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_selector TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_selector_idx ON refresh_tokens (token_selector);
