-- ============================================================================
-- Observatoire — Cron mensuel d'ingestion ADEME rénovations
-- ============================================================================
-- Programme l'invocation mensuelle de l'Edge Function
-- `ingest-ademe-renovations-monthly` qui alimente la table
-- `public.observatoire_renovations_monthly` (24 derniers mois glissants).
--
-- Schedule : 1er du mois 04:00 UTC (~06:00 Paris été / 05:00 Paris hiver).
-- Décalé de +02:00 vs `observatoire-stats-refresh` (02:00 UTC) pour éviter
-- la contention sur les workers Edge Functions et garantir un ordre :
--   1. 02:00 UTC : refresh agrégats observatoire (prix, distributions)
--   2. 04:00 UTC : ingest rénovations ADEME (alimente le graph évolution)
--   3. 04:00 UTC J+1 : envoi rapport mensuel aux subscribers
--
-- Prérequis : extension pg_cron + helper public.invoke_edge_function()
-- déjà créés par la migration `20260524120000_ai_pipelines_cron.sql`.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Schedule : ingest-ademe-renovations-monthly — 1er du mois 04:00 UTC
-- ----------------------------------------------------------------------------
-- Cron expression : "0 4 1 * *" = à 04:00 UTC le 1er de chaque mois
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'ingest-ademe-renovations-monthly';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'ingest-ademe-renovations-monthly',
    '0 4 1 * *',
    $cron$SELECT public.invoke_edge_function('ingest-ademe-renovations-monthly', '{}'::jsonb);$cron$
  );
END $$;

COMMENT ON EXTENSION pg_cron IS
  'Scheduler PostgreSQL. Jobs KOVAS Observatoire : kovas-observatoire-stats-refresh (1er mois 02:00 UTC) + ingest-ademe-renovations-monthly (1er mois 04:00 UTC) + kovas-observatoire-monthly (1er mois 04:00 UTC) + kovas-veille-weekly (mardis 04:00 UTC).';
