-- ============================================================================
-- Observatoire — Cron mensuel refresh des stats live
-- ============================================================================
-- Programme l'invocation mensuelle de l'Edge Function
-- `observatoire-stats-refresh` qui recalcule les agrégats publiés sur
-- /observatoire (table `observatoire_live_stats`).
--
-- Schedule : 1er du mois 02:00 UTC (~04:00 Paris été / 03:00 Paris hiver).
-- Choisi 2h plus tôt que la veille hebdo + le rapport mensuel pour que la
-- page /observatoire soit à jour AVANT que le rapport mensuel ne soit
-- généré et envoyé aux subscribers (sinon le PDF récap pointerait sur
-- de la data du mois M-2).
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
-- Schedule : observatoire-stats-refresh — 1er du mois 02:00 UTC
-- ----------------------------------------------------------------------------
-- Cron expression : "0 2 1 * *" = à 02:00 UTC le 1er de chaque mois
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'kovas-observatoire-stats-refresh';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'kovas-observatoire-stats-refresh',
    '0 2 1 * *',
    $cron$SELECT public.invoke_edge_function('observatoire-stats-refresh', '{}'::jsonb);$cron$
  );
END $$;

COMMENT ON EXTENSION pg_cron IS
  'Scheduler PostgreSQL. Jobs KOVAS Observatoire : kovas-observatoire-stats-refresh (1er mois 02:00 UTC) + kovas-observatoire-monthly (1er mois 04:00 UTC) + kovas-veille-weekly (mardis 04:00 UTC).';
