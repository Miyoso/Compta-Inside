-- ============================================================
--  COMPTA GTA RP — Schéma v3 (Factures multi-produits)
--  À exécuter dans l'éditeur SQL de Neon APRÈS schema_v2.sql
-- ============================================================

-- Table des factures (regroupe plusieurs produits en une seule vente)
CREATE TABLE IF NOT EXISTS invoices (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   INTEGER REFERENCES users(id),
  total_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Lier chaque ligne de vente à une facture
ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE;

SELECT 'Schéma v3 appliqué avec succès ✅' AS statut;
