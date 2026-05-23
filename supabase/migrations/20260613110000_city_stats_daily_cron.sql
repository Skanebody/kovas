-- ============================================================================
-- city_real_stats — Cron quotidien rotation 200 villes/jour
-- ============================================================================
-- Programme l'invocation quotidienne de l'Edge Function
-- `refresh-city-stats-batch` qui rafraîchit les statistiques RÉELLES
-- de jusqu'à 200 villes par jour (ADEME + estimation prix + Claude Haiku).
--
-- Schedule : 02:00 UTC tous les jours (~04:00 Paris été / 03:00 Paris hiver).
-- Cible : 5000 villes en rotation continue, chaque ville rafraîchie minimum
-- toutes les 25-30 jours (jamais de data > 60 jours en production).
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
-- Schedule : refresh-city-stats-batch — quotidien 02:00 UTC
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'kovas-refresh-city-stats-daily';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'kovas-refresh-city-stats-daily',
    '0 2 * * *',
    $cron$
    SELECT public.invoke_edge_function(
      'refresh-city-stats-batch',
      jsonb_build_object('mode', 'recurring', 'limit', 200)
    );
    $cron$
  );
END $$;
