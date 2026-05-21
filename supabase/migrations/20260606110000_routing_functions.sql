-- ============================================
-- KOVAS Annuaire — Fonctions de routage géographique
-- Date : 2026-06-06
-- Mission : exposer 3 fonctions SQL pour le moteur de matching
--           particulier ↔ diagnostiqueur :
--             - subscribed_nearby      → leads payants prioritaires
--             - claimed_non_subscribed → cible d'upsell ciblé
--             - eligible_onboarding    → ghosts à activer (badge cadeau)
--
-- Convention de naming : KOVAS Annuaire (B2C) + KOVAS 360 (B2B SaaS).
-- Société éditrice SASU NEXUS 1993.
--
-- Table subscription utilisée : `subscriptions` (clé `organization_id`).
-- Lien user → org via `memberships (user_id, organization_id, status='active')`.
-- ============================================

-- ============================================
-- 1. Fonction distance_km (haversine)
-- ============================================
-- IMMUTABLE : autorise utilisation dans index et expressions GENERATED.
-- Formule haversine, rayon terrestre = 6371 km.

CREATE OR REPLACE FUNCTION public.distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT 2 * 6371 * asin(
    sqrt(
      sin(radians((lat2 - lat1) / 2)) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2))
      * sin(radians((lng2 - lng1) / 2)) ^ 2
    )
  );
$$;

COMMENT ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision) IS
  'Distance haversine en km entre deux coordonnées WGS84. IMMUTABLE, indexable.';

-- ============================================
-- 2. find_subscribed_diagnosticians_nearby
-- ============================================
-- Diagnostiqueurs réclamés + abonnés actifs KOVAS 360, certifiés pour le
-- type de diagnostic demandé, dans un rayon donné. Ordre : score d'activité
-- décroissant, puis distance croissante.

CREATE OR REPLACE FUNCTION public.find_subscribed_diagnosticians_nearby(
  p_lat                double precision,
  p_lng                double precision,
  p_radius_km          int,
  p_certification_type text,
  p_limit              int DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  full_name       text,
  distance_km     double precision,
  activity_score  int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    (d.first_name || ' ' || d.last_name) AS full_name,
    public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) AS distance_km,
    d.activity_score
  FROM diagnosticians d
  WHERE d.is_published = true
    AND d.validation_status = 'verified'
    AND d.claim_status = 'claimed'
    AND d.geo_lat IS NOT NULL
    AND d.geo_lng IS NOT NULL
    AND public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) <= p_radius_km
    AND EXISTS (
      SELECT 1
      FROM diagnostician_certifications c
      WHERE c.diagnostician_id = d.id
        AND c.certification_type = p_certification_type
        AND c.status = 'valid'
    )
    AND EXISTS (
      SELECT 1
      FROM memberships m
      JOIN subscriptions s ON s.organization_id = m.organization_id
      WHERE m.user_id = d.claimed_by_user_id
        AND m.status = 'active'
        AND s.status = 'active'
    )
  ORDER BY d.activity_score DESC NULLS LAST,
           public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) ASC
  LIMIT p_limit;
END $$;

COMMENT ON FUNCTION public.find_subscribed_diagnosticians_nearby(double precision, double precision, int, text, int) IS
  'Routage Annuaire : diagnostiqueurs vérifiés + réclamés + abonnés KOVAS 360 actifs, certifiés pour p_certification_type, dans p_radius_km.';

-- ============================================
-- 3. find_claimed_non_subscribed_nearby
-- ============================================
-- Diagnostiqueurs ayant réclamé leur fiche mais SANS abonnement actif.
-- Cible "upsell" : on peut leur envoyer "Vous ratez X leads/mois sur votre zone".

