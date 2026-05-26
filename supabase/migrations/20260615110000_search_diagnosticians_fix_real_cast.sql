-- ============================================================
-- KOVAS — Fix RPC search_diagnosticians : type mismatch gmb_rating
-- ============================================================
--
-- BUG CONSTATÉ en prod (2026-05-26) :
-- ERROR 42804 — structure of query does not match function result type
-- DETAIL: Returned type real does not match expected type double precision
--         in column 10.
--
-- ROOT CAUSE :
-- - La colonne `diagnosticians.gmb_rating` est de type `real` (float4).
-- - La signature de la RPC déclare le retour `gmb_rating double precision`.
-- - PostgreSQL refuse l'élargissement implicite real → double precision
--   dans un RETURNS TABLE (strict type matching).
--
-- CONSÉQUENCE : la RPC échoue à tous les appels → /trouver-un-diagnostiqueur
-- renvoie 0 résultat sur n'importe quelle adresse (le SELECT crashe avant
-- même de filtrer).
--
-- FIX : cast explicite `d.gmb_rating::double precision` dans le SELECT.
-- Aucun breaking change côté code TS / signatures publiques.
--
-- IDÉE PRINCIPALE : on ne touche pas la column type (real est OK pour
-- des notes 0.0-5.0) ni la signature publique de la RPC. Seul le cast
-- explicite est ajouté.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.search_diagnosticians(
  p_query text DEFAULT NULL::text,
  p_city_slug text DEFAULT NULL::text,
  p_dept_code text DEFAULT NULL::text,
  p_certs text[] DEFAULT NULL::text[],
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_radius_km double precision DEFAULT 30,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  full_name text,
  city text,
  city_slug text,
  department_code text,
  postcode text,
  certifications jsonb,
  certif_valid_count integer,
  gmb_rating double precision,
  gmb_review_count integer,
  claim_status text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_safe_query text := lower(public.immutable_unaccent(coalesce(p_query, '')));
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.slug,
    coalesce(d.full_name, trim(coalesce(d.first_name, '') || ' ' || coalesce(d.last_name, ''))) AS full_name,
    d.city,
    d.city_slug,
    coalesce(d.department_code, d.dept_code) AS department_code,
    d.postcode,
    d.certifications,
    d.certif_valid_count,
    -- FIX (2026-05-26) : cast real → double precision (la colonne est `real`
    -- dans la table mais la signature attend `double precision`).
    d.gmb_rating::double precision AS gmb_rating,
    d.gmb_review_count,
    d.claim_status,
    d.photo_url,
    d.latitude,
    d.longitude,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
           AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
      THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(d.latitude, d.longitude)) / 1000.0
      ELSE NULL
    END AS distance_km,
    d.created_at
  FROM diagnosticians d
  WHERE d.is_published = true
    AND d.withdrawal_requested = false
    AND coalesce(d.certif_valid_count, 0) >= 1
    -- Filtre dept
    AND (p_dept_code IS NULL OR coalesce(d.department_code, d.dept_code) = p_dept_code)
    -- Filtre ville (slug strict OU ilike partiel sur city)
    AND (
      p_city_slug IS NULL
      OR d.city_slug = p_city_slug
      OR lower(public.immutable_unaccent(coalesce(d.city, ''))) ILIKE '%' || lower(public.immutable_unaccent(p_city_slug)) || '%'
    )
    -- Filtre certifications (au moins une parmi celles demandées)
    AND (
      p_certs IS NULL OR array_length(p_certs, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(d.certifications) c
        WHERE c->>'type' = ANY(p_certs)
          AND coalesce(c->>'status', 'valid') = 'valid'
      )
    )
    -- Filtre full-text sur nom/ville
    AND (
      v_safe_query = ''
      OR d.full_name_normalized ILIKE '%' || v_safe_query || '%'
      OR lower(public.immutable_unaccent(coalesce(d.city, ''))) ILIKE '%' || v_safe_query || '%'
    )
    -- Filtre géo (bounding box rapide + earth_distance précise)
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR (
        d.latitude IS NOT NULL AND d.longitude IS NOT NULL
        AND earth_box(ll_to_earth(p_lat, p_lng), p_radius_km * 1000) @> ll_to_earth(d.latitude, d.longitude)
        AND earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(d.latitude, d.longitude)) <= p_radius_km * 1000
      )
    )
  ORDER BY
    (d.claim_status = 'claimed') DESC,
    CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
         THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(d.latitude, d.longitude))
         ELSE NULL
    END ASC NULLS LAST,
    d.gmb_rating DESC NULLS LAST,
    d.activity_score DESC NULLS LAST,
    d.created_at DESC
  LIMIT GREATEST(1, p_limit)
  OFFSET GREATEST(0, p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_diagnosticians(text, text, text, text[], double precision, double precision, double precision, integer, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_diagnosticians IS
  'KOVAS — Recherche dans l''annuaire public. Fix 2026-05-26 : cast gmb_rating real → double precision pour matcher la signature RETURNS TABLE.';

COMMIT;
