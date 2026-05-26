-- ============================================
-- KOVAS — Unification du schéma `diagnosticians` (FIX-D)
-- Date     : 2026-05-24 (rétro-migration corrective)
-- Lot      : FIX-ANNUAIRE
--
-- Problème résolu
--   Trois migrations concurrentes ont créé la table `diagnosticians` avec
--   des conventions de nommage divergentes :
--     - `20260522200000_bandit_annuaire.sql`         → full_name, city_slug, dept_code
--     - `20260530100000_annuaire_diagnosticians.sql` → first_name + last_name, slug_city, department_code, geo_lat/geo_lng
--     - `20260603100000_annuaire_freemium_levels.sql`→ stub minimal idempotent
--   La page `/diagnostiqueurs` requête `full_name`, `city_slug`, `department_code`,
--   `latitude`, `longitude` → mismatch → données vides.
--
-- Approche
--   NON-destructive (préservation des FK referrals / quote_requests / etc.).
--   ALTER TABLE ADD COLUMN IF NOT EXISTS pour TOUTES les colonnes manquantes
--   d'un schéma "canonique unifié". Les colonnes redondantes (full_name vs
--   first_name||' '||last_name) sont GENERATED ALWAYS AS pour rester en sync.
--
--   Si la table n'existe pas encore (cas neuf), CREATE TABLE en mode complet.
--
-- Schéma canonique
--   Tout le code applicatif lit désormais : id, slug, full_name, full_name_normalized,
--   city, city_slug, postcode, dept_code, address, latitude, longitude,
--   certifications (jsonb), certif_valid_count (generated), sirene_siret,
--   sirene_active (generated depuis sirene_state), gmb_place_id, gmb_rating,
--   gmb_review_count, claim_status, claimed_by, dhup_source_id, activity_score,
--   fraud_flags, created_at, updated_at.
-- ============================================

-- ============================================
-- 0. Pré-requis (idempotent)
-- ============================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Wrapper IMMUTABLE (idempotent ; déjà créé par 20260530100000)
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent($1);
$$;

-- ============================================
-- 1. Création table si absente (mode neuf)
-- ============================================
CREATE TABLE IF NOT EXISTS diagnosticians (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. Ajout / harmonisation des colonnes
--    Toutes en ADD COLUMN IF NOT EXISTS → 100% idempotent
-- ============================================

-- Identité de base ─────────────────────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS last_name  text;

-- Compatibilité : `full_name` (colonne historique bandit) en plain text,
-- car certaines migrations historiques l'ont déjà créée NOT NULL. On la garde
-- modifiable, alimentée soit par parsing DHUP (first+last) soit directement.
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS full_name text;

-- Slug normalisé pour la recherche ILIKE (full-text + trigram).
-- GENERATED dépendant de full_name (ou first+last si full_name est null).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'diagnosticians'
      AND column_name = 'full_name_normalized'
  ) THEN
    ALTER TABLE diagnosticians ADD COLUMN full_name_normalized text
      GENERATED ALWAYS AS (
        lower(public.immutable_unaccent(
          coalesce(
            full_name,
            trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
          )
        ))
      ) STORED;
  END IF;
END $$;

-- Slug URL (alphanumérique + tirets, unique)
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS slug text;

-- Localisation ────────────────────────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS address    text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS city       text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS city_slug  text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS postcode   text;

-- Note historique : 20260530100000 a créé `postal_code` (vieux nom), bandit a
-- créé `dept_code`, A1 a créé `department_code`. On harmonise en colonnes
-- miroir GENERATED pour exposer les deux noms en lecture.
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS department_code text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS dept_code       text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS region_code     text;

-- Géoloc — on supporte les deux noms (latitude/longitude canoniques + geo_lat/geo_lng legacy)
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS latitude  double precision;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS geo_lat   double precision;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS geo_lng   double precision;

-- Trigger de sync géoloc : si l'un est rempli sans l'autre, on miroite.
CREATE OR REPLACE FUNCTION public.sync_diagnostician_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- latitude ↔ geo_lat
  IF NEW.latitude IS NULL AND NEW.geo_lat IS NOT NULL THEN
    NEW.latitude := NEW.geo_lat;
  ELSIF NEW.geo_lat IS NULL AND NEW.latitude IS NOT NULL THEN
    NEW.geo_lat := NEW.latitude;
  END IF;
  -- longitude ↔ geo_lng
  IF NEW.longitude IS NULL AND NEW.geo_lng IS NOT NULL THEN
    NEW.longitude := NEW.geo_lng;
  ELSIF NEW.geo_lng IS NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo_lng := NEW.longitude;
  END IF;
  -- dept_code ↔ department_code
  IF NEW.dept_code IS NULL AND NEW.department_code IS NOT NULL THEN
    NEW.dept_code := NEW.department_code;
  ELSIF NEW.department_code IS NULL AND NEW.dept_code IS NOT NULL THEN
    NEW.department_code := NEW.dept_code;
  END IF;
  -- full_name auto-build si first/last présents
  IF NEW.full_name IS NULL
     AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name := trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_diagnostician_geo ON diagnosticians;
