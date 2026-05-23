-- ============================================================================
-- city_real_stats : statistiques réelles par ville (FIX-NN)
-- ============================================================================
-- Remplace les chiffres déterministes (hash-based) de
-- apps/web/src/lib/seo-content/local-data.ts par des données vraiment sourcées
-- (ADEME DPE v2 + INSEE Filocom + DVF + paragraphes IA Claude Haiku 4.5).
--
-- Pipeline :
--   1. Edge Function `refresh-city-stats` (unitaire) : fetch ADEME + INSEE + DVF
--      pour 1 ville, calcule distribution A-G + taux F-G + prix médian + parc
--      pré-1948 / pré-1997, appelle Claude Haiku pour 3 paragraphes contextuels.
--   2. Edge Function `refresh-city-stats-batch` : sélectionne 200 villes
--      `next_refresh_due < now()` et invoque l'unitaire en parallèle (concur 5).
--   3. pg_cron quotidien `kovas-refresh-city-stats-daily` 02:00 UTC :
--      200 villes / jour = 5000 villes en rotation continue (~25 jours par ville).
--
-- Le rafraîchissement réussi pose `next_refresh_due = now() + 30 jours`,
-- garantissant qu'aucune ville n'a de data > 60 jours en production.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Table principale : city_real_stats
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.city_real_stats (
  city_slug text PRIMARY KEY,
  city_name text NOT NULL,
  dept_code text NOT NULL,
  insee_code text,
  population int,

  -- Distribution énergétique réelle (depuis ADEME)
  -- Format : {"A": 1.2, "B": 4.8, "C": 12.3, "D": 28.7, "E": 24.5, "F": 18.3, "G": 10.2}
  dpe_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_dpe_count int NOT NULL DEFAULT 0,
  dpe_period_start date,
  dpe_period_end date,
  median_energy_class text CHECK (median_energy_class IN ('A','B','C','D','E','F','G')),
  fg_rate_pct numeric(5,2),

  -- Prix réels (DVF + estimation diag)
  median_dpe_price_eur int,
  min_dpe_price_eur int,
  max_dpe_price_eur int,
  price_source text CHECK (price_source IN ('KOVAS_db','DVF_estimation','national_avg')),

  -- Parc immobilier (INSEE Filocom + agg ADEME)
  total_dwellings int,
  pre_1948_rate_pct numeric(5,2),
  pre_1997_rate_pct numeric(5,2),
  avg_construction_year int,

  -- Délais observés
  median_delivery_days int,
  estimated_dpe_per_year int,

  -- Contexte IA généré (3 paragraphes 80-120 mots chacun)
  -- Format : [{"heading": "Particularités du bâti", "body": "..."}]
  context_paragraphs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_generated_at timestamptz,
  ai_model text,

  -- Sources tracking
  -- Format : [{"name": "ADEME DPE v2", "url": "...", "fetched_at": "...", "rows_count": 1234}]
  sources_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  refresh_status text NOT NULL DEFAULT 'pending'
    CHECK (refresh_status IN ('pending','fetching','success','partial','failed')),
  last_refreshed_at timestamptz,
  last_error text,
  next_refresh_due timestamptz DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_real_stats IS
  'Stats RÉELLES par ville (ADEME + INSEE + DVF + IA contextualisation). Cron quotidien rotation 200 villes/jour. Lecture publique anon.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crs_dept_slug
  ON public.city_real_stats(dept_code, city_slug);

CREATE INDEX IF NOT EXISTS idx_crs_next_refresh_due
  ON public.city_real_stats(next_refresh_due)
  WHERE refresh_status != 'fetching';

CREATE INDEX IF NOT EXISTS idx_crs_status_refreshed
  ON public.city_real_stats(refresh_status, last_refreshed_at DESC);

CREATE INDEX IF NOT EXISTS idx_crs_insee
  ON public.city_real_stats(insee_code)
  WHERE insee_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Trigger updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_city_real_stats_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_city_real_stats_updated_at ON public.city_real_stats;
CREATE TRIGGER trg_city_real_stats_updated_at
  BEFORE UPDATE ON public.city_real_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_city_real_stats_updated_at();

-- ----------------------------------------------------------------------------
-- RLS : lecture publique, écriture service_role uniquement
-- ----------------------------------------------------------------------------
ALTER TABLE public.city_real_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crs_public_read ON public.city_real_stats;
CREATE POLICY crs_public_read
  ON public.city_real_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT/UPDATE/DELETE : aucune politique → seul service_role peut écrire
-- (service_role bypass RLS par défaut côté Supabase).

REVOKE ALL ON public.city_real_stats FROM anon, authenticated;
GRANT SELECT ON public.city_real_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Vue admin : queue de refresh
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.admin_city_stats_queue
WITH (security_invoker = true)
AS
SELECT
  city_slug,
  city_name,
  dept_code,
  insee_code,
  refresh_status,
  total_dpe_count,
  jsonb_array_length(sources_used) AS sources_count,
  last_refreshed_at,
  next_refresh_due,
  last_error,
  CASE
    WHEN refresh_status = 'success' AND last_refreshed_at > now() - interval '60 days'
      THEN 'fresh'
    WHEN refresh_status = 'success' AND last_refreshed_at > now() - interval '90 days'
      THEN 'stale'
    WHEN refresh_status = 'failed'
      THEN 'failed'
    WHEN refresh_status = 'pending'
      THEN 'pending'
    WHEN refresh_status = 'fetching'
      THEN 'fetching'
    ELSE 'unknown'
  END AS health_status
FROM public.city_real_stats;

COMMENT ON VIEW public.admin_city_stats_queue IS
  'Vue admin /admin/city-stats/refresh : statut santé de chaque ville (fresh/stale/failed/pending).';
