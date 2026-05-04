-- Ajouter le type d'entreprise (cafe | garage)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR(20) DEFAULT 'cafe';

-- Table des devis garage
CREATE TABLE IF NOT EXISTS garage_quotes (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id           INTEGER REFERENCES users(id),
  client_first_name     VARCHAR(100),
  client_last_name      VARCHAR(100),
  vehicle_model         VARCHAR(200),
  vehicle_category      VARCHAR(50),
  selected_performances JSONB    DEFAULT '[]',
  selected_customs      JSONB    DEFAULT '[]',
  selected_paints       JSONB    DEFAULT '[]',
  perfs_total           NUMERIC(12,2) DEFAULT 0,
  customs_total         NUMERIC(12,2) DEFAULT 0,
  paints_total          NUMERIC(12,2) DEFAULT 0,
  grand_total           NUMERIC(12,2) DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garage_quotes_company ON garage_quotes(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_garage_quotes_employee ON garage_quotes(employee_id);

-- Marquer les entreprises existantes comme cafés
UPDATE companies SET company_type = 'cafe' WHERE company_type IS NULL OR company_type = '';