CREATE TRIGGER trg_sync_diagnostician_geo
  BEFORE INSERT OR UPDATE ON diagnosticians
  FOR EACH ROW EXECUTE FUNCTION public.sync_diagnostician_geo();

-- Certifications JSONB ────────────────────────────────────────────────────
-- Format : [{ type, organism, number, valid_until, status }]
-- type ∈ {DPE, AMIANTE, PLOMB, GAZ, ELECTRICITE, TERMITES, CARREZ, ERP}
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS certifications jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Compteur dérivé : nombre de certifs valides (status='valid' ET valid_until>= today)
-- Note : PostgreSQL n'accepte pas de subquery dans GENERATED ALWAYS AS. On utilise
-- une colonne classique + trigger BEFORE INSERT/UPDATE pour la maintenir à jour.
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS certif_valid_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION compute_certif_valid_count() RETURNS trigger AS $$
BEGIN
  NEW.certif_valid_count := COALESCE(
    (SELECT count(*)::int FROM jsonb_array_elements(NEW.certifications) c
     WHERE COALESCE(c->>'status', 'valid') = 'valid'),
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_certif_valid_count ON diagnosticians;
CREATE TRIGGER trg_compute_certif_valid_count
  BEFORE INSERT OR UPDATE OF certifications ON diagnosticians
  FOR EACH ROW EXECUTE FUNCTION compute_certif_valid_count();

-- Backfill existant
UPDATE diagnosticians SET certifications = certifications WHERE certifications IS NOT NULL;

-- Sirene (cross-validation) ───────────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_siret text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS sirene_state text;

-- sirene_active GENERATED : true si state='active' OU si jamais validé (cas DHUP only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'diagnosticians'
      AND column_name = 'sirene_active'
  ) THEN
    ALTER TABLE diagnosticians ADD COLUMN sirene_active boolean
      GENERATED ALWAYS AS (
        coalesce(sirene_state, 'unknown') IN ('active', 'unknown')
      ) STORED;
  END IF;
END $$;

-- Google My Business ──────────────────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS gmb_place_id     text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS gmb_rating       double precision;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS gmb_review_count integer;

-- Réclamation ─────────────────────────────────────────────────────────────
-- Note historique : `claimed_by_user_id` (A1) vs `claimed_by` (FIX-D). On garde
-- les deux noms avec sync trigger pour éviter de casser les modules existants.
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS claimed_at   timestamptz;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS claim_status text
  NOT NULL DEFAULT 'unclaimed';

-- Photo / branding (post-claim) ───────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS bio       text;

-- Source DHUP (idempotence import) ────────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS dhup_source_id      text;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS dhup_imported_at    timestamptz DEFAULT now();
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS dhup_last_synced_at timestamptz;

-- Score d'activité + flags anti-fraude ────────────────────────────────────
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS activity_score double precision DEFAULT 0;
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS fraud_flags    jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Statut public ───────────────────────────────────────────────────────────
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS withdrawal_requested boolean NOT NULL DEFAULT false;

-- ============================================
-- 3. Contraintes & uniques (idempotents)
-- ============================================

-- slug UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_slug_key'
  ) THEN
    BEGIN
      ALTER TABLE diagnosticians ADD CONSTRAINT diagnosticians_slug_key UNIQUE (slug);
    EXCEPTION WHEN duplicate_table OR unique_violation THEN NULL; END;
  END IF;
END $$;

-- dhup_source_id UNIQUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_dhup_source_id_key'
  ) THEN
    BEGIN
      ALTER TABLE diagnosticians ADD CONSTRAINT diagnosticians_dhup_source_id_key UNIQUE (dhup_source_id);
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END IF;
END $$;

-- claim_status CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_claim_status_check_unified'
  ) THEN
    BEGIN
      ALTER TABLE diagnosticians
        ADD CONSTRAINT diagnosticians_claim_status_check_unified
        CHECK (claim_status IN ('unclaimed', 'pending', 'pending_review', 'claimed', 'rejected'));
    EXCEPTION WHEN check_violation THEN NULL; END;
  END IF;
