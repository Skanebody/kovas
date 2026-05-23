-- ============================================================================
-- KOVAS Annuaire — pg_cron schedule pour verify-diagnosticians-daily
-- Date : 2026-05-24
-- Mission : croiser quotidiennement DHUP + Sirene + Google My Business pour
--           chaque diagnostiqueur en base, recalculer activity_score (0-1) et
--           lever des fraud_flags si signal négatif détecté.
--
-- Stratégie batch : 500 diagnostiqueurs / jour.
--   • 13 000 / 500 = 26 jours pour couvrir tout l'annuaire en rotation LRU
--   • Pour fréquence doublée : modifier limit à 1000 OU dupliquer le job à 04h
--
-- Idempotence : la fonction edge re-écrit les colonnes à chaque passage avec
--   un timestamp courant ; les fraud_flags sont remplacés (pas append cumulatif).
--   La cron peut tourner 100x sans corrompre les données.
--
-- Pré-requis :
--   1. Edge Function `verify-diagnosticians-daily` déployée
--      → `./scripts/deploy-edge-functions.sh verify-diagnosticians-daily`
--   2. Vault secrets `project_url` + `service_role_token` configurés
--      → cf. supabase/migrations/20260524120000_ai_pipelines_cron.sql §2
--   3. Helper RPC `public.invoke_edge_function` créé (même migration que ci-dessus)
--
-- Variables d'environnement Edge Function (optionnelles, graceful degradation) :
--   - INSEE_CLIENT_ID / INSEE_CLIENT_SECRET    → enable Sirene cross-validation
--   - GOOGLE_PLACES_API_KEY                    → enable GMB enrichment
--   - DHUP_FRESHNESS_DAYS (default 60)         → seuil dhup_active=true
-- ============================================================================

-- Pré-requis : extensions pg_cron + pg_net activées par migration AI pipelines
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- Schedule : kovas-verify-diagnosticians-daily
-- Cron expression : "0 3 * * *" = 03:00 UTC chaque jour
--   - été (CEST UTC+2) : 05:00 Paris
--   - hiver (CET UTC+1) : 04:00 Paris
-- Choix 03:00 UTC : faible trafic public + fin batch avant heure de bureau FR.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_existing_job_id bigint;
BEGIN
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = 'kovas-verify-diagnosticians-daily';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'kovas-verify-diagnosticians-daily',
    '0 3 * * *',
    $cron$
    SELECT public.invoke_edge_function(
      'verify-diagnosticians-daily',
      jsonb_build_object('mode', 'batch', 'limit', 500)
    );
    $cron$
  );
END $$;

