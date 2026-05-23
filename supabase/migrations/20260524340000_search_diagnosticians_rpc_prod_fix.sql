-- FIX recherche annuaire : RPC search_diagnosticians adaptée au schéma prod réel.
--
-- La migration 20260524110000_diagnosticians_unified.sql avait planté en prod
-- sur les colonnes generated absentes (full_name_normalized, certif_valid_count,
-- first_name, last_name). Résultat : la RPC n'était pas créée → recherche par
-- adresse cassée sur /trouver-un-diagnostiqueur (fallback table query inadéquat).
--
-- Cette migration :
--   1. Recrée la RPC sans dépendance aux colonnes generated manquantes.
--   2. Calcule certif_valid_count + full_name_normalized au runtime via jsonb +
--      immutable_unaccent (légère pénalité perf mais OK à ~13k diagnostiqueurs).
--   3. Fallback latitude/longitude via geo_lat/geo_lng pour compat schéma legacy.
--   4. Ajoute la recherche full-text sur address + postcode (pour matching adresse
--      complète depuis l'autocomplétion BAN).
--
-- À régénérer proprement une fois les colonnes generated ajoutées (migration
-- consolidate ALTER TABLE ADD COLUMN GENERATED ALWAYS AS ... STORED).

CREATE OR REPLACE FUNCTION public.search_diagnosticians(
  p_query     text DEFAULT NULL,
  p_city_slug text DEFAULT NULL,
  p_dept_code text DEFAULT NULL,
  p_certs     text[] DEFAULT NULL,
  p_lat       double precision DEFAULT NULL,
  p_lng       double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 30,
  p_limit     integer DEFAULT 24,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  id                 uuid,
  slug               text,
  full_name          text,
  city               text,
  city_slug          text,
  department_code    text,
  postcode           text,
  certifications     jsonb,
  certif_valid_count integer,
  gmb_rating         double precision,
  gmb_review_count   integer,
  claim_status       text,
  photo_url          text,
  latitude           double precision,
  longitude          double precision,
  distance_km        double precision,
  created_at         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_safe_query text;
BEGIN
  v_safe_query := lower(public.immutable_unaccent(coalesce(trim(p_query), '')));

  RETURN QUERY
  SELECT
    d.id,
    d.slug,
    d.full_name,
    d.city,
    d.city_slug,
    coalesce(d.department_code, d.dept_code) AS department_code,
    d.postcode,
    coalesce(d.certifications, '[]'::jsonb) AS certifications,
    coalesce((
      SELECT count(*)::int FROM jsonb_array_elements(coalesce(d.certifications,'[]'::jsonb)) c
      WHERE coalesce(c->>'status','valid') = 'valid'
    ), 0) AS certif_valid_count,
    d.gmb_rating::double precision,
    d.gmb_review_count,
    d.claim_status,
    d.photo_url,
    coalesce(d.latitude, d.geo_lat) AS latitude,
    coalesce(d.longitude, d.geo_lng) AS longitude,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
           AND coalesce(d.latitude, d.geo_lat) IS NOT NULL
           AND coalesce(d.longitude, d.geo_lng) IS NOT NULL
      THEN earth_distance(
              ll_to_earth(p_lat, p_lng),
              ll_to_earth(coalesce(d.latitude, d.geo_lat), coalesce(d.longitude, d.geo_lng))
           ) / 1000.0
      ELSE NULL
    END AS distance_km,
    d.created_at
  FROM diagnosticians d
  WHERE coalesce(d.is_published, true) = true
    AND coalesce(d.withdrawal_requested, false) = false
    AND coalesce(jsonb_array_length(coalesce(d.certifications,'[]'::jsonb)), 0) >= 1
    AND (p_dept_code IS NULL OR coalesce(d.department_code, d.dept_code) = p_dept_code)
    AND (
      p_city_slug IS NULL
      OR d.city_slug = p_city_slug
      OR lower(public.immutable_unaccent(coalesce(d.city, ''))) ILIKE '%' || lower(public.immutable_unaccent(p_city_slug)) || '%'
    )
    AND (
      p_certs IS NULL OR array_length(p_certs, 1) IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(d.certifications,'[]'::jsonb)) c
        WHERE c->>'type' = ANY(p_certs)
          AND coalesce(c->>'status', 'valid') = 'valid'
      )
    )
    AND (
      v_safe_query = ''
      OR lower(public.immutable_unaccent(coalesce(d.full_name, ''))) ILIKE '%' || v_safe_query || '%'
      OR lower(public.immutable_unaccent(coalesce(d.city, ''))) ILIKE '%' || v_safe_query || '%'
      OR lower(public.immutable_unaccent(coalesce(d.address, ''))) ILIKE '%' || v_safe_query || '%'
      OR coalesce(d.postcode, '') ILIKE v_safe_query || '%'
    )
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR (
        coalesce(d.latitude, d.geo_lat) IS NOT NULL
        AND coalesce(d.longitude, d.geo_lng) IS NOT NULL
        AND earth_box(ll_to_earth(p_lat, p_lng), p_radius_km * 1000)
            @> ll_to_earth(coalesce(d.latitude, d.geo_lat), coalesce(d.longitude, d.geo_lng))
        AND earth_distance(
              ll_to_earth(p_lat, p_lng),
              ll_to_earth(coalesce(d.latitude, d.geo_lat), coalesce(d.longitude, d.geo_lng))
            ) <= p_radius_km * 1000
      )
    )
  ORDER BY
    (d.claim_status = 'claimed') DESC,
    CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
              AND coalesce(d.latitude, d.geo_lat) IS NOT NULL
              AND coalesce(d.longitude, d.geo_lng) IS NOT NULL
         THEN earth_distance(
                ll_to_earth(p_lat, p_lng),
                ll_to_earth(coalesce(d.latitude, d.geo_lat), coalesce(d.longitude, d.geo_lng))
              )
         ELSE NULL
    END ASC NULLS LAST,
    d.gmb_rating DESC NULLS LAST,
    d.activity_score DESC NULLS LAST,
    d.created_at DESC
  LIMIT GREATEST(1, p_limit)
  OFFSET GREATEST(0, p_offset);
END $func$;

REVOKE EXECUTE ON FUNCTION public.search_diagnosticians(text, text, text, text[], double precision, double precision, double precision, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_diagnosticians(text, text, text, text[], double precision, double precision, double precision, integer, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_diagnosticians IS
  'RPC unifiée recherche annuaire (texte / ville / dept / certs / géoloc rayon km). Adaptée au schéma prod réel (sans colonnes generated). Migration 20260524340000 fix recherche par adresse cassée.';
