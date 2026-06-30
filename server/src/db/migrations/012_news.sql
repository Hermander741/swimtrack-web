CREATE TABLE IF NOT EXISTS news_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motivational_quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text        TEXT NOT NULL,
  attribution TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed quotes
INSERT INTO motivational_quotes (text, attribution) VALUES
  ('Der einzige schlechte Workout ist der, den du nicht gemacht hast.', NULL),
  ('Schmerz ist vorübergehend. Aufgeben ist für immer.', 'Lance Armstrong'),
  ('Es kommt nicht darauf an, wie schnell du schwimmst, sondern dass du nicht aufhörst.', NULL),
  ('Champions trainieren, Verlierer klagen.', NULL),
  ('Das Wasser ist dein Freund. Du musst dich dem Wasser hingeben, nicht gegen es kämpfen.', 'Aleksandr Popov'),
  ('Jeder Weltrekord beginnt mit einem ersten Sprung ins Wasser.', NULL),
  ('Glaube an deinen Körper. Er weiß, was er kann.', NULL),
  ('Schwimmen ist Freiheit — jede Bahn, die du ziehst, gehört nur dir.', NULL),
  ('Erfolg ist die Summe kleiner Anstrengungen, die Tag für Tag wiederholt werden.', 'Robert Collier'),
  ('Das Wasser trügt nicht — es zeigt dir genau, wer du bist.', NULL),
  ('Disziplin ist die Brücke zwischen Ziel und Leistung.', 'Jim Rohn'),
  ('Jede Bahn ist eine Chance, besser zu werden als gestern.', NULL),
  ('Wer aufhört, besser zu werden, hat aufgehört, gut zu sein.', 'Philip Rosenthal'),
  ('Das härteste Training ist das, nach dem du am stolzesten bist.', NULL),
  ('Schwimmen lehrt uns: Ausdauer schlägt Talent, wenn das Talent keine Ausdauer hat.', NULL),
  ('Im Wasser gibt es keine Ausreden — nur du und die Zeit.', NULL),
  ('Träume sind der Kraftstoff, Training ist der Motor.', NULL),
  ('Der Körper erreicht, was der Geist glaubt.', NULL),
  ('Jeder Morgen im Wasser ist ein Geschenk an dein zukünftiges Ich.', NULL),
  ('Nicht die stärksten Schwimmer gewinnen — sondern die, die am meisten wollen.', NULL),
  ('Schnell ist man nicht, man wird es.', NULL),
  ('Bewegung im Wasser ist Meditation in Bewegung.', NULL),
  ('Fortschritt braucht keine Perfektion — nur Konsequenz.', NULL),
  ('Wenn du denkst, du kannst nicht mehr — schwimm noch eine Bahn.', NULL),
  ('Das Wasser kennt keine Lieblinge. Nur Vorbereitung.', NULL);
