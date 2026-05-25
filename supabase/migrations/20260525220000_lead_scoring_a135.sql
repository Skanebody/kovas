-- ============================================================================
-- KOVAS — Algo A1.3.5 : Lead scoring + Thompson sampling (refonte acqui-target)
-- ============================================================================
-- Étend `quote_requests` avec un cache `intent_score` + `intent_bucket` +
-- `intent_signals` (jsonb) calculé côté JS (lib/algos/lead-scoring.ts) mais
-- persistent côté DB pour requêtes filtrées / dashboards.
--
-- Ajoute également une RPC `bandit_thompson_rank` qui combine :
--   1. Filtre géographique (PostGIS, déjà disponible via diagnosticians_within_radius)
--   2. Thompson sampling Beta(alpha, beta) via `bandit_diagnostician_stats`
--
-- Retourne une liste ordonnée de diagnosticians candidats (avec leur sampled
-- score) pour intégration dans la cascade routing existante de route-lead.
--
-- Authority : REFONTE-ACQUI-TARGET-V2 §6.3 (GC3) +
-- .claude/orchestration-kovas-app/algos-acqui-target.md §A1.3.5
-- ============================================================================

-- 1. Cache du score d'intent sur quote_requests
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS intent_score      smallint
    CHECK (intent_score IS NULL OR intent_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS intent_bucket     text
    CHECK (intent_bucket IS NULL OR intent_bucket IN ('spam', 'low', 'mid', 'high', 'premium')),
  ADD COLUMN IF NOT EXISTS intent_signals    jsonb,
  ADD COLUMN IF NOT EXISTS intent_scored_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_quote_requests_intent_bucket
  ON public.quote_requests (intent_bucket, created_at DESC)
  WHERE intent_bucket IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_requests_intent_score
  ON public.quote_requests (intent_score DESC NULLS LAST, created_at DESC)
  WHERE intent_score IS NOT NULL;

COMMENT ON COLUMN public.quote_requests.intent_score IS
  'Algo A1.3.5 — score d''intent 0-100 calculé par lib/algos/lead-scoring.ts';
COMMENT ON COLUMN public.quote_requests.intent_bucket IS
  'Bucket dérivé : spam<0 | low<40 | mid<60 | high<75 | premium>=75';

-- 2. RPC bandit_thompson_rank — sample Beta(α, β) pour une liste de diag candidats
--
-- Implémentation simplifiée : on utilise random() + une approximation Beta via
-- Gamma(α) / (Gamma(α) + Gamma(β)) où Gamma(k) ≈ -ln(1 - random())^k pour k≥1
-- ce qui est l'approximation Wilson-Hilferty inverse. Pour la production,
-- on pourrait câbler la fonction beta_random() de pgrandom mais on évite
-- d'ajouter une extension pour rester dans le périmètre Supabase natif.
--
-- Pour chaque diag dans p_diagnostician_ids, retourne (id, sampled_score),
-- ordonné par sampled_score DESC. NULL = pas de stats encore → score neutre 0.5.
CREATE OR REPLACE FUNCTION public.bandit_thompson_rank(
  p_diagnostician_ids uuid[]
)
RETURNS TABLE (
  diagnostician_id uuid,
  sampled_score    double precision,
  alpha            double precision,
  beta             double precision,
  impressions      integer,
  conversions      integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH inputs AS (
    SELECT unnest(p_diagnostician_ids) AS diag_id
  ),
  stats AS (
    SELECT
      i.diag_id,
      COALESCE(s.alpha, 1.0) AS alpha,
      COALESCE(s.beta, 1.0) AS beta,
      COALESCE(s.impressions, 0) AS impressions,
      COALESCE(s.conversions, 0) AS conversions
    FROM inputs i
    LEFT JOIN public.bandit_diagnostician_stats s ON s.diagnostician_id = i.diag_id
  ),
  samples AS (
    SELECT
      diag_id,
      alpha,
      beta,
      impressions,
      conversions,
      -- Beta(α, β) ≈ Gamma(α) / (Gamma(α) + Gamma(β))
      -- Gamma(k) ≈ Σ -ln(u_i) for i=1..k. On approxime par k * -ln(random()).
      -- Suffisant pour ranking (pas pour estimer la densité absolue).
      (alpha * -ln(GREATEST(random(), 1e-9))) /
      NULLIF(alpha * -ln(GREATEST(random(), 1e-9)) + beta * -ln(GREATEST(random(), 1e-9)), 0)
      AS sampled_score
    FROM stats
  )
  SELECT
    s.diag_id,
    COALESCE(s.sampled_score, 0.5) AS sampled_score,
    s.alpha,
    s.beta,
    s.impressions,
    s.conversions
  FROM samples s
  ORDER BY sampled_score DESC NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bandit_thompson_rank(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bandit_thompson_rank(uuid[]) TO service_role, authenticated;

COMMENT ON FUNCTION public.bandit_thompson_rank(uuid[]) IS
  'Algo A1.3.5 — classe une liste de diagnosticians par échantillonnage Thompson Beta(α,β). Appelée par Edge Function route-lead après le filtre géographique.';

-- 3. Helper RPC : combine PostGIS within_radius + Thompson ranking
--
-- Cas d'usage : Edge Function route-lead reçoit lat/lng + radius + n_target,
-- veut récupérer top N diag dans le rayon, ordonnés Thompson.
CREATE OR REPLACE FUNCTION public.route_lead_rank_candidates(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer DEFAULT 30,
  p_limit integer DEFAULT 5,
  p_only_subscribed boolean DEFAULT false
)
RETURNS TABLE (
  diagnostician_id uuid,
  distance_km double precision,
  sampled_score double precision,
  activity_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_ids uuid[];
BEGIN
  -- 1. Filtre géographique élargi (3x le rayon cible pour avoir une marge de Thompson)
  SELECT COALESCE(array_agg(d.id), ARRAY[]::uuid[]) INTO v_candidate_ids
  FROM public.diagnosticians d
  WHERE d.is_active = true
    AND d.geo_lat IS NOT NULL
    AND d.geo_lng IS NOT NULL
    -- Distance brute en km via Haversine (st_distance plus précis si PostGIS dispo)
    AND (
      6371 * acos(
        LEAST(1.0,
          cos(radians(p_lat)) * cos(radians(d.geo_lat)) *
          cos(radians(d.geo_lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(d.geo_lat))
        )
      )
    ) <= (p_radius_km * 1.5)
    AND (NOT p_only_subscribed OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.organization_id = d.organization_id
        AND s.status IN ('active', 'trialing')
    ));

  -- 2. Thompson rank sur les candidats, puis filtre rayon strict + limit
  RETURN QUERY
  WITH ranked AS (
    SELECT
      r.diagnostician_id,
      r.sampled_score
    FROM public.bandit_thompson_rank(v_candidate_ids) r
  )
  SELECT
    d.id AS diagnostician_id,
    (
      6371 * acos(
        LEAST(1.0,
          cos(radians(p_lat)) * cos(radians(d.geo_lat)) *
          cos(radians(d.geo_lng) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(d.geo_lat))
        )
      )
    )::double precision AS distance_km,
    r.sampled_score,
    d.activity_score
  FROM ranked r
  JOIN public.diagnosticians d ON d.id = r.diagnostician_id
  WHERE (
    6371 * acos(
      LEAST(1.0,
        cos(radians(p_lat)) * cos(radians(d.geo_lat)) *
        cos(radians(d.geo_lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(d.geo_lat))
      )
    )
  ) <= p_radius_km
  ORDER BY r.sampled_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.route_lead_rank_candidates(
  double precision, double precision, integer, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_lead_rank_candidates(
  double precision, double precision, integer, integer, boolean
) TO service_role;

COMMENT ON FUNCTION public.route_lead_rank_candidates(
  double precision, double precision, integer, integer, boolean
) IS
  'Algo A1.3.5 — pipeline filtre géo + Thompson ranking. Appelé par Edge Function route-lead pour cascade A (subscribed) puis B/C (claimed/onboarding) le cas échéant.';
