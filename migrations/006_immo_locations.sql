-- Migration 006: Module Immobilier
-- Ajoute la table immo_locations pour les entreprises de type 'immobilier'

CREATE TABLE IF NOT EXISTS immo_locations (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES users(id),
  bien_id         INTEGER NOT NULL,
  bien_nom        TEXT NOT NULL,
  adresse         TEXT DEFAULT '',
  client_prenom   TEXT NOT NULL DEFAULT '',
  client_nom      TEXT NOT NULL,
  client_numero   TEXT DEFAULT '',
  tier_stock      INTEGER NOT NULL,        -- palier de stockage : 1000 / 500 / 300 / 100 / 50
  nb_jours        INTEGER NOT NULL,
  prix_jour       NUMERIC(12,2) NOT NULL,
  prix_total      NUMERIC(12,2) NOT NULL,
  taxe_pct        NUMERIC(5,2) NOT NULL DEFAULT 10,
  marge_pct       NUMERIC(5,2) NOT NULL DEFAULT 20,
  benefice_agence NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxe_reversee   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_immo_locations_company ON immo_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_immo_locations_created ON immo_locations(created_at DESC);

-- Ajouter 'immobilier' comme type d'entreprise valide
-- Si la colonne company_type utilise une contrainte CHECK, la mettre à jour :
-- ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
-- ALTER TABLE companies ADD CONSTRAINT companies_company_type_check
--   CHECK (company_type IN ('garage', 'cafe', 'bar', 'immobilier'));
-- Si elle utilise un ENUM PostgreSQL, faire :
-- ALTER TYPE company_type_enum ADD VALUE IF NOT EXISTS 'immobilier';

-- Version simple TEXT sans contrainte (adapter selon votre schéma) :
-- Aucune action nécessaire si company_type est de type TEXT sans contrainte.

-- ── Si la table existe déjà, ajouter les nouvelles colonnes : ─────────────
ALTER TABLE immo_locations ADD COLUMN IF NOT EXISTS adresse       TEXT DEFAULT '';
ALTER TABLE immo_locations ADD COLUMN IF NOT EXISTS client_prenom TEXT NOT NULL DEFAULT '';
ALTER TABLE immo_locations ADD COLUMN IF NOT EXISTS client_numero TEXT DEFAULT '';
ALTER TABLE immo_locations ADD COLUMN IF NOT EXISTS date_debut    DATE DEFAULT CURRENT_DATE;
