-- ============================================================================
-- KOVAS — Lot B55 : route_lead_rank_candidates Haversine → PostGIS ST_DWithin
-- ============================================================================
-- Migration de perf qui remplace la formule Haversine maison de la RPC
-- `route_lead_rank_candidates` (créée par 20260525220000_lead_scoring_a135.sql)
-- par `ST_DWithin(geography, geography, meters)` PostGIS.
--
-- Pourquoi :
--   1. PostGIS est déjà installé (3.3.7 prod), utilisé par
--      `data.properties_unified.geom` et `diagnosticians_within_radius`.
--   2. `ST_DWithin` sur `geography` est plus précis (modèle ellipsoïde WGS84)
--      que Haversine sphérique, et peut bénéficier d'un index GIST expression.
--   3. Acos+sqrt déroulés par expression devient cher au-delà de quelques k
--      diagnosticians — on prépare la croissance à 13k+ diag FR.
--
-- Note schéma : la table `public.diagnosticians` n'a PAS de colonne `geom`
-- (vs `data.properties_unified`). On a `geo_lat` / `geo_lng` double precision.
-- On calcule donc `ST_MakePoint(geo_lng, geo_lat)::geography` à la volée +
-- on ajoute un index expression GIST pour que ST_DWithin l'utilise.
--
-- Compat appelants : la signature exacte (5 paramètres positionnels + 4 colonnes
-- retour) est préservée pour les Edge Functions / route handlers existants
-- (cf. `route-lead` Edge Function — aucun changement requis côté caller).
--
-- Authority : docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md §9.2 anomalie #3
-- ============================================================================

-- 1. Index GIST expression sur (ST_MakePoint(geo_lng, geo_lat)::geography)
--
-- ST_MakePoint + cast geography est IMMUTABLE → indexable comme expression.
-- Le filtre `is_active = true` + `geo_lat/lng IS NOT NULL` est porté par un
-- predicate index partiel pour réduire la taille de l'index.
CREATE INDEX IF NOT EXISTS idx_diagnosticians_geog_active
  ON public.diagnosticians
  USING GIST ((ST_MakePoint(geo_lng, geo_lat)::geography))
  WHERE geo_lat IS NOT NULL
    AND geo_lng IS NOT NULL;

COMMENT ON INDEX public.idx_diagnosticians_geog_active IS
  'Lot B55 — index GIST expression pour ST_DWithin (geography) utilisé par route_lead_rank_candidates. Partiel sur diagnosticians actifs avec coordonnées.';

-- 2. Réécriture de la RPC avec ST_DWithin + ST_Distance (PostGIS)
--
-- Signature inchangée :
--   (p_lat float8, p_lng float8, p_radius_km int=30, p_limit int=5, p_only_subscribed bool=false)
-- Colonnes retour inchangées :
--   (diagnostician_id uuid, distance_km float8, sampled_score float8, activity_score int)
--
-- Algo (identique conceptuellement à l'original) :
--   1. Filtre géo élargi (1.5 × p_radius_km) via ST_DWithin pour avoir une
--      marge de candidats avant le Thompson sampling.
--   2. Thompson rank via `bandit_thompson_rank` sur les candidats.
--   3. Filtre rayon strict + ORDER BY sampled_score DESC + LIMIT p_limit.
--   4. distance_km = ST_Distance(...) / 1000 (mètres → km).
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
SET search_path = public, extensions
AS $$
DECLARE
  v_candidate_ids uuid[];
  v_property_geog geography;
  v_radius_strict_m double precision;
  v_radius_loose_m double precision;
BEGIN
  -- Bornes paramètres (garde-fous)
  v_radius_strict_m := GREATEST(p_radius_km, 1)::double precision * 1000.0;
  v_radius_loose_m  := v_radius_strict_m * 1.5;
  v_property_geog   := ST_MakePoint(p_lng, p_lat)::geography;

  -- 1. Filtre géographique élargi (1.5x rayon cible) via ST_DWithin
  --    L'index idx_diagnosticians_geog_active permet le bbox-prefilter GIST.
  SELECT COALESCE(array_agg(d.id), ARRAY[]::uuid[]) INTO v_candidate_ids
  FROM public.diagnosticians d
  WHERE d.geo_lat IS NOT NULL
    AND d.geo_lng IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(d.geo_lng, d.geo_lat)::geography,
      v_property_geog,
      v_radius_loose_m
    )
    AND (NOT p_only_subscribed OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.organization_id = d.organization_id
        AND s.status IN ('active', 'trialing')
    ));

  -- 2. Thompson rank sur les candidats, filtre rayon strict + limit
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
      ST_Distance(
        ST_MakePoint(d.geo_lng, d.geo_lat)::geography,
        v_property_geog
      ) / 1000.0
    )::double precision AS distance_km,
    r.sampled_score,
    d.activity_score
  FROM ranked r
  JOIN public.diagnosticians d ON d.id = r.diagnostician_id
  WHERE ST_DWithin(
    ST_MakePoint(d.geo_lng, d.geo_lat)::geography,
    v_property_geog,
    v_radius_strict_m
  )
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
  'Algo A1.3.5 (Lot B55) — pipeline filtre géo PostGIS ST_DWithin + Thompson ranking. Appelé par Edge Function route-lead pour cascade A (subscribed) puis B/C (claimed/onboarding). Migration Haversine → ST_DWithin pour perf à 13k+ diagnostiqueurs FR.';
