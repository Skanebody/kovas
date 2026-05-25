-- ============================================================================
-- KOVAS — Vue agrégée "État de la profession" (Game Changer 4 acqui-target)
-- ============================================================================
-- Vue publique consolidée sur `public.diagnosticians` pour la page
-- `/observatoire/etat-profession` (transparence cross-validation publique).
--
-- Calcule en temps réel (security_invoker) :
--   - Total diagnostiqueurs DHUP officiels
--   - Distribution validation_status (verified / unverified / pending / suspended)
--   - % avec SIRENE actif vs cessé
--   - Top 10 départements par densité
--   - Distribution activity_score (actifs / dormants / fantômes)
--
-- RLS : ouverte au public (anon + authenticated) — toutes les colonnes
-- exposées sont déjà agrégées (pas de PII).
--
-- Authority : REFONTE-ACQUI-TARGET-V2 §6.4 (GC4 Cross-validation publique).
-- ============================================================================

-- 1. Vue agrégée principale — KPIs nationaux
CREATE OR REPLACE VIEW public.v_etat_profession_summary
WITH (security_invoker = on)
AS
SELECT
  (SELECT count(*) FROM public.diagnosticians)::int AS total_diagnosticians,

  -- Par validation_status
  (SELECT count(*) FROM public.diagnosticians
   WHERE validation_status = 'verified')::int AS verified_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE validation_status = 'unverified' OR validation_status IS NULL)::int AS unverified_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE validation_status = 'pending')::int AS pending_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE validation_status = 'suspended')::int AS suspended_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE validation_status = 'ceased')::int AS ceased_count,

  -- SIRENE (cross-validation)
  (SELECT count(*) FROM public.diagnosticians
   WHERE sirene_siret IS NOT NULL)::int AS with_sirene_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE sirene_state = 'active')::int AS sirene_active_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE sirene_state = 'closed')::int AS sirene_closed_count,

  -- Activity score (engagement)
  (SELECT count(*) FROM public.diagnosticians
   WHERE activity_score >= 0.6)::int AS very_active_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE activity_score >= 0.3 AND activity_score < 0.6)::int AS moderately_active_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE activity_score IS NULL OR activity_score < 0.3)::int AS low_activity_count,

  -- Claim status (cabinets revendiqués vs ghost)
  (SELECT count(*) FROM public.diagnosticians
   WHERE claim_status = 'claimed')::int AS claimed_count,
  (SELECT count(*) FROM public.diagnosticians
   WHERE claim_status IS NULL OR claim_status = 'unclaimed')::int AS unclaimed_count,

  -- Fraud flags non-vides (au moins 1 signal détecté)
  (SELECT count(*) FROM public.diagnosticians
   WHERE jsonb_array_length(COALESCE(fraud_flags, '[]'::jsonb)) > 0)::int AS with_fraud_flags_count,

  -- Imports DHUP récents (signal vitalité de la donnée KOVAS)
  (SELECT max(dhup_last_synced_at) FROM public.diagnosticians)::timestamptz AS last_dhup_sync_at,
  (SELECT count(*) FROM public.diagnosticians
   WHERE dhup_last_synced_at >= now() - interval '7 days')::int AS dhup_synced_last_7d_count;

COMMENT ON VIEW public.v_etat_profession_summary IS
  'GC4 — KPIs publics agrégés diagnostic immobilier (état de la profession FR). Aucune PII exposée.';

GRANT SELECT ON public.v_etat_profession_summary TO anon, authenticated;

-- 2. Vue par département (top 10 densité)
CREATE OR REPLACE VIEW public.v_etat_profession_by_dept
WITH (security_invoker = on)
AS
SELECT
  department_code,
  count(*)::int AS total_count,
  count(*) FILTER (WHERE validation_status = 'verified')::int AS verified_count,
  count(*) FILTER (WHERE sirene_state = 'active')::int AS sirene_active_count,
  count(*) FILTER (WHERE activity_score >= 0.6)::int AS very_active_count,
  count(*) FILTER (WHERE claim_status = 'claimed')::int AS claimed_count,
  round(avg(activity_score)::numeric, 3) AS avg_activity_score
FROM public.diagnosticians
WHERE department_code IS NOT NULL
  AND department_code != ''
GROUP BY department_code
ORDER BY total_count DESC;

COMMENT ON VIEW public.v_etat_profession_by_dept IS
  'GC4 — Distribution diagnostiqueurs par département (cross-validation).';

GRANT SELECT ON public.v_etat_profession_by_dept TO anon, authenticated;
