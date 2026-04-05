-- Core platform schema.
-- Sub-apps provide their own migration SQL in apps/<id>/migrations/.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  email TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by INTEGER REFERENCES users(id)
);

-- Per-user access to a sub-app. If no row exists for (user, app), the user has no access.
-- Admins implicitly have access to everything.
CREATE TABLE IF NOT EXISTS app_access (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  granted_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (user_id, app_id)
);

-- Tracks which migration files have been applied (core + sub-apps).
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- Settings: lock_registration flips to 1 the moment the first admin registers.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Record of where each installed plugin came from. Bundled apps (shipped in
-- the repo) are seeded on first boot as source = 'bundled'.
CREATE TABLE IF NOT EXISTS installed_apps (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('bundled', 'git', 'ai')),
  repo TEXT,
  ref TEXT,
  installed_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
