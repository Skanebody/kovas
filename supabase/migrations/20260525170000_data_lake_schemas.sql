-- ============================================================================
-- KOVAS — REFONTE ACQUI-TARGET 2026-05
-- Data lake autonome 5 niveaux (architecture 11 sources publiques légitimes)
--
-- Niveau 1 — INGESTION (Edge Functions cron)
-- Niveau 2 — NORMALISATION (validation schema, dedup, quality scoring)
-- Niveau 3 — STOCKAGE (ce fichier : schemas data.*, analytics.*, internal.*)
-- Niveau 4 — DÉRIVATION (vues matérialisées)
-- Niveau 5 — CACHE / EXPOSITION (ISR Next.js, Vercel KV, API publique)
--
-- Sources :
--   BAN (adresse.data.gouv.fr) — ODbL
--   Cadastre IGN — Licence Ouverte
--   ADEME Observatoire DPE — Licence Ouverte
--   DVF Etalab — Licence Ouverte
--   DHUP annuaire diagnostiqueurs — Open data
--   SIRENE INSEE — Open data
--   INPI marques — Open data
--   COFRAC accréditations — Public registry
--   Géorisques ERP — Open data
--   Google Search Console — Propriétaire (nos sites)
--   France Renov RGE — Open data
--
-- Authority : docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md chapitres 10-12.
-- ============================================================================

-- 1. SCHEMAS ----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS data;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS internal;

GRANT USAGE ON SCHEMA data TO authenticated, service_role, anon;
GRANT USAGE ON SCHEMA analytics TO authenticated, service_role;
GRANT USAGE ON SCHEMA internal TO service_role;

-- PostGIS déjà installé en prod (3.3.7 vérifié 2026-05-25)

-- 2. data.properties_unified — pierre angulaire A1.3.4 ----------------------
CREATE TABLE IF NOT EXISTS data.properties_unified (
  ban_id TEXT PRIMARY KEY,
  parcelle_cadastre_id TEXT UNIQUE,
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  postcode TEXT,
  city TEXT,
  city_insee_code TEXT,
  department TEXT,
  surface_terrain_m2 NUMERIC,
  surface_bati_m2 NUMERIC,
  year_built_estimated INT,
  building_type TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_score INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);
CREATE INDEX IF NOT EXISTS idx_pu_parcelle ON data.properties_unified (parcelle_cadastre_id);
CREATE INDEX IF NOT EXISTS idx_pu_city_insee ON data.properties_unified (city_insee_code);
CREATE INDEX IF NOT EXISTS idx_pu_dept ON data.properties_unified (department);
CREATE INDEX IF NOT EXISTS idx_pu_geom ON data.properties_unified USING GIST (geom);

