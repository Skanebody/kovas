-- ============================================================================
-- KOVAS — Lot B54 : Fix matviews 1er refresh prod
--
-- Contexte :
--   La migration 20260525170000_data_lake_schemas.sql crée 2 vues matérialisées
--   dans le schema analytics avec la clause `WITH NO DATA` (cf. lignes 202-227
--   du fichier). Conséquence : à l'état initial, ces matviews sont DÉCLARÉES
--   mais NON-PEUPLÉES, et toute tentative de `REFRESH MATERIALIZED VIEW
--   CONCURRENTLY` échoue avec l'erreur Postgres :
--
--     ERROR: CONCURRENTLY cannot be used when the materialized view is not populated
--
--   L'Edge Function `refresh-data-lake-matviews` (cron 06:00 CET quotidien)
--   utilise systématiquement `CONCURRENTLY` → 1er run en prod cassé.
--
-- Décision (anomalie #1 §9.2 de MIGRATION-PROD-CHECKLIST.md, Lot B52) :
--   Amorcer les matviews par un refresh SANS `CONCURRENTLY` via migration
--   dédiée et idempotente. Une fois peuplées (même à 0 lignes après le SELECT
--   sous-jacent, ce qui compte est l'état "populated" Postgres), les refresh
--   `CONCURRENTLY` ultérieurs de l'Edge Function fonctionneront.
--
-- Idempotence :
--   `REFRESH MATERIALIZED VIEW` (sans CONCURRENTLY) est rejouable sans erreur
--   sur une matview déjà peuplée. Le bloc DO ... EXCEPTION enveloppe chaque
--   refresh pour ne JAMAIS faire échouer la migration (au cas où la matview
--   serait introuvable lors d'un replay sur DB partielle).
--
-- Authority :
--   - docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md §3.7 + §9.2 anomalie #1
--   - supabase/migrations/20260525170000_data_lake_schemas.sql lignes 201-227
--   - supabase/functions/refresh-data-lake-matviews/index.ts
-- ============================================================================

DO $$
BEGIN
  -- Matview 1 : passoires_thermiques_by_commune (source data.ademe_dpe)
  BEGIN
    REFRESH MATERIALIZED VIEW analytics.passoires_thermiques_by_commune;
  EXCEPTION WHEN OTHERS THEN
    -- Silencieux : la matview peut ne pas exister sur un environnement partiel,
    -- ou être déjà peuplée et refreshée par un job concurrent. Pas bloquant.
    NULL;
  END;

  -- Matview 2 : transactions_history_by_commune (source data.dvf_mutations)
  BEGIN
    REFRESH MATERIALIZED VIEW analytics.transactions_history_by_commune;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
