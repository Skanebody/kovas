-- ============================================
-- KOVAS — Cron pg_cron pour purge automatique des données obsolètes
-- 2026-05-27
-- ============================================
--
-- Schedule quotidien 03:00 UTC (creux d'activité utilisateur). Purge :
--   - quote_requests > 12 mois : anonymisation PII (UPDATE, pas DELETE)
--   - otp_codes expirés > 24h : DELETE
--   - bandit_events > 6 mois : DELETE
--   - admin_2fa_attempts > 90 jours : DELETE
--   - csp_violations > 30 jours : DELETE (si table existe)
--
-- Conformité RGPD :
--   - Article 5.1.c (minimisation) : on garde le moins de PII possible
--   - Article 5.1.e (limitation conservation) : durées proportionnées
--   - CNIL guide marketing direct : leads B2C non convertis = 12 mois max
--
-- Activation requise côté Supabase :
--   1. Extension pg_cron déjà installée (cf. migrations précédentes)
--   2. Vault secret : kovas_service_role_key (déjà configuré pour
--      regulatory-watcher)
--   3. Vault secret : kovas_internal_purge_secret (À CRÉER manuellement
--      en SQL Studio :
--        SELECT vault.create_secret(
--          'genere_un_secret_aleatoire_64_chars',
--          'kovas_internal_purge_secret'
--        );
--      Et configurer la même valeur côté Edge Function via
--      `supabase secrets set INTERNAL_PURGE_SECRET=...`
--   4. Variable d'env Edge Function : INTERNAL_PURGE_SECRET
--
-- Désactivation temporaire (debug) :
--   SELECT cron.unschedule('purge-old-data-daily');

-- ============================================
-- 1. S'assurer que pg_cron est installé
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================
-- 2. Ajouter colonne anonymized_at sur quote_requests
-- ============================================
-- Permet d'identifier les rows déjà anonymisées et de ne pas re-traiter
-- les mêmes lignes à chaque run du cron (idempotence).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_requests'
      AND column_name = 'anonymized_at'
  ) THEN
    ALTER TABLE public.quote_requests ADD COLUMN anonymized_at timestamptz;

    -- Index partiel sur les rows NON encore anonymisées pour accélérer le
    -- WHERE created_at < cutoff AND anonymized_at IS NULL côté Edge Function.
    CREATE INDEX IF NOT EXISTS idx_quote_requests_anonymized_at_pending
      ON public.quote_requests(created_at)
      WHERE anonymized_at IS NULL;

    COMMENT ON COLUMN public.quote_requests.anonymized_at IS
      'Date d''anonymisation RGPD (12 mois après création par cron purge-old-data). NULL = PII encore en clair.';

    RAISE NOTICE 'Colonne anonymized_at ajoutée à quote_requests.';
  ELSE
    RAISE NOTICE 'Colonne anonymized_at déjà présente sur quote_requests — skip.';
  END IF;
END $$;

-- ============================================
-- 3. Helper RPC pour appeler l'Edge Function via pg_net
-- ============================================
-- Mode async fire-and-forget. Le cron ne bloque pas en attendant la
-- réponse Edge Function (qui peut prendre plusieurs minutes pour
-- anonymiser des dizaines de milliers de quote_requests).
CREATE OR REPLACE FUNCTION public.invoke_purge_old_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_url TEXT;
  v_purge_secret TEXT;
  v_request_id BIGINT;
BEGIN
  -- Base URL des Edge Functions
  v_url := COALESCE(
    current_setting('app.settings.function_url_base', true),
    'https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1'
  ) || '/purge-old-data';

  -- Secret d'auth dédié — distinct de la service_role_key pour limiter
  -- le blast radius en cas de fuite (ce secret ne sert qu'à invoquer
  -- cette fonction, il n'a aucun droit DB).
  SELECT decrypted_secret INTO v_purge_secret
  FROM vault.decrypted_secrets
  WHERE name = 'kovas_internal_purge_secret'
  LIMIT 1;

  IF v_purge_secret IS NULL THEN
    RAISE WARNING 'kovas_internal_purge_secret not found in vault — skipping purge';
    RETURN 'vault_secret_missing';
  END IF;

  -- Appel async via pg_net (fire-and-forget)
  -- Timeout 5 min : l'anonymisation de quote_requests peut être longue
  -- au premier run (purge initiale d'un backlog).
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_purge_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN format('queued request_id=%s url=%s', v_request_id, v_url);
END;
$$;

COMMENT ON FUNCTION public.invoke_purge_old_data() IS
  'Appelle l''Edge Function purge-old-data via pg_net. Async fire-and-forget. Cron quotidien 03:00 UTC. Secret d''auth distinct de la service_role_key (kovas_internal_purge_secret).';

-- ============================================
-- 4. Schedule cron quotidien 03:00 UTC
-- ============================================
-- 03:00 UTC = 04:00 CET (hiver) / 05:00 CEST (été) — heure creuse côté
-- utilisateurs diagnostiqueurs, et après le passage du
-- regulatory-watcher-daily (01:00 UTC) pour éviter la concurrence sur
-- pg_net.
SELECT cron.unschedule('purge-old-data-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-old-data-daily'
);

SELECT cron.schedule(
  'purge-old-data-daily',
  '0 3 * * *', -- 03:00 UTC tous les jours
  $$ SELECT public.invoke_purge_old_data() $$
);

-- ============================================
-- 5. Sanity check
-- ============================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM cron.job
  WHERE jobname = 'purge-old-data-daily';

  IF v_count = 1 THEN
    RAISE NOTICE 'Cron purge-old-data-daily scheduled successfully (03:00 UTC quotidien).';
  ELSE
    RAISE WARNING 'Expected 1 cron job named purge-old-data-daily, found %', v_count;
  END IF;
END $$;
