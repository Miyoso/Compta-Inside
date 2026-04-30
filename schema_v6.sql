-- ============================================================
--  COMPTA GTA RP — Schéma v6 (Validation des comptes)
--  À exécuter dans Neon APRÈS schema_v5.sql
-- ============================================================

-- Ajout du statut sur les utilisateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Les comptes existants (patrons déjà créés) passent en 'active' automatiquement
UPDATE users SET status = 'active' WHERE status = 'pending';

-- Les prochains inscrits via le formulaire auront status = 'pending' par défaut
-- (le code de register.js sera mis à jour)

SELECT 'Schéma v6 appliqué ✅ — Tous les comptes existants sont actifs' AS statut;
