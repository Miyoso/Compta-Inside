-- schema_v11.sql : historique des mouvements de stock matières premières
-- À exécuter dans Neon SQL Editor

CREATE TABLE IF NOT EXISTS stock_movements (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  raw_material_id   INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  movement_type     VARCHAR(20) NOT NULL
    CHECK (movement_type IN ('purchase','sale','adjustment','purchase_cancel','sale_cancel')),
  quantity_change   NUMERIC(12,3) NOT NULL,   -- positif = entrée, négatif = sortie
  quantity_after    NUMERIC(12,3),
  reference_id      INTEGER,                  -- invoice_id ou purchase_id selon le type
  reference_label   TEXT,                     -- description lisible
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_mvt_company_date
  ON stock_movements(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_mvt_material
  ON stock_movements(raw_material_id, created_at DESC);
