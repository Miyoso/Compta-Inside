-- ============================================================
--  CRÉATION DES COMPTES PATRONS
--  Mot de passe par défaut : Patron123!
--  À exécuter dans l'éditeur SQL de Neon
-- ============================================================

-- Le Pond Café — Patrons
INSERT INTO users (name, email, password_hash, role, company_id)
VALUES (
  'Alyarya K Rosell',
  'alyarya.rosell@pondcafe.rp',
  '$2b$12$.LsXhsVOvAmLRiKjF5ETp.L1qx4B.zsLlbbNi0o7yVkzRAxRbK5wW',
  'patron',
  (SELECT id FROM companies WHERE name = 'Le Pond Café' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, company_id)
VALUES (
  'Lucinda Rosell',
  'lucinda.rosell@pondcafe.rp',
  '$2b$12$.LsXhsVOvAmLRiKjF5ETp.L1qx4B.zsLlbbNi0o7yVkzRAxRbK5wW',
  'patron',
  (SELECT id FROM companies WHERE name = 'Le Pond Café' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;

-- Le Piers 76 — Patrons
INSERT INTO users (name, email, password_hash, role, company_id)
VALUES (
  'Pers1',
  'pers1@piers76.rp',
  '$2b$12$.LsXhsVOvAmLRiKjF5ETp.L1qx4B.zsLlbbNi0o7yVkzRAxRbK5wW',
  'patron',
  (SELECT id FROM companies WHERE name = 'Le Piers 76' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (name, email, password_hash, role, company_id)
VALUES (
  'Pers2',
  'pers2@piers76.rp',
  '$2b$12$.LsXhsVOvAmLRiKjF5ETp.L1qx4B.zsLlbbNi0o7yVkzRAxRbK5wW',
  'patron',
  (SELECT id FROM companies WHERE name = 'Le Piers 76' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;

-- Vérification : affiche les comptes créés
SELECT u.name, u.email, u.role, c.name AS entreprise
FROM users u
JOIN companies c ON c.id = u.company_id
ORDER BY c.name, u.name;
