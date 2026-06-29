CREATE TABLE IF NOT EXISTS meet_results (
  meet_id       TEXT,
  event_name    TEXT,
  course        TEXT,
  swimmer_name  TEXT,
  birth_year    INT,
  club          TEXT,
  time_ms       INT,
  meet_date     DATE,
  meet_name     TEXT,
  PRIMARY KEY (meet_id, event_name, swimmer_name)
);

CREATE INDEX IF NOT EXISTS meet_results_swimmer_idx ON meet_results (LOWER(swimmer_name));

CREATE TABLE IF NOT EXISTS scraped_meets (
  meet_id    TEXT PRIMARY KEY,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);