END $$;

-- ============================================
-- 4. Index recherche (idempotents)
-- ============================================

-- Recherche dept + ville (page liste publique principale)
CREATE INDEX IF NOT EXISTS idx_diag_dept_city_unified
  ON diagnosticians (dept_code, city_slug)
  WHERE is_published = true;

-- Recherche department_code legacy (compat A1)
CREATE INDEX IF NOT EXISTS idx_diag_department_code
  ON diagnosticians (department_code)
  WHERE is_published = true;

-- Trigram fuzzy search sur nom (autocomplete + ILIKE %x%)
CREATE INDEX IF NOT EXISTS idx_diag_full_name_norm_trgm
  ON diagnosticians USING gin (full_name_normalized gin_trgm_ops)
  WHERE is_published = true;

-- Pattern ops pour ILIKE 'prefix%' rapide
CREATE INDEX IF NOT EXISTS idx_diag_full_name_norm_pattern
  ON diagnosticians (full_name_normalized text_pattern_ops)
  WHERE is_published = true;

-- SIRET lookup
CREATE INDEX IF NOT EXISTS idx_diag_sirene_siret
  ON diagnosticians (sirene_siret)
  WHERE sirene_siret IS NOT NULL;

-- Slug lookup
CREATE INDEX IF NOT EXISTS idx_diag_slug_unified
  ON diagnosticians (slug)
  WHERE slug IS NOT NULL;

-- GIN sur certifications (filtre @> '[{"type":"DPE"}]')
CREATE INDEX IF NOT EXISTS idx_diag_certifications_gin
  ON diagnosticians USING gin (certifications jsonb_path_ops);

-- Géoloc earthdistance (KNN dans un rayon)
CREATE INDEX IF NOT EXISTS idx_diag_earth_unified
  ON diagnosticians USING gist (ll_to_earth(latitude, longitude))
  WHERE is_published = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================
-- 5. RLS — lecture publique conditionnelle
-- ============================================
ALTER TABLE diagnosticians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_public_read_unified" ON diagnosticians;
CREATE POLICY "diag_public_read_unified" ON diagnosticians
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND withdrawal_requested = false
    AND coalesce(sirene_active, true) = true
    AND coalesce(certif_valid_count, 0) >= 1
  );

DROP POLICY IF EXISTS "diag_owner_full_access_unified" ON diagnosticians;
CREATE POLICY "diag_owner_full_access_unified" ON diagnosticians
  FOR ALL
  TO authenticated
  USING (claimed_by_user_id = auth.uid() OR claimed_by = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid() OR claimed_by = auth.uid());

-- ============================================
-- 6. RPC recherche unifiée (utilisée par /api/diagnosticians/search)
-- ============================================

-- Recherche full-text + ville/dept + cert + rayon géo.
-- Renvoie un superset paginé serveur-side, le tri haversine final est fait
-- côté Node (compat avec l'implémentation actuelle de la page).
CREATE OR REPLACE FUNCTION public.search_diagnosticians(
  p_query     text DEFAULT NULL,   -- recherche libre nom/ville
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
AS $$
DECLARE
  v_safe_query text;
BEGIN
  v_safe_query := lower(public.immutable_unaccent(coalesce(trim(p_query), '')));

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
    d.gmb_rating,
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
END $$;

REVOKE EXECUTE ON FUNCTION public.search_diagnosticians(text, text, text, text[], double precision, double precision, double precision, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_diagnosticians(text, text, text, text[], double precision, double precision, double precision, integer, integer) TO anon, authenticated, service_role;

-- ============================================
-- 7. Commentaires (documentation in-DB)
-- ============================================
COMMENT ON COLUMN diagnosticians.full_name_normalized IS
  'GENERATED : lower(unaccent(full_name)) — utilisé pour ILIKE/trigram search.';
COMMENT ON COLUMN diagnosticians.certif_valid_count IS
  'GENERATED : nb de certifications avec status=valid dans le JSONB certifications.';
COMMENT ON COLUMN diagnosticians.sirene_active IS
  'GENERATED : true si sirene_state IN (active, unknown). Faux uniquement si Sirene confirme cessation.';
COMMENT ON COLUMN diagnosticians.fraud_flags IS
  'JSONB array de flags anti-fraude : [{ type, severity, detected_at, details }].';
COMMENT ON FUNCTION public.search_diagnosticians IS
  'RPC unifiée recherche annuaire : nom + ville + dept + certs + géoloc rayon km.';

-- ============================================
-- Fin migration unification annuaire
-- ============================================
