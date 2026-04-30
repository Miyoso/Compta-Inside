-- ============================================================
--  COMPTA GTA RP — Schéma v2 (Produits, Ventes, Stocks)
--  À exécuter dans l'éditeur SQL de Neon APRÈS schema.sql
-- ============================================================

-- Ajout du pourcentage de salaire sur les ventes (par employé)
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_percent DECIMAL(5,2) DEFAULT 0;

-- Table des produits
CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  category         VARCHAR(100) DEFAULT 'Autre',
  price            DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_quantity   INTEGER NOT NULL DEFAULT 0,
  stock_min_alert  INTEGER NOT NULL DEFAULT 5,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Table des ventes
CREATE TABLE IF NOT EXISTS sales (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   INTEGER REFERENCES users(id),
  product_id    INTEGER REFERENCES products(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL,
  sale_date     TIMESTAMP DEFAULT NOW()
);

-- Vérification
SELECT 'Tables créées avec succès ✅' AS statut;
