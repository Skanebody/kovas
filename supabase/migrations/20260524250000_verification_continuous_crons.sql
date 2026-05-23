-- ============================================================================
-- KOVAS — Pipeline de vérification : crons continus + alertes
-- Date : 2026-05-24
-- Lot  : VAL-4 (verification-continuous)
--
-- 4 crons :
--   1. COFRAC quotidien        — vérifier suspensions / radiations / renouvellements
--   2. RC Pro mensuel          — alertes expiration J-60 / J-30 / J-7 + auto-expire J+1
--   3. SIRENE annuel           — re-check entreprise (radiation / liquidation)
--   4. Alertes emails horaires — consomme verification_alerts_queue
--
-- Pré-requis : migration 20260524240000_diagnosticians_verification_pipeline.sql
--              (tables diagnostician_verification_status + verification_alerts_queue)
--              + helper RPC public.invoke_edge_function (migration AI pipelines).
--
-- Edge Functions invoquées :
--   - verify-cofrac-batch                — batch quotidien COFRAC
--   - verify-sirene-batch                — batch annuel SIRENE
--   - verification-send-alert-emails     — consomme la queue d'alertes
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. Cron QUOTIDIEN COFRAC — 04:00 UTC = 06:00 Paris été / 05:00 hiver
--    Vérifie les suspensions / radiations / expirations imminentes
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
   WHERE jobname = 'kovas-verify-cofrac-daily';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;

  PERFORM cron.schedule(
    'kovas-verify-cofrac-daily',
    '0 4 * * *',
    $cron$
    SELECT public.invoke_edge_function(
      'verify-cofrac-batch',
      jsonb_build_object('mode','recurring','limit',500)
    );
    $cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- 2. Cron MENSUEL RC Pro — 1er du mois 05:00 UTC
--    a. Génère alertes pending pour les expirations imminentes
--    b. Auto-expire les RC Pro déjà périmées depuis J+1
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
   WHERE jobname = 'kovas-verify-rcpro-monthly-alerts';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;

  PERFORM cron.schedule(
    'kovas-verify-rcpro-monthly-alerts',
    '0 5 1 * *',
    $cron$
    -- Alerte INFO 60 jours avant expiration
    INSERT INTO verification_alerts_queue (diagnostician_id, alert_type, severity)
    SELECT diagnostician_id, 'rcpro_expiry_60', 'info'
      FROM diagnostician_verification_status
     WHERE rcpro_valid_until = current_date + interval '60 days'
       AND rcpro_status = 'verified'
    ON CONFLICT (diagnostician_id, alert_type) WHERE status = 'pending' DO NOTHING;

    -- Alerte WARNING 30 jours avant expiration
    INSERT INTO verification_alerts_queue (diagnostician_id, alert_type, severity)
    SELECT diagnostician_id, 'rcpro_expiry_30', 'warning'
      FROM diagnostician_verification_status
     WHERE rcpro_valid_until = current_date + interval '30 days'
       AND rcpro_status = 'verified'
    ON CONFLICT (diagnostician_id, alert_type) WHERE status = 'pending' DO NOTHING;

    -- Alerte CRITICAL 7 jours avant expiration
    INSERT INTO verification_alerts_queue (diagnostician_id, alert_type, severity)
    SELECT diagnostician_id, 'rcpro_expiry_7', 'critical'
      FROM diagnostician_verification_status
     WHERE rcpro_valid_until = current_date + interval '7 days'
       AND rcpro_status = 'verified'
    ON CONFLICT (diagnostician_id, alert_type) WHERE status = 'pending' DO NOTHING;

    -- Auto-expire les RC Pro déjà périmées depuis hier
    UPDATE diagnostician_verification_status
       SET rcpro_status = 'expired'
     WHERE rcpro_valid_until < current_date - interval '1 day'
       AND rcpro_status = 'verified';

    -- Alerte CRITICAL post-expiration
    INSERT INTO verification_alerts_queue (diagnostician_id, alert_type, severity)
    SELECT diagnostician_id, 'rcpro_expired', 'critical'
      FROM diagnostician_verification_status
     WHERE rcpro_status = 'expired'
       AND rcpro_valid_until < current_date
       AND rcpro_valid_until > current_date - interval '7 days'
    ON CONFLICT (diagnostician_id, alert_type) WHERE status = 'pending' DO NOTHING;
    $cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- 3. Cron ANNUEL SIRENE — 1er janvier 06:00 UTC
--    Re-check intégral entreprise (radiation, liquidation, changement dirigeant)
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
   WHERE jobname = 'kovas-verify-sirene-annual';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;

  PERFORM cron.schedule(
    'kovas-verify-sirene-annual',
    '0 6 1 1 *',
    $cron$
    SELECT public.invoke_edge_function(
      'verify-sirene-batch',
      jsonb_build_object('mode','annual_recheck')
    );
    $cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- 4. Cron HORAIRE alertes emails — toutes les heures, 0 min
--    Consomme la file verification_alerts_queue (status=pending)
--    Envoie un email selon le alert_type, marque status=sent + email_sent_at
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
   WHERE jobname = 'kovas-verification-alerts-emails';
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;

  PERFORM cron.schedule(
    'kovas-verification-alerts-emails',
    '0 * * * *',
    $cron$
    SELECT public.invoke_edge_function(
      'verification-send-alert-emails',
      '{}'::jsonb
    );
    $cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- Verdict
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'KOVAS verification-continuous : 4 crons installés.';
  RAISE NOTICE '  - kovas-verify-cofrac-daily         (04:00 UTC)';
  RAISE NOTICE '  - kovas-verify-rcpro-monthly-alerts (1er mois 05:00 UTC)';
  RAISE NOTICE '  - kovas-verify-sirene-annual        (1er janv 06:00 UTC)';
  RAISE NOTICE '  - kovas-verification-alerts-emails  (chaque heure)';
END $$;
