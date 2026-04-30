-- ============================================================
--  COMPTA GTA RP — Schéma v5 (Achats matières premières)
--  À exécuter dans Neon APRÈS schema_v4.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS purchases (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  patron_id     INTEGER REFERENCES users(id),
  name          VARCHAR(255) NOT NULL,          -- nom de la matière première
  product_id    INTEGER REFERENCES products(id) DEFAULT NULL, -- lien stock optionnel
  quantity      INTEGER DEFAULT NULL,           -- quantité ajoutée au stock si product_id renseigné
  unit_price    DECIMAL(10,2) NOT NULL,         -- prix unitaire payé
  total_amount  DECIMAL(10,2) NOT NULL,         -- montant total de l'achat
  purchase_date TIMESTAMP DEFAULT NOW(),
  notes         TEXT DEFAULT NULL               -- commentaire libre
);

SELECT 'Schéma v5 appliqué avec succès ✅' AS statut;
