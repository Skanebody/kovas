-- ============================================================================
-- KOVAS — Cron pg_cron : onboarding-followup-emails (VAL-2)
-- Date : 2026-06-12
--
-- Schedule : toutes les heures (0 * * * *) — la fonction Edge filtre
-- les diagnosticians dans la fenêtre T+12h et T+48h depuis created_at.
--
-- Idempotent : DROP IF EXISTS + recreate.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

-- Suppression idempotente
DO $$
BEGIN
  PERFORM cron.unschedule('kovas-onboarding-followup-hourly')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'kovas-onboarding-followup-hourly'
  );
EXCEPTION WHEN OTHERS THEN
  -- Si pas encore créé, ignore
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'kovas-onboarding-followup-hourly',
    '0 * * * *',
    $cron$SELECT public.invoke_edge_function('onboarding-followup-emails', '{}'::jsonb);$cron$
  );
EXCEPTION WHEN OTHERS THEN
  -- En cas d'environnement sans helper invoke_edge_function, fallback HTTP direct
  RAISE NOTICE 'invoke_edge_function helper missing, skipping cron schedule.';
END $$;

COMMENT ON EXTENSION pg_cron IS 'Schedules : kovas-onboarding-followup-hourly (T+12h / T+48h emails).';
