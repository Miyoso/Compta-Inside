-- ── Rendre company_id optionnel pour le compte admin global ──────────────────
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;
