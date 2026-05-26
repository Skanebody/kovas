-- ============================================================================
-- Observatoire — Table mensuelle des rénovations énergétiques agrégées (ADEME)
-- ============================================================================
-- Source : ADEME DPE v2 logements existants (open data, sans auth).
-- Cible UI : /observatoire section "Évolution de la rénovation énergétique"
-- (composant `RenovationTrend`). Aujourd'hui 100 % mock — cette table
-- alimente le graph en données réelles à partir du cron mensuel.
--
-- Granularité : (année, mois, région INSEE) avec `region_code = NULL` pour la
-- ligne nationale agrégée. Le composant frontend lit la ligne nationale
-- (region_code IS NULL) sur les 24 derniers mois glissants.
--
-- Cron : `ingest-ademe-renovations-monthly` invoquée le 1er du mois à 04:00
-- UTC via `public.invoke_edge_function()` (cf. migration séparée pour le
-- schedule). Le 04:00 est volontairement décalé après le refresh stats à
-- 02:00 UTC pour éviter la contention.
--
-- RLS : lecture publique (données open data agrégées, aucune PII) ;
-- écriture réservée au service_role (Edge Function uniquement).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.observatoire_renovations_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  -- Code région INSEE (NULL = ligne nationale)
  region_code text,
  -- Nombre de rénovations énergétiques effectuées ce mois (proxy : DPE
  -- de classe A-C établis sur le mois pour des logements ayant un DPE
  -- antérieur en classe D-G ; en V1, on utilise simplement le volume
  -- DPE en classe A-C comme indicateur direct de rénovation effective).
  renovations_count int NOT NULL DEFAULT 0,
  -- Évolution des classes : nombre passé de F→D, F→C, G→C, etc.
  -- Format : { "f_to_d": 1234, "g_to_c": 567, ... }
  -- En V1, peut rester `{}` si la donnée transition n'est pas exploitable.
  class_transitions jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Volume total DPE émis ce mois (pour calculer le ratio rénovation)
  dpe_count int NOT NULL DEFAULT 0,
  -- Source de l'ingestion :
  --   'ademe'           = données réelles ADEME
  --   'synthetic_seed'  = seed initial extrapolé (à remplacer dès J+30)
  source text NOT NULL DEFAULT 'ademe',
  ingested_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (period_year, period_month, region_code)
);

CREATE INDEX IF NOT EXISTS idx_observatoire_renovations_period
  ON public.observatoire_renovations_monthly (period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_observatoire_renovations_region
  ON public.observatoire_renovations_monthly (region_code, period_year DESC, period_month DESC);

-- Index pour la query principale "ligne nationale 24 derniers mois"
CREATE INDEX IF NOT EXISTS idx_observatoire_renovations_national
  ON public.observatoire_renovations_monthly (period_year DESC, period_month DESC)
  WHERE region_code IS NULL;

-- RLS : lecture publique (open data agrégé), écriture service_role only
ALTER TABLE public.observatoire_renovations_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obs_renovations_read ON public.observatoire_renovations_monthly;
CREATE POLICY obs_renovations_read
  ON public.observatoire_renovations_monthly
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS obs_renovations_write ON public.observatoire_renovations_monthly;
CREATE POLICY obs_renovations_write
  ON public.observatoire_renovations_monthly
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.observatoire_renovations_monthly TO anon, authenticated;
GRANT ALL ON public.observatoire_renovations_monthly TO service_role;

COMMENT ON TABLE public.observatoire_renovations_monthly IS
  'KOVAS — Données mensuelles de rénovation énergétique agrégées depuis ADEME (DPE). Cible : /observatoire section "Évolution de la rénovation". Cron mensuel 1er à 04h UTC.';

COMMENT ON COLUMN public.observatoire_renovations_monthly.region_code IS
  'Code région INSEE (11, 24, 27...) ou NULL pour la ligne nationale agrégée.';

COMMENT ON COLUMN public.observatoire_renovations_monthly.renovations_count IS
  'Proxy rénovation = nombre de DPE classe A-C établis sur le mois (V1). V2 : transitions réelles entre DPE successifs sur même logement.';

COMMENT ON COLUMN public.observatoire_renovations_monthly.source IS
  'Source de l''ingestion : ademe = données réelles ADEME ; synthetic_seed = seed initial extrapolé.';

COMMIT;
