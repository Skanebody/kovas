-- ============================================
-- KOVAS — Fondation Annuaire diagnostiqueurs publics
-- Date : 2026-05-30
-- Mission A1 : import data.gouv.fr DHUP "annuaire des diagnostiqueurs
--              immobiliers certifiés" (Ministère du Logement, Etalab 2.0)
-- Cible : ~13 000 diagnostiqueurs FR certifiés
-- ============================================

-- ============================================
-- 0. Extensions PostgreSQL (idempotent)
-- ============================================
-- unaccent  : normalisation full_name (insensible aux accents)
-- cube      : pré-requis earthdistance pour ll_to_earth(lat, lng)
-- earthdistance : index GIST géo + KNN distance km
-- pg_trgm   : fuzzy search (déjà installé via init_schema mais idempotent)
-- postgis   : déjà installé (init_schema) — non utilisé ici (earthdistance suffit, plus léger)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. Wrapper IMMUTABLE pour unaccent (pré-requis index GENERATED + GIN)
-- ============================================
-- unaccent() est STABLE par défaut → inutilisable dans GENERATED ALWAYS AS STORED.
-- Wrapper IMMUTABLE recommandé par la doc Supabase / PostgreSQL pour ce cas précis.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT unaccent('public.unaccent', $1);
$$;

