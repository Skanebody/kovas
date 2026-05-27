-- ============================================
-- KOVAS — Cron pg_cron pour Edge Function regulatory-watcher (2026-05-27)
-- ============================================
--
-- Schedule quotidien 01:00 UTC = 02:00 CET (heure d'hiver) / 03:00 CEST (été)
-- du lundi au vendredi. Le watcher scrape les 9 sources réglementaires
-- (JORF Légifrance, ADEME, Cofrac, DGCCRF, MTE, CSTB, AFNOR) et insère les
-- nouveaux documents trouvés dans `regulatory_documents` avec processed=false.
--
-- Le pipeline aval `batch-results-poller` (cron toutes les 10 min, déjà actif)
-- prend ensuite le relais pour l'enrichissement IA Claude (ai_summary +
-- topics + embeddings pgvector).
--
-- Activation requise côté Supabase :
--   1. Extension pg_cron déjà installée (cf. migration database)
--   2. Vault secrets : KOVAS_FUNCTION_URL_BASE + SERVICE_ROLE_KEY
--   3. Project ref Supabase configuré dans le URL ci-dessous
--
-- Désactivation temporaire (debug) : SELECT cron.unschedule('regulatory-watcher-daily');

-- 1. S'assurer que pg_cron est installé (no-op si déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Helper RPC pour appeler l'Edge Function via pg_net (mode async fire-and-forget)
CREATE OR REPLACE FUNCTION public.invoke_regulatory_watcher()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Lit la base URL des Edge Functions depuis Vault
  -- (pré-requis : INSERT INTO vault.secrets pour KOVAS_FUNCTION_URL_BASE)
  v_url := COALESCE(
    current_setting('app.settings.function_url_base', true),
    'https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1'
  ) || '/regulatory-watcher';

  -- Lit la service role key depuis Vault
  -- (pré-requis : SELECT vault.create_secret('eyJ...', 'kovas_service_role_key'))
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'kovas_service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'kovas_service_role_key not found in vault — skipping invoke';
    RETURN 'vault_secret_missing';
  END IF;

  -- Appel async via pg_net (fire-and-forget, ne bloque pas le cron job)
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  RETURN format('queued request_id=%s url=%s', v_request_id, v_url);
END;
$$;

COMMENT ON FUNCTION public.invoke_regulatory_watcher() IS
  'Appelle l''Edge Function regulatory-watcher via pg_net. Async fire-and-forget. Utilisé par cron quotidien.';

-- 3. Cron daily 01:00 UTC (du lundi au vendredi — JORF ne publie pas les week-ends)
SELECT cron.unschedule('regulatory-watcher-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'regulatory-watcher-daily'
);

SELECT cron.schedule(
  'regulatory-watcher-daily',
  '0 1 * * 1-5', -- 01:00 UTC, lundi → vendredi
  $$ SELECT public.invoke_regulatory_watcher() $$
);

-- 4. Sanity check
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cron.job
  WHERE jobname = 'regulatory-watcher-daily';

  IF v_count = 1 THEN
    RAISE NOTICE 'Cron regulatory-watcher-daily scheduled successfully (01:00 UTC weekdays).';
  ELSE
    RAISE WARNING 'Expected 1 cron job, found %', v_count;
  END IF;
END $$;
