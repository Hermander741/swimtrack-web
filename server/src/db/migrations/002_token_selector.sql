ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_selector TEXT;
UPDATE refresh_tokens SET token_selector = gen_random_uuid()::text WHERE token_selector IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN token_selector SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_selector_idx ON refresh_tokens (token_selector);
