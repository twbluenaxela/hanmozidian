-- ============================================================
-- 碑帖 (Beitie) table migration
-- Add to your existing SQLite schema / Drizzle migration
-- ============================================================

CREATE TABLE IF NOT EXISTS beitie (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,          -- e.g. 蘭亭集序
  author      TEXT    NOT NULL,          -- e.g. 王羲之
  dynasty     TEXT    NOT NULL,          -- e.g. 東晉
  style       TEXT    NOT NULL,          -- display label: 楷書 / 行書 / 隸書 / 篆書 / 草書
  style_slug  TEXT    NOT NULL,          -- kai / xing / li / zhuan / cao
  year_label  TEXT,                      -- e.g. 353年  (free-form display string)
  medium      TEXT,                      -- e.g. 紙本墨跡（唐摹本）
  char_count  INTEGER,
  summary     TEXT,                      -- one-line teaser shown on card
  tags        TEXT,                      -- JSON array: ["天下第一行書","永字八法"]

  -- Cover image + page gallery
  cover_image TEXT,                      -- URL / R2 key for hero cover
  pages_json  TEXT DEFAULT '[]',         -- JSON array of image URLs for page thumbnails

  -- AI-generated sections (populated by admin trigger)
  ai_history   TEXT,
  ai_biography TEXT,
  ai_style     TEXT,
  ai_influence TEXT,
  ai_stories   TEXT,
  ai_practice  TEXT,
  ai_generated_at TEXT,                  -- ISO timestamp

  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Fast lookup by style for the filter chips
CREATE INDEX IF NOT EXISTS idx_beitie_style_slug ON beitie(style_slug);
