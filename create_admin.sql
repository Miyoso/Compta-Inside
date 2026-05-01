-- ── Création du compte administrateur global ─────────────────────────────────
-- Mot de passe : Admin123!
-- Ce compte a accès à la vue admin (/admin) de toutes les entreprises.
-- Il n'est rattaché à aucune entreprise (company_id = NULL).

INSERT INTO users (name, email, password_hash, role, company_id, salary_percent, status)
VALUES (
  'Administrateur',
  'admin@compta-inside.com',
  '$2b$10$H7Olx5CKV.xd1QeowZGVCOSni2RkO57GPJInVMQpq6FeWYf7TDIXm',
  'admin',
  NULL,
  0,
  'active'
)
ON CONFLICT (email) DO NOTHING;
