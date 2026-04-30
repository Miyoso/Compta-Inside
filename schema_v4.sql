-- ============================================================
--  COMPTA GTA RP — Schéma v4 (Images produits)
--  À exécuter dans l'éditeur SQL de Neon APRÈS schema_v3.sql
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

SELECT 'Schéma v4 appliqué avec succès ✅' AS statut;
