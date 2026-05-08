-- ================================================================
-- schema_v17.sql — Pipe Down Bar + support company_type = 'bar'
-- À exécuter dans Neon SQL Editor
-- ================================================================

-- 1. Créer l'entreprise Pipe Down
INSERT INTO companies (name, company_type, account_balance)
VALUES ('Pipe Down', 'bar', 0)
ON CONFLICT DO NOTHING;

-- 2. Vérifier l'id attribué
SELECT id, name, company_type FROM companies WHERE name = 'Pipe Down';

-- ================================================================
-- Après avoir noté l'id ci-dessus (ex: 5), créer les comptes :
-- ================================================================

-- 2a. Créer un compte Patron pour Pipe Down
--     Remplacer <COMPANY_ID> par l'id trouvé ci-dessus
--     Remplacer les valeurs entre < > par les vrais noms/identifiants
-- INSERT INTO users (name, username, password_hash, role, company_id, salary_percent)
-- VALUES (
--   '<Nom du Patron>',
--   '<username>',
--   crypt('<mot_de_passe>', gen_salt('bf')),
--   'patron',
--   <COMPANY_ID>,
--   10
-- );

-- ================================================================
-- Alternative : créer le compte via l'interface d'inscription
-- puis l'approuver et changer le rôle en patron :
-- ================================================================
-- UPDATE users SET role = 'patron' WHERE username = '<username>';
