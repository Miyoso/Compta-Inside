-- ============================================================
--  COMPTA GTA RP — Schéma v7
--  Séparation Matières Premières (stock) / Produits (pas de stock)
--  À exécuter dans Neon APRÈS schema_v6.sql
-- ============================================================

-- Table des matières premières (c'est elles qui ont un stock)
CREATE TABLE IF NOT EXISTS raw_materials (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  unit       VARCHAR(50)  DEFAULT 'unité',   -- kg, L, cl, bouteilles, pièces…
  quantity   DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_alert  DECIMAL(10,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Lier les achats aux matières premières (au lieu des produits)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS raw_material_id INTEGER REFERENCES raw_materials(id);

-- Retirer le lien produit des achats (on garde la colonne pour ne pas casser la BDD
-- mais on ne l'utilise plus — les nouvelles lignes utiliseront raw_material_id)

-- Retirer la gestion de stock des ventes (on n'a plus besoin de déduire)
-- Les colonnes stock_quantity et stock_min_alert sur products restent en base
-- mais ne sont plus utilisées dans le code

SELECT 'Schéma v7 appliqué ✅' AS statut;
