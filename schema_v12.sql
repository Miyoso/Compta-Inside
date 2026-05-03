-- Migration v12 : suivi du solde bancaire
ALTER TABLE companies ADD COLUMN IF NOT EXISTS account_balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS balance_set_at  TIMESTAMPTZ   DEFAULT NOW();

-- Initialisation pour les entreprises existantes (solde à 0, date = maintenant)
UPDATE companies
SET account_balance = 0,
    balance_set_at  = NOW()
WHERE account_balance IS NULL;