-- 3. data.properties_transactions_history — DVF mutations -----------------
CREATE TABLE IF NOT EXISTS data.properties_transactions_history (
  id BIGSERIAL PRIMARY KEY,
  ban_id TEXT NOT NULL REFERENCES data.properties_unified(ban_id) ON DELETE CASCADE,
  parcelle_cadastre_id TEXT,
  transaction_date DATE NOT NULL,
  price_eur NUMERIC NOT NULL,
  surface_m2 NUMERIC,
  transaction_type TEXT,
  source TEXT DEFAULT 'dvf',
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pth_ban ON data.properties_transactions_history (ban_id, transaction_date DESC);

-- 4. data.properties_dpe_history — ADEME historique 12 mois (A1.3.1) -------
CREATE TABLE IF NOT EXISTS data.properties_dpe_history (
  id BIGSERIAL PRIMARY KEY,
  ban_id TEXT NOT NULL,
  parcelle_cadastre_id TEXT,
  ademe_dpe_id TEXT UNIQUE,
  dpe_date DATE NOT NULL,
  class_dpe TEXT NOT NULL,
  class_ges TEXT NOT NULL,
  surface_m2 NUMERIC,
  methode TEXT,
  diagnostician_anonymous_id TEXT,
  quality_score INT,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pdh_parcelle ON data.properties_dpe_history (parcelle_cadastre_id, dpe_date DESC);
CREATE INDEX IF NOT EXISTS idx_pdh_ban ON data.properties_dpe_history (ban_id, dpe_date DESC);
CREATE INDEX IF NOT EXISTS idx_pdh_ademe_id ON data.properties_dpe_history (ademe_dpe_id);

-- 5. data.properties_erp_risks — Géorisques --------------------------------
CREATE TABLE IF NOT EXISTS data.properties_erp_risks (
  ban_id TEXT PRIMARY KEY REFERENCES data.properties_unified(ban_id) ON DELETE CASCADE,
  naturels JSONB DEFAULT '[]'::jsonb,
  technologiques JSONB DEFAULT '[]'::jsonb,
  miniers JSONB DEFAULT '[]'::jsonb,
  radon_level NUMERIC,
  seismique TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 6. data.properties_diagnostiqueurs_zone — internal density --------------
CREATE TABLE IF NOT EXISTS data.properties_diagnostiqueurs_zone (
  ban_id TEXT NOT NULL,
  diagnostician_id TEXT NOT NULL,
  count_operations_5km INT NOT NULL DEFAULT 0,
  last_operation_date DATE,
  PRIMARY KEY (ban_id, diagnostician_id)
);
CREATE INDEX IF NOT EXISTS idx_pdz_ban ON data.properties_diagnostiqueurs_zone (ban_id);
CREATE INDEX IF NOT EXISTS idx_pdz_diag ON data.properties_diagnostiqueurs_zone (diagnostician_id);

-- 7. data.dvf_mutations — DVF raw (cache + analytics) ----------------------
CREATE TABLE IF NOT EXISTS data.dvf_mutations (
  id BIGSERIAL PRIMARY KEY,
  mutation_id TEXT UNIQUE,
  date_mutation DATE NOT NULL,
  commune_insee TEXT NOT NULL,
  section_cadastre TEXT,
  numero_parcelle TEXT,
  valeur_fonciere NUMERIC,
  surface_reelle_bati NUMERIC,
  surface_terrain NUMERIC,
  type_local TEXT,
  nature_mutation TEXT,
  raw_jsonb JSONB,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dvf_commune ON data.dvf_mutations (commune_insee, date_mutation DESC);
CREATE INDEX IF NOT EXISTS idx_dvf_parcelle ON data.dvf_mutations (commune_insee, section_cadastre, numero_parcelle);

-- 8. data.ademe_dpe — ADEME raw + index spatial ----------------------------
CREATE TABLE IF NOT EXISTS data.ademe_dpe (
  id BIGSERIAL PRIMARY KEY,
  numero_dpe TEXT UNIQUE,
  date_etablissement DATE NOT NULL,
  adresse_ban_id TEXT,
  parcelle_cadastre_id TEXT,
  commune_insee TEXT,
  class_dpe TEXT,
  class_ges TEXT,
  surface_habitable NUMERIC,
  consommation_5_usages NUMERIC,
  emissions_ges_5_usages NUMERIC,
  methode TEXT,
  geo_point_lat NUMERIC,
  geo_point_lng NUMERIC,
  quality_score INT DEFAULT 100,
  raw_jsonb JSONB,
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN geo_point_lat IS NOT NULL AND geo_point_lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(geo_point_lng, geo_point_lat), 4326)
      ELSE NULL
    END
  ) STORED
);
CREATE INDEX IF NOT EXISTS idx_ademe_commune ON data.ademe_dpe (commune_insee, date_etablissement DESC);
CREATE INDEX IF NOT EXISTS idx_ademe_geo ON data.ademe_dpe USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_ademe_parcelle ON data.ademe_dpe (parcelle_cadastre_id, date_etablissement DESC);
CREATE INDEX IF NOT EXISTS idx_ademe_class ON data.ademe_dpe (class_dpe, commune_insee);

-- 9. data.france_renov_rge — RGE artisans (cross-sell V2) -----------------
CREATE TABLE IF NOT EXISTS data.france_renov_rge (
  siret TEXT PRIMARY KEY,
  raison_sociale TEXT,
  certifications TEXT[],
  postcode TEXT,
  commune_insee TEXT,
  lat NUMERIC,
  lng NUMERIC,
  raw_jsonb JSONB,
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fr_rge_commune ON data.france_renov_rge (commune_insee);

-- 10. data.equipment_brands_models — catalogue Vision IA A1.3.6 -----------
CREATE TABLE IF NOT EXISTS data.equipment_brands_models (
  id SERIAL PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  energy_type TEXT,
  energy_class TEXT,
  power_kw NUMERIC,
  year_min INT,
  year_max INT,
  specs JSONB,
  source TEXT,
  UNIQUE(brand, model)
);
CREATE INDEX IF NOT EXISTS idx_eqm_brand_type ON data.equipment_brands_models (brand, equipment_type);

-- 11. analytics.* — Vues matérialisées (Niveau 4 dérivation) -------------
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.passoires_thermiques_by_commune AS
SELECT
  commune_insee,
  COUNT(*) FILTER (WHERE class_dpe IN ('F', 'G')) AS count_passoires,
  COUNT(*) AS total_dpe,
  COUNT(*) FILTER (WHERE class_dpe IN ('F', 'G'))::float / NULLIF(COUNT(*), 0) AS ratio_passoires,
  MAX(date_etablissement) AS last_dpe_date
FROM data.ademe_dpe
WHERE date_etablissement > NOW() - INTERVAL '24 months'
GROUP BY commune_insee
WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_commune ON analytics.passoires_thermiques_by_commune (commune_insee);

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.transactions_history_by_commune AS
SELECT
  commune_insee,
  COUNT(*) AS total_transactions_12m,
  AVG(valeur_fonciere / NULLIF(surface_reelle_bati, 0)) AS avg_price_per_m2,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY valeur_fonciere) AS median_price,
  MAX(date_mutation) AS last_transaction_date
FROM data.dvf_mutations
WHERE date_mutation > NOW() - INTERVAL '12 months'
  AND surface_reelle_bati > 0
GROUP BY commune_insee
WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS idx_th_commune ON analytics.transactions_history_by_commune (commune_insee);

-- 12. internal.* — État des ingesters + monitoring -----------------------
CREATE TABLE IF NOT EXISTS internal.ingestion_state (
  source TEXT PRIMARY KEY,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_records_count INT,
  last_sync_duration_ms INT,
  next_sync_due_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS internal.data_quality_incidents (
  id BIGSERIAL PRIMARY KEY,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT,
  metadata JSONB,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_dqi_unresolved ON internal.data_quality_incidents (severity, detected_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS internal.diagnostician_pattern_learnings (
  id BIGSERIAL PRIMARY KEY,
  diagnostician_id UUID NOT NULL,
  pattern_type TEXT NOT NULL,
  dismissed_count INT DEFAULT 0,
  applied_count INT DEFAULT 0,
  current_weight NUMERIC DEFAULT 1.0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnostician_id, pattern_type)
);
CREATE INDEX IF NOT EXISTS idx_dpl_diag ON internal.diagnostician_pattern_learnings (diagnostician_id);

CREATE TABLE IF NOT EXISTS internal.bandit_state_per_diagnostician (
  diagnostician_id UUID PRIMARY KEY,
  arm_successes INT DEFAULT 0,
  arm_failures INT DEFAULT 0,
  last_decay_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. RPC PostGIS diagnosticians_within_radius (utilisé par A1.3.4) -------
CREATE OR REPLACE FUNCTION public.diagnosticians_within_radius(
  center_lat NUMERIC,
  center_lng NUMERIC,
  radius_meters INT DEFAULT 5000
)
RETURNS TABLE (
  anonymous_id TEXT,
  count_operations BIGINT,
  last_operation_date DATE
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = data, public
AS $$
  SELECT
    d.diagnostician_id AS anonymous_id,
    COUNT(*)::BIGINT AS count_operations,
    MAX(d.last_operation_date)::DATE
  FROM data.properties_diagnostiqueurs_zone d
  JOIN data.properties_unified p ON p.ban_id = d.ban_id
  WHERE ST_DWithin(
    p.geom::geography,
    ST_MakePoint(center_lng, center_lat)::geography,
    radius_meters
  )
  GROUP BY d.diagnostician_id;
$$;
REVOKE EXECUTE ON FUNCTION public.diagnosticians_within_radius FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnosticians_within_radius TO authenticated, service_role;

-- 14. Documentation comments ---------------------------------------------
COMMENT ON SCHEMA data IS 'Data lake niveau 3 : sources publiques ingérées (BAN, IGN, ADEME, DVF, DHUP, SIRENE, INPI, COFRAC, Géorisques, GSC, France Renov)';
COMMENT ON SCHEMA analytics IS 'Vues matérialisées niveau 4 : agrégations pré-calculées pour API publique + pages SEO';
COMMENT ON SCHEMA internal IS 'État technique : ingestion_state, data_quality_incidents, ML learnings — service_role uniquement';
COMMENT ON TABLE data.properties_unified IS 'Profil unifié propriété — pierre angulaire algo A1.3.4. Cross-source : BAN + IGN + DVF + ADEME + Géorisques + Internal.';
COMMENT ON FUNCTION public.diagnosticians_within_radius IS 'PostGIS spatial query — diagnostiqueurs actifs dans rayon (m). Utilisé par A1.3.4 profil unifié + algo lead routing.';
