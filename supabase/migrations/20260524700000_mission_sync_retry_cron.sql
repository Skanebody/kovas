-- KOVAS — Cron retry sync mission_sessions
--
-- Toutes les 30 minutes, ramasse les sessions de mission qui ont :
--   - sync_status = 'failed' OU 'processing' bloqué
--   - last_sync_attempt < now() - 30 min (cooldown anti-thrash)
--   - sync_attempts_count < 5 (cap pour éviter boucles infinies)
--
-- Relance asynchroniquement process-mission-payload pour chacune via
-- public.invoke_edge_function() (helper Vault-aware créé en lot AI-PIPELINES).
--
-- Idempotent : ON CONFLICT DO NOTHING sur le cron + skip si Vault secrets absents.

-- Extension pg_cron (déjà installée si AI-PIPELINES appliqué, sinon création)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Helper invoke_edge_function — créé par migration ai_pipelines_cron (20260524120000).
-- Si pas créé, on définit un fallback no-op pour ne pas casser ce cron.
-- DROP préalable car le return type peut différer entre migrations historiques.
DROP FUNCTION IF EXISTS public.invoke_edge_function(text, jsonb);
CREATE OR REPLACE FUNCTION public.invoke_edge_function(
  fn_name text,
  payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $func$
DECLARE
  v_project_url text;
  v_service_token text;
  v_response_id bigint;
BEGIN
  -- Tente de récupérer les secrets Vault
  BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url';
    SELECT decrypted_secret INTO v_service_token
    FROM vault.decrypted_secrets WHERE name = 'service_role_token';
  EXCEPTION WHEN OTHERS THEN
    -- Vault pas dispo : silent skip (warn seulement)
    RAISE WARNING 'invoke_edge_function: Vault secrets manquants — skip invocation de %', fn_name;
    RETURN jsonb_build_object('skipped', true, 'reason', 'vault_secrets_missing');
  END;

  IF v_project_url IS NULL OR v_service_token IS NULL THEN
    RAISE WARNING 'invoke_edge_function: project_url ou service_role_token NULL — skip %', fn_name;
    RETURN jsonb_build_object('skipped', true, 'reason', 'vault_secrets_null');
  END IF;

  -- Invocation asynchrone via pg_net (déjà installé)
  SELECT net.http_post(
    url := v_project_url || '/functions/v1/' || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_token
    ),
    body := payload,
    timeout_milliseconds := 60000
  ) INTO v_response_id;

  RETURN jsonb_build_object('queued', true, 'request_id', v_response_id);
END $func$;

-- Cron job : retry sync mission toutes les 30 minutes
SELECT cron.schedule(
  'kovas-mission-sync-retry',
  '*/30 * * * *', -- toutes les 30 minutes
  $$
  WITH eligible AS (
    SELECT id
    FROM mission_sessions
    WHERE
      (
        sync_status = 'failed'
        OR (sync_status = 'processing' AND last_sync_attempt < now() - interval '30 minutes')
      )
      AND coalesce(sync_attempts_count, 0) < 5
    ORDER BY last_sync_attempt ASC NULLS FIRST
    LIMIT 20 -- garde-fou : max 20 retries par tick
  ),
  invocations AS (
    SELECT
      e.id,
      public.invoke_edge_function(
        'process-mission-payload',
        jsonb_build_object(
          'mission_session_id', e.id,
          'trigger', 'cron_retry',
          'attempt_count', coalesce((SELECT sync_attempts_count FROM mission_sessions WHERE id = e.id), 0) + 1
        )
      ) AS result
    FROM eligible e
  )
  -- UPDATE last_sync_attempt + bump attempt counter pour les sessions invoquées
  UPDATE mission_sessions ms
  SET
    last_sync_attempt = now(),
    sync_attempts_count = coalesce(sync_attempts_count, 0) + 1,
    sync_status = CASE
      WHEN coalesce(sync_attempts_count, 0) + 1 >= 5 THEN 'failed_permanent'
      ELSE 'processing'
    END
  FROM invocations i
  WHERE ms.id = i.id
    AND (i.result->>'skipped') IS DISTINCT FROM 'true';
  $$
);

-- Index optimisation pour la query du cron (rapide même avec 10k+ rows)
CREATE INDEX IF NOT EXISTS idx_mission_sessions_sync_retry_eligible
  ON mission_sessions(sync_status, last_sync_attempt ASC)
  WHERE coalesce(sync_attempts_count, 0) < 5
    AND sync_status IN ('failed', 'processing');

-- Documentation
COMMENT ON FUNCTION public.invoke_edge_function IS
  'Helper Vault-aware pour invoquer une Edge Function depuis pg_cron. Skip gracieusement si secrets Vault manquants.';

-- Vérif : liste les cron jobs KOVAS actifs
DO $verif$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM cron.job WHERE jobname LIKE 'kovas-%';
  RAISE NOTICE 'KOVAS cron jobs actifs : %', v_count;
END $verif$;