CREATE OR REPLACE FUNCTION public.find_claimed_non_subscribed_nearby(
  p_lat                double precision,
  p_lng                double precision,
  p_radius_km          int,
  p_certification_type text,
  p_limit              int DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  full_name       text,
  distance_km     double precision,
  activity_score  int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    (d.first_name || ' ' || d.last_name) AS full_name,
    public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) AS distance_km,
    d.activity_score
  FROM diagnosticians d
  WHERE d.is_published = true
    AND d.validation_status = 'verified'
    AND d.claim_status = 'claimed'
    AND d.geo_lat IS NOT NULL
    AND d.geo_lng IS NOT NULL
    AND public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) <= p_radius_km
    AND EXISTS (
      SELECT 1
      FROM diagnostician_certifications c
      WHERE c.diagnostician_id = d.id
        AND c.certification_type = p_certification_type
        AND c.status = 'valid'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM memberships m
      JOIN subscriptions s ON s.organization_id = m.organization_id
      WHERE m.user_id = d.claimed_by_user_id
        AND m.status = 'active'
        AND s.status = 'active'
    )
  ORDER BY d.activity_score DESC NULLS LAST,
           public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) ASC
  LIMIT p_limit;
END $$;

COMMENT ON FUNCTION public.find_claimed_non_subscribed_nearby(double precision, double precision, int, text, int) IS
  'Cible upsell : diagnostiqueurs réclamés mais sans abonnement KOVAS 360 actif sur la zone.';

-- ============================================
-- 4. find_eligible_for_onboarding_gift
-- ============================================
-- Fiches encore non réclamées (ghost lifecycle) mais validées (ou en
-- pending), non désabonnées de la pré-notification : candidats à un
-- onboarding "cadeau" (badge premium / Forfait Découverte offert N mois).

CREATE OR REPLACE FUNCTION public.find_eligible_for_onboarding_gift(
  p_lat                double precision,
  p_lng                double precision,
  p_radius_km          int,
  p_certification_type text,
  p_limit              int DEFAULT 3
)
RETURNS TABLE (
  id              uuid,
  full_name       text,
  distance_km     double precision,
  activity_score  int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    (d.first_name || ' ' || d.last_name) AS full_name,
    public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) AS distance_km,
    d.activity_score
  FROM diagnosticians d
  WHERE d.is_published = true
    AND d.claim_status = 'unclaimed'
    AND d.validation_status IN ('verified', 'pending')
    AND d.unsubscribed = false
    AND d.geo_lat IS NOT NULL
    AND d.geo_lng IS NOT NULL
    AND public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) <= p_radius_km
    AND EXISTS (
      SELECT 1
      FROM diagnostician_certifications c
      WHERE c.diagnostician_id = d.id
        AND c.certification_type = p_certification_type
        AND c.status = 'valid'
    )
  ORDER BY d.activity_score DESC NULLS LAST,
           public.distance_km(p_lat, p_lng, d.geo_lat, d.geo_lng) ASC
  LIMIT p_limit;
END $$;

COMMENT ON FUNCTION public.find_eligible_for_onboarding_gift(double precision, double precision, int, text, int) IS
  'Cible onboarding cadeau : fiches non réclamées mais validées, non opt-out, candidates au lead gratuit + invitation.';

-- ============================================
-- 5. GRANT EXECUTE
-- ============================================
-- distance_km : utilitaire pur, accessible à tous (y compris anon pour
-- ranking côté client si besoin).
GRANT EXECUTE ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision)
  TO anon, authenticated, service_role;

-- Fonctions de routage : authentifié (admin / backend) + service_role.
-- Les endpoints publics côté Edge Functions appellent ces fonctions
-- depuis le service_role pour bypasser RLS sur memberships/subscriptions.
GRANT EXECUTE ON FUNCTION public.find_subscribed_diagnosticians_nearby(double precision, double precision, int, text, int)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.find_claimed_non_subscribed_nearby(double precision, double precision, int, text, int)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.find_eligible_for_onboarding_gift(double precision, double precision, int, text, int)
  TO authenticated, service_role;
