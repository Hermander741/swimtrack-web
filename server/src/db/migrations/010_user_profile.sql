ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vorname     TEXT,
  ADD COLUMN IF NOT EXISTS nachname    TEXT,
  ADD COLUMN IF NOT EXISTS geburtsdatum DATE;

-- Backfill vorname/nachname for existing users from name field
UPDATE users
SET
  vorname  = TRIM(split_part(name, ' ', 1)),
  nachname = NULLIF(TRIM(substring(name FROM position(' ' IN name))), '')
WHERE vorname IS NULL;
