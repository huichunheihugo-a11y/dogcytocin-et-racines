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

CREATE TABLE IF NOT EXISTS foster_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_complet TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT NOT NULL,
  type_logement TEXT NOT NULL,
  autres_animaux TEXT NOT NULL,
  details_autres_animaux TEXT,
  enfants_bas_age TEXT NOT NULL,
  experience_animaux TEXT NOT NULL,
  motivation TEXT NOT NULL,
  duree_disponibilite TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  created_at TEXT NOT NULL,
  notes TEXT
);

-- Si la table foster_applications existe deja sans cette colonne, executer separement dans la
-- console D1 : ALTER TABLE foster_applications ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_foster_applications_created ON foster_applications (created_at);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created ON blog_posts (created_at);

CREATE TABLE IF NOT EXISTS dogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age TEXT NOT NULL,
  size TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'adoption',
  image_url TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dogs_created ON dogs (created_at);
