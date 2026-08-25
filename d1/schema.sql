CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT,
  reply_message TEXT,
  reply_created_at TEXT
);

-- Si la table comments existe deja sans ces deux colonnes, executer separement dans la console D1 :
-- ALTER TABLE comments ADD COLUMN reply_message TEXT;
-- ALTER TABLE comments ADD COLUMN reply_created_at TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_ip_hash_created ON comments (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS admin_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_attempts_ip ON admin_attempts (ip_hash, attempted_at);

CREATE TABLE IF NOT EXISTS rejected_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_rejected_comments_created ON rejected_comments (created_at);
