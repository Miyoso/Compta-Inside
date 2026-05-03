-- Migration v13 : historique des paiements de salaires
CREATE TABLE IF NOT EXISTS salary_payments (
  id           SERIAL PRIMARY KEY,
  company_id   INTEGER       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  week_start   DATE          NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_at      TIMESTAMPTZ   DEFAULT NOW(),
  paid_by      INTEGER       REFERENCES users(id),
  UNIQUE (company_id, week_start)   -- impossible de payer deux fois la même semaine
);
CREATE INDEX IF NOT EXISTS idx_salary_pay_company ON salary_payments(company_id, week_start DESC);
