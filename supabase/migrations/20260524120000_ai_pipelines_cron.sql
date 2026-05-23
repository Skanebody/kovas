-- ============================================================================
-- AI Pipelines — pg_cron schedules pour Edge Functions IA
-- ============================================================================
-- Programme deux jobs cron :
--   1. generate-veille-article : mardi 06:00 Europe/Paris (5h UTC hiver / 4h UTC été)
--      → Génère 2 articles SEO Amandine Bart via Claude Haiku par semaine
--   2. observatoire-monthly-report : 1er du mois 06:00 Europe/Paris
--      → Génère le rapport mensuel Observatoire + envoie aux subscribers
--
-- Les Edge Functions sont invoquées via net.http_post() (extension pg_net).
-- Le token service_role est stocké dans Vault (extension supabase_vault) pour
-- ne jamais apparaître en clair dans le code des jobs.
--
-- IMPORTANT : pg_cron stocke ses jobs en heure UTC. La conversion Europe/Paris
-- est gérée via les cron expressions explicites :
--   - 04:00 UTC = 06:00 CEST (heure d'été) — choisi pour cibler 06:00 user-side
--   - Note : en hiver (CET) les jobs tournent à 05:00 local, acceptable cron.
--   Pour une précision parfaite Europe/Paris, utiliser une vue cron native PG17+
--   (non disponible sur Supabase 2026-05). Compromis 06:00 CEST retenu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions requises
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Vault est pré-installé sur Supabase. Sécurise stockage du service_role token.
-- ----------------------------------------------------------------------------
-- 2. Helper : enregistre le service role token dans Vault si absent
-- ----------------------------------------------------------------------------
-- Le token réel doit être inséré via :
--   SELECT vault.create_secret(
--     '<SERVICE_ROLE_JWT>',
--     'service_role_token',
--     'Service role JWT pour invocations cron internes Edge Functions'
--   );
-- Voir docs/SUPABASE-MANUAL-FIXES.md pour la procédure.

-- ----------------------------------------------------------------------------
-- 3. Helper RPC : invoque une Edge Function de manière sécurisée
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_edge_function(
  function_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_request_id bigint;
  v_project_url text;
  v_service_token text;
BEGIN
  -- Récupère l'URL du projet et le token vault
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_token
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_token'
  LIMIT 1;

  IF v_project_url IS NULL THEN
    -- Fallback : utilise le pattern Supabase standard {project_ref}.supabase.co
    -- En prod, set v_project_url via vault avant d'activer le cron.
    RAISE WARNING 'Vault secret project_url manquant — cron sera no-op tant que non configuré';
    RETURN 0;
  END IF;

  IF v_service_token IS NULL THEN
    RAISE WARNING 'Vault secret service_role_token manquant — cron sera no-op tant que non configuré';
    RETURN 0;
  END IF;

  SELECT net.http_post(
    url := v_project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_token
    ),
    body := payload,
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) TO service_role;

COMMENT ON FUNCTION public.invoke_edge_function(text, jsonb) IS
  'Invoque une Edge Function Supabase avec le service_role token (Vault). Réservé aux jobs pg_cron.';

-- ----------------------------------------------------------------------------
-- 4. Schedule 1 : generate-veille-article — Mardi 04:00 UTC (~06:00 Europe/Paris)
-- ----------------------------------------------------------------------------
-- Cron expression : "0 4 * * 2" = à 04:00 UTC chaque mardi
-- Limit 2 articles/semaine → ~104 articles/an, coût ~2 €/an Claude Haiku
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'kovas-veille-weekly';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'kovas-veille-weekly',
    '0 4 * * 2',
    $cron$SELECT public.invoke_edge_function('generate-veille-article', '{"limit": 2}'::jsonb);$cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- 5. Schedule 2 : observatoire-monthly-report — 1er du mois 04:00 UTC (~06:00 Europe/Paris)
-- ----------------------------------------------------------------------------
-- Cron expression : "0 4 1 * *" = à 04:00 UTC le 1er de chaque mois
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'kovas-observatoire-monthly';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'kovas-observatoire-monthly',
    '0 4 1 * *',
    $cron$SELECT public.invoke_edge_function('observatoire-monthly-report', '{}'::jsonb);$cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- 6. Vue de monitoring admin : derniers jobs cron exécutés
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.cron_job_runs_recent
WITH (security_invoker = on) AS
SELECT
  jrd.jobid,
  j.jobname,
  j.schedule,
  jrd.runid,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time))::int AS duration_seconds,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'kovas-%'
ORDER BY jrd.start_time DESC
LIMIT 200;

REVOKE ALL ON public.cron_job_runs_recent FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cron_job_runs_recent TO service_role;

COMMENT ON VIEW public.cron_job_runs_recent IS
  'Monitoring : 200 dernières exécutions des cron KOVAS. Accessible service_role only (admin RPC dédié si besoin UI).';

-- ----------------------------------------------------------------------------
-- 7. Commentaires finaux
-- ----------------------------------------------------------------------------
COMMENT ON EXTENSION pg_cron IS
  'Scheduler PostgreSQL. Jobs KOVAS : kovas-veille-weekly (mardis 04:00 UTC) + kovas-observatoire-monthly (1er du mois 04:00 UTC).';
