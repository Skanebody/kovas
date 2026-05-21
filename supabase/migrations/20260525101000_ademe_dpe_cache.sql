-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — ademe_dpe_cache
--
-- Cache local des DPE consultés via l'API ADEME publique (open data
-- DPE V2 logements existants + neufs). Évite de retaper l'API à chaque
-- ouverture d'un DPE. TTL géré côté applicatif via `fetched_at`.
--
-- Multi-tenant : un DPE consulté par un cabinet est partagé entre ses
-- membres (UNIQUE(organization_id, numero_dpe)).
-- ============================================

CREATE TABLE IF NOT EXISTS ademe_dpe_cache (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fetched_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identifiants ADEME
  numero_dpe            text NOT NULL,                   -- ex: 2376E2306742Q
  ancien_numero_dpe     text,                            -- DPE remplacé (rénovation)
  certificat_number     text,                            -- numéro RGE diagnostiqueur émetteur

  -- Adresse / géo
  address               text,
  city                  text,
  postal_code           text,
  insee_code            text,
  latitude              numeric(9,6),
  longitude             numeric(9,6),

  -- Caractéristiques principales
  type_batiment         text,                            -- maison | appartement | immeuble
  annee_construction    int,
  surface_habitable_m2  numeric(8,2),
  type_chauffage        text,
  type_climatisation    text,
  type_ecs              text,                            -- type eau chaude sanitaire
  type_ventilation      text,

  -- Résultats
  etiquette_dpe         text CHECK (etiquette_dpe IN ('A','B','C','D','E','F','G') OR etiquette_dpe IS NULL),
  etiquette_ges         text CHECK (etiquette_ges IN ('A','B','C','D','E','F','G') OR etiquette_ges IS NULL),
  consommation_kwh_m2   numeric(8,2),                    -- kWh/m².an
  emissions_kgco2_m2    numeric(8,2),                    -- kgCO2/m².an

  -- Dates ADEME
  date_etablissement    date,
  date_visite           date,
  date_fin_validite     date,

  -- Payload brut + audit cache
  raw_payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz,                     -- TTL applicatif (ex: 30j)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, numero_dpe)
);

CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_org
  ON ademe_dpe_cache (organization_id);
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_fetched_by
  ON ademe_dpe_cache (fetched_by) WHERE fetched_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_numero
  ON ademe_dpe_cache (numero_dpe);
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_certificat
  ON ademe_dpe_cache (certificat_number) WHERE certificat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_insee
  ON ademe_dpe_cache (insee_code) WHERE insee_code IS NOT NULL;
-- Clustering géographique (recherche par bbox / k-NN logique métier)
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_geo
  ON ademe_dpe_cache (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_dpe_cache_expires
  ON ademe_dpe_cache (expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE ademe_dpe_cache IS
  'Cache des DPE consultés via l''API publique ADEME (open data). Évite les rappels API répétés, support recherche géographique pour benchmark voisinage.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ademe_dpe_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ademe_dpe_cache"
  ON ademe_dpe_cache FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert ademe_dpe_cache"
  ON ademe_dpe_cache FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update ademe_dpe_cache"
  ON ademe_dpe_cache FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete ademe_dpe_cache"
  ON ademe_dpe_cache FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
