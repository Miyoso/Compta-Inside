-- ── Recettes produits (matières premières nécessaires par unité produite) ──
CREATE TABLE IF NOT EXISTS product_recipes (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   INTEGER NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(10,3) NOT NULL DEFAULT 1,
  UNIQUE(product_id, raw_material_id)
);
