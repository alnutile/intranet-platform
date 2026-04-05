CREATE TABLE IF NOT EXISTS app_wine_tracker_wines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  winery TEXT,
  vintage INTEGER,
  varietal TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  photo_filename TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_wine_tracker_user ON app_wine_tracker_wines(user_id);
