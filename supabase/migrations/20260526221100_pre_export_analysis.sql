-- ============================================
-- KOVAS — Module Pré-vérification Pré-export
-- Date : 2026-06-12
--
-- Analyse intelligente d'une mission AVANT export vers le logiciel métier
-- (Liciel XML, OBBC XML, DS8, notaire XML, PDF). Objectifs :
--   - Anticiper ce que l'ADEME pourrait reprocher au DPE final
--   - Donner une visibilité sur les indicateurs personnels
--   - Signaler les opportunités commerciales
--
-- Philosophie : JAMAIS BLOQUER l'export. Toujours bouton "Exporter quand même".
--
-- 3 tables :
--   1. pre_export_analyses    — résultats d'analyse par mission (historisés)
--   2. ademe_benchmarks       — benchmarks national/régional/typologie (cron mensuel)
--   3. dpe_historical_cache   — cache des DPE historiques ADEME par adresse (30j)
-- ============================================

-- ============================================
-- 1. pre_export_analyses
-- ============================================
CREATE TABLE IF NOT EXISTS pre_export_analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id            uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  diagnostician_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analyzed_at           timestamptz NOT NULL DEFAULT now(),
  target_format         text NOT NULL CHECK (
    target_format IN ('liciel_xml', 'liciel_diag', 'obbc_xml', 'ds8', 'notaire_xml', 'pdf_only')
  ),

  -- Score global pondéré (0-100, plus haut = meilleur)
  global_score          integer CHECK (global_score BETWEEN 0 AND 100),
  -- Sous-scores explicables
  conformity_score      integer,   -- /40 — conformité ADEME 3CL
  coherence_score       integer,   -- /20 — cohérence interne
  statistical_score     integer,   -- /20 — cohérence statistique
  quality_score         integer,   -- /10 — qualité photos & observations
  exhaustivity_score    integer,   -- /10 — exhaustivité optionnelle

  -- Findings produits par les 6 analyseurs (JSONB ordonné)
  findings              jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Actions utilisateur enregistrées (corrections, dismiss, override)
  user_actions          jsonb DEFAULT '[]'::jsonb,

  -- Suivi export (utile pour funnel "analyse → export")
  exported              boolean DEFAULT false,
  exported_at           timestamptz,
  export_file_url       text,

  -- Métadonnées performance / coût
  analysis_duration_ms  integer,
  ai_tokens_used        integer,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_export_diag_date
  ON pre_export_analyses (diagnostician_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pre_export_score
  ON pre_export_analyses (global_score);
CREATE INDEX IF NOT EXISTS idx_pre_export_mission
  ON pre_export_analyses (mission_id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pre_export_org_date
  ON pre_export_analyses (organization_id, analyzed_at DESC);

COMMENT ON TABLE pre_export_analyses IS
  'Historique des pré-vérifications pré-export (1 ligne par exécution). Score pondéré conformity 40 + coherence 20 + statistical 20 + quality 10 + exhaustivity 10.';

-- ============================================
-- 2. ademe_benchmarks
-- ============================================
CREATE TABLE IF NOT EXISTS ademe_benchmarks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type              text NOT NULL CHECK (scope_type IN ('national', 'regional', 'departemental')),
  scope_value             text,           -- code région INSEE / code département (NULL si national)
  bien_type               text,           -- 'maison' | 'appartement' | 'immeuble' | NULL pour mix
  year_construction_band  text,           -- '<1948' | '1948-1974' | '1975-2000' | '>2000' | NULL pour mix

  -- Distribution DPE (A-G en pourcentages 0-1)
  distribution            jsonb NOT NULL, -- { "A": 0.04, "B": 0.07, ..., "G": 0.06 }
  -- Distribution GES (A-G en pourcentages 0-1)
  distribution_ges        jsonb,

  source                  text,           -- 'ademe_open_data' | 'observatoire_dpe' | etc.
  data_period_start       date,
  data_period_end         date,
  sample_size             integer,
  fetched_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_scope
  ON ademe_benchmarks (scope_type, scope_value, bien_type, year_construction_band);

COMMENT ON TABLE ademe_benchmarks IS
  'Benchmarks publics ADEME (distribution DPE/GES) par scope (national/régional/dpt) + typologie + bande année. Rafraîchi mensuellement via Edge Function `fetch-ademe-benchmarks`.';

-- ============================================
-- 3. dpe_historical_cache
-- ============================================
CREATE TABLE IF NOT EXISTS dpe_historical_cache (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_normalized    text NOT NULL,
  postal_code           text,
  insee_code            text,
  ademe_number          text,           -- numero DPE ADEME (clé d'unicité)
  diagnostic_date       date,
  diagnostician_name    text,
  energy_class          text,           -- A-G
  ges_class             text,           -- A-G
  conso_kwh_m2_an       numeric,
  ges_kgco2_m2_an       numeric,
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_dpe_historical_address
  ON dpe_historical_cache (address_normalized, postal_code);
CREATE INDEX IF NOT EXISTS idx_dpe_historical_expires
  ON dpe_historical_cache (expires_at);

COMMENT ON TABLE dpe_historical_cache IS
  'Cache local des DPE historiques publiés sur l''open data ADEME, indexés par adresse normalisée. TTL 30 jours pour cohérence avec rythme de publication ADEME.';

-- ============================================
-- RLS — pre_export_analyses (multi-tenant strict)
-- ============================================
ALTER TABLE pre_export_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pre_export_analyses"
  ON pre_export_analyses FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert pre_export_analyses"
  ON pre_export_analyses FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update pre_export_analyses"
  ON pre_export_analyses FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete pre_export_analyses"
  ON pre_export_analyses FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));

-- ============================================
-- RLS — ademe_benchmarks (lecture publique authentifiée, écriture service-role)
-- ============================================
ALTER TABLE ademe_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ademe_benchmarks"
  ON ademe_benchmarks FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- RLS — dpe_historical_cache (lecture publique authentifiée, écriture service-role)
-- ============================================
ALTER TABLE dpe_historical_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read dpe_historical_cache"
  ON dpe_historical_cache FOR SELECT TO authenticated
  USING (true);
