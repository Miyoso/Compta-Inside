-- Dépenses du garage (pièces, matériaux, fournitures)
CREATE TABLE IF NOT EXISTS garage_expenses (
  id           SERIAL PRIMARY KEY,
  company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id  INTEGER REFERENCES users(id),
  description  VARCHAR(200) NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  category     VARCHAR(100) DEFAULT 'Pièces',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_garage_exp_company ON garage_expenses(company_id, expense_date DESC);

-- S'assurer que salary_payments existe (créé dans schema_v13 mais au cas où)
CREATE TABLE IF NOT EXISTS salary_payments (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_at    TIMESTAMPTZ DEFAULT NOW(),
  paid_by    INTEGER REFERENCES users(id),
  UNIQUE (company_id, week_start)
);
