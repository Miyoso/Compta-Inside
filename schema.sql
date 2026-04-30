-- ============================================================
--  COMPTA GTA RP - Schéma de base de données Neon PostgreSQL
--  À exécuter UNE SEULE FOIS dans la console SQL de Neon
-- ============================================================

-- Table des entreprises
CREATE TABLE IF NOT EXISTS companies (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des patrons (liés à une entreprise)
CREATE TABLE IF NOT EXISTS patrons (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL
);

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'employee',  -- 'admin', 'patron', 'employee'
  company_id    INTEGER REFERENCES companies(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  DONNÉES DE BASE (entreprises + patrons)
-- ============================================================

-- Insertion des entreprises
INSERT INTO companies (name) VALUES
  ('Le Pond Café'),
  ('Le Piers 76')
ON CONFLICT DO NOTHING;

-- Insertion des patrons
INSERT INTO patrons (company_id, name)
SELECT c.id, p.name
FROM (VALUES
  ('Le Pond Café', 'Alyarya K Rosell'),
  ('Le Pond Café', 'Lucinda Rosell'),
  ('Le Piers 76',  'Pers1'),
  ('Le Piers 76',  'Pers2')
) AS p(company_name, name)
JOIN companies c ON c.name = p.company_name
ON CONFLICT DO NOTHING;
