CREATE TABLE IF NOT EXISTS app_shows_shows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  tldr TEXT,
  channel TEXT,
  year TEXT,
  image_url TEXT,
  tags TEXT,
  watched INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