-- ============================================
-- 2. Table diagnosticians (idempotente)
-- ============================================
CREATE TABLE IF NOT EXISTS diagnosticians (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité (depuis DHUP)
  first_name                  text NOT NULL,
  last_name                   text NOT NULL,
  full_name_normalized        text GENERATED ALWAYS AS (
    lower(public.immutable_unaccent(first_name || ' ' || last_name))
  ) STORED,

  -- Localisation
  city                        text NOT NULL,
  postal_code                 text,
  department_code             text NOT NULL,  -- '76', '13', '2A', '971'…
  region_code                 text,
  geo_lat                     double precision,
  geo_lng                     double precision,

  -- Certifications (JSONB array)
  -- Format : [{ type: 'DPE'|'AMIANTE'|'PLOMB'|'GAZ'|'ELECTRICITE'|'TERMITES'|'CARREZ'|'ERP',
  --             organism: 'BUREAU_VERITAS' | 'AFNOR' | 'I_CERT' | ...,
  --             number: 'CPDI4123', valid_until: 'YYYY-MM-DD', status: 'valid'|'expired'|'suspended' }]
  certifications              jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Contact officiel (depuis DHUP, peut être null)
  official_email              text,
  official_phone              text,                    -- format E.164
  official_company_name       text,

  -- Sirene (depuis appariement INSEE optionnel)
  sirene_siret                text,
  sirene_naf_code             text,

  -- URLs SEO
  slug                        text NOT NULL,           -- 'benjamin-bel-76200'
  slug_city                   text NOT NULL,           -- 'dieppe'
  slug_dept                   text NOT NULL,           -- 'seine-maritime'
  public_page_url             text GENERATED ALWAYS AS (
    '/diagnostiqueurs/' || slug_dept || '/' || slug_city || '/' || slug
  ) STORED,

  -- Statut public
  is_indexable                boolean NOT NULL DEFAULT true,
  is_published                boolean NOT NULL DEFAULT true,
  withdrawal_requested        boolean NOT NULL DEFAULT false,
  withdrawal_requested_at     timestamptz,

  -- Réclamation par utilisateur KOVAS
  claimed_by_user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at                  timestamptz,
  claim_status                text NOT NULL DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'claimed', 'rejected')),

  -- Enrichissements (post-claim, par utilisateur)
  photo_url                   text,
  bio                         text,
  pricing_indicative          jsonb,                    -- { dpe: {min,max}, amiante: {min,max}, ... }
  services_offered            text[],
  intervention_radius_km      int,
  availability_lead_time_days int,                       -- "48" = sous 48h

  -- Google My Business
  gmb_place_id                text,
  gmb_review_count            int,
  gmb_rating                  numeric(2, 1),

  -- Source data DHUP
  dhup_source_id              text,                     -- ID source dans DHUP (idempotence import)
  dhup_imported_at            timestamptz NOT NULL DEFAULT now(),
  dhup_last_synced_at         timestamptz,

  -- RGPD : emails pré-notification (avant publication / claim)
  pre_notification_email_sent_at    timestamptz,
  pre_notification_email_2_sent_at  timestamptz,
  pre_notification_email_3_sent_at  timestamptz,
  unsubscribed                boolean NOT NULL DEFAULT false,
  unsubscribed_at             timestamptz,

  -- Stats consultation publique
  view_count                  int NOT NULL DEFAULT 0,
  quote_request_count         int NOT NULL DEFAULT 0,

  -- Audit
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Contrainte unicité slug — ajoutée séparément pour rester idempotent sur table déjà créée
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_slug_key'
  ) THEN
    ALTER TABLE diagnosticians ADD CONSTRAINT diagnosticians_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Contrainte unicité dhup_source_id (pour upsert idempotent par import)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'diagnosticians_dhup_source_id_key'
  ) THEN
    ALTER TABLE diagnosticians
      ADD CONSTRAINT diagnosticians_dhup_source_id_key UNIQUE (dhup_source_id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- ============================================
-- 3. Index (idempotents)
-- ============================================

-- Recherche par département + ville (page liste publique)
CREATE INDEX IF NOT EXISTS idx_diag_dept_city
  ON diagnosticians (department_code, slug_city)
  WHERE is_published = true;

-- Géoloc : index earthdistance KNN (ll_to_earth)
CREATE INDEX IF NOT EXISTS idx_diag_geo
  ON diagnosticians USING gist (ll_to_earth(geo_lat, geo_lng))
  WHERE is_published = true AND geo_lat IS NOT NULL AND geo_lng IS NOT NULL;

-- Recherche full-text français sur nom normalisé
CREATE INDEX IF NOT EXISTS idx_diag_search
  ON diagnosticians USING gin (to_tsvector('french', full_name_normalized))
  WHERE is_published = true;

-- Trigram fuzzy search (autocomplete nom)
CREATE INDEX IF NOT EXISTS idx_diag_name_trgm
  ON diagnosticians USING gin (full_name_normalized gin_trgm_ops)
  WHERE is_published = true;

-- Queue réclamation (admin + cron pré-notification)
CREATE INDEX IF NOT EXISTS idx_diag_claim
  ON diagnosticians (claim_status, dhup_imported_at)
  WHERE claim_status = 'unclaimed';

-- Lookup user → fiches réclamées
CREATE INDEX IF NOT EXISTS idx_diag_user
  ON diagnosticians (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

-- Idempotence import DHUP (cron mensuel)
CREATE INDEX IF NOT EXISTS idx_diag_dhup_source
  ON diagnosticians (dhup_source_id)
  WHERE dhup_source_id IS NOT NULL;

-- ============================================
-- 4. Row Level Security
-- ============================================
ALTER TABLE diagnosticians ENABLE ROW LEVEL SECURITY;

-- Lecture publique : uniquement fiches publiées + non retirées
DROP POLICY IF EXISTS "public read published" ON diagnosticians;
CREATE POLICY "public read published" ON diagnosticians
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true AND withdrawal_requested = false);

-- Owner (utilisateur ayant réclamé) : accès complet sur sa fiche
DROP POLICY IF EXISTS "owner full access" ON diagnosticians;
CREATE POLICY "owner full access" ON diagnosticians
  FOR ALL
  TO authenticated
  USING (claimed_by_user_id = auth.uid())
  WITH CHECK (claimed_by_user_id = auth.uid());

-- ============================================
-- 5. Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.touch_diagnosticians_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_diagnosticians_updated_at ON diagnosticians;
CREATE TRIGGER trg_diagnosticians_updated_at
  BEFORE UPDATE ON diagnosticians
  FOR EACH ROW EXECUTE FUNCTION public.touch_diagnosticians_updated_at();

-- ============================================
-- 6. Helper : génération slug unique
-- ============================================
-- Génère 'prenom-nom-codepostal' (slug-safe lowercase + tirets).
-- Suffixe -1, -2, … en cas de collision.
CREATE OR REPLACE FUNCTION public.generate_unique_diag_slug(
  p_first text,
  p_last  text,
  p_postal text
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base      text;
  candidate text;
  counter   int := 0;
BEGIN
  -- Normalisation : minuscule, sans accent, ASCII slug
  base := lower(public.immutable_unaccent(coalesce(p_first, '') || '-' || coalesce(p_last, '')));
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  IF base = '' THEN
    base := 'diagnostiqueur';
  END IF;

  candidate := base || '-' || coalesce(p_postal, 'fr');

  WHILE EXISTS (SELECT 1 FROM diagnosticians WHERE slug = candidate) LOOP
    counter := counter + 1;
    candidate := base || '-' || coalesce(p_postal, 'fr') || '-' || counter;
  END LOOP;

  RETURN candidate;
END $$;

-- ============================================
-- 7. Commentaires (documentation in-DB)
-- ============================================
COMMENT ON TABLE diagnosticians IS
  'Annuaire public KOVAS — fiches diagnostiqueurs FR certifiés importées depuis DHUP data.gouv.fr.';
COMMENT ON COLUMN diagnosticians.dhup_source_id IS
  'Identifiant source dans le dataset DHUP — utilisé pour upsert idempotent lors des imports cron.';
COMMENT ON COLUMN diagnosticians.claim_status IS
  'unclaimed (défaut, importé sans utilisateur) | pending (demande de réclamation en attente) | claimed | rejected.';
COMMENT ON COLUMN diagnosticians.withdrawal_requested IS
  'RGPD — droit d''opposition. Si true, la fiche n''est plus servie côté public (cf. RLS).';
COMMENT ON COLUMN diagnosticians.certifications IS
  'JSONB array : [{ type, organism, number, valid_until, status }]. Type ∈ {DPE,AMIANTE,PLOMB,GAZ,ELECTRICITE,TERMITES,CARREZ,ERP}.';
