CREATE TABLE IF NOT EXISTS app_recipes_recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  prep_time TEXT,
  cook_time TEXT,
  servings TEXT,
  ingredients TEXT NOT NULL,   -- JSON array of strings
  instructions TEXT NOT NULL,  -- JSON array of step strings
  cuisine TEXT,
  tags TEXT,                   -- JSON array of strings
  source_text TEXT,            -- original pasted text, if any
  photo_filename TEXT,         -- uploaded photo of handwritten/printed recipe
  cover_filename TEXT,         -- AI-generated or uploaded cover image
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_user ON app_recipes_recipes(user_id);
