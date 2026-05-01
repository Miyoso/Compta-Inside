-- schema_v10.sql : ajout du username pour la connexion
-- À exécuter dans Neon SQL Editor

-- 1. Ajout de la colonne username (nullable d'abord pour la migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- 2. Backfill : les users existants reçoivent un username basé sur leur email
UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || id
WHERE username IS NULL;

-- 3. Rendre obligatoire et unique
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (LOWER(username));