-- ----------------------------------------------------------------------------
-- Vue agrégée : santé de la dernière exécution + métriques quotidiennes
-- Consommée par /admin/diagnostiqueurs/audit
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.diagnosticians_verify_health
WITH (security_invoker = on) AS
SELECT
  -- Métriques globales
  (SELECT count(*) FROM diagnosticians)                                AS total_diagnosticians,
  (SELECT count(*) FROM diagnosticians WHERE validation_status = 'verified')   AS total_verified,
  (SELECT count(*) FROM diagnosticians WHERE validation_status = 'pending')    AS total_pending,
  (SELECT count(*) FROM diagnosticians WHERE validation_status = 'suspended')  AS total_suspended,
  (SELECT count(*) FROM diagnosticians WHERE validation_status = 'ceased')     AS total_ceased,
  (SELECT count(*) FROM diagnosticians
     WHERE jsonb_array_length(coalesce(fraud_flags, '[]'::jsonb)) > 0)         AS total_fraud_flagged,
  (SELECT count(*) FROM diagnosticians
     WHERE activity_score IS NOT NULL AND activity_score < 0.5)               AS total_below_threshold,
  (SELECT count(*) FROM diagnosticians WHERE gmb_place_id IS NOT NULL)        AS total_gmb_enriched,
  (SELECT count(*) FROM diagnosticians WHERE sirene_state = 'active')         AS total_sirene_active,
  (SELECT round(avg(activity_score)::numeric, 3) FROM diagnosticians
     WHERE activity_score IS NOT NULL)                                        AS avg_activity_score,

  -- Dernière exécution cron
  (SELECT max(start_time) FROM cron.job_run_details jrd
     JOIN cron.job j ON j.jobid = jrd.jobid
     WHERE j.jobname = 'kovas-verify-diagnosticians-daily'
       AND jrd.status = 'succeeded')                                          AS last_cron_run_at,
  (SELECT status FROM cron.job_run_details jrd
     JOIN cron.job j ON j.jobid = jrd.jobid
     WHERE j.jobname = 'kovas-verify-diagnosticians-daily'
     ORDER BY start_time DESC LIMIT 1)                                        AS last_cron_status,

  -- Stats des 24 dernières heures (cross_validation_logs)
  (SELECT count(*) FROM diagnostician_cross_validation_logs
     WHERE source = 'VERIFY_DAILY' AND created_at >= now() - interval '24 hours') AS logs_24h,
  (SELECT count(*) FROM diagnostician_cross_validation_logs
     WHERE source = 'VERIFY_DAILY' AND outcome = 'fraud_flag'
       AND created_at >= now() - interval '24 hours')                         AS fraud_flags_24h,
  (SELECT count(*) FROM diagnostician_cross_validation_logs
     WHERE source = 'VERIFY_DAILY' AND outcome = 'ceased'
       AND created_at >= now() - interval '24 hours')                         AS ceased_24h,

  -- Coverage rotation
  (SELECT count(*) FROM diagnosticians
     WHERE activity_score_computed_at IS NULL
        OR activity_score_computed_at < now() - interval '30 days')           AS overdue_30d
;

REVOKE ALL ON public.diagnosticians_verify_health FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnosticians_verify_health TO service_role;

COMMENT ON VIEW public.diagnosticians_verify_health IS
  'Métriques santé pipeline verify-diagnosticians-daily. Consommée par /admin/diagnostiqueurs/audit.';

-- ----------------------------------------------------------------------------
-- Top départements (vue auxiliaire pour le dashboard admin)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.diagnosticians_top_departments
WITH (security_invoker = on) AS
SELECT
  coalesce(dept_code, department_code, 'XX') AS dept_code,
  count(*)::int                              AS total,
  count(*) FILTER (WHERE validation_status = 'verified')::int  AS verified,
  count(*) FILTER (WHERE activity_score IS NOT NULL AND activity_score < 0.5)::int AS below_threshold
FROM diagnosticians
WHERE coalesce(dept_code, department_code) IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;

REVOKE ALL ON public.diagnosticians_top_departments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.diagnosticians_top_departments TO service_role;

COMMENT ON VIEW public.diagnosticians_top_departments IS
  'Top 20 départements par nombre de diagnostiqueurs. Pour /admin/diagnostiqueurs/audit.';

-- ----------------------------------------------------------------------------
-- RPC : déclenchement manuel via la page admin (bouton "Vérif manuelle")
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_verify_diagnosticians_daily(
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  v_request_id := public.invoke_edge_function(
    'verify-diagnosticians-daily',
    jsonb_build_object('mode', 'batch', 'limit', p_limit, 'offset', p_offset)
  );
  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trigger_verify_diagnosticians_daily(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_verify_diagnosticians_daily(int, int) TO service_role;

COMMENT ON FUNCTION public.trigger_verify_diagnosticians_daily(int, int) IS
  'Déclenchement manuel admin de verify-diagnosticians-daily. Réservé service_role.';

-- ----------------------------------------------------------------------------
-- Verdict final
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'KOVAS : cron quotidien verify-diagnosticians-daily configuré (03:00 UTC, batch 500).';
  RAISE NOTICE 'Couverture rotation : 13k diags / 500/j = ~26 jours pour parcourir tout l''annuaire.';
END $$;
