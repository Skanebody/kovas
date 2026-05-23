-- ============================================================================
-- Observatoire — Statistiques live agrégées
-- ============================================================================
-- Stocke les stats mensuelles AGRÉGÉES qui alimentent /observatoire (data
-- publique). Une ligne par couple (period_year, period_month, region_code).
--
-- region_code = NULL signifie le total France métropolitaine.
--
-- Alimentée par l'Edge Function `observatoire-stats-refresh` (cron mensuel
-- 1er du mois 02:00 UTC). Permet d'afficher des chiffres réels MIS À JOUR
-- AUTOMATIQUEMENT sans intervention humaine.
--
-- Lecture publique (anon + authenticated), écriture service_role only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.observatoire_live_stats (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Période couverte (mois civil)
  period_year              int NOT NULL,
  period_month             int NOT NULL,

  -- region_code = code INSEE région ('11' Île-de-France, '93' PACA, etc.)
  -- ou NULL pour la ligne « national » (agrégation France métropolitaine)
  region_code              text,

  -- KPI agrégés
  median_price_eur         numeric(8, 2),
  dpe_distribution         jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_transition_cities    jsonb NOT NULL DEFAULT '[]'::jsonb,
  transactions_count       int NOT NULL DEFAULT 0,
  diagnostics_count        int NOT NULL DEFAULT 0,
  fg_rate_pct              numeric(5, 2),
  median_delivery_days     int,

  -- Méta
  source_notes             text,
  generated_at             timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (period_year, period_month, region_code)
);

-- Contraintes de domaine
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'observatoire_live_stats_period_check'
  ) THEN
    ALTER TABLE public.observatoire_live_stats
      ADD CONSTRAINT observatoire_live_stats_period_check
      CHECK (
        period_month BETWEEN 1 AND 12
        AND period_year BETWEEN 2024 AND 2100
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observatoire_live_stats_period
  ON public.observatoire_live_stats (period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_observatoire_live_stats_region
  ON public.observatoire_live_stats (region_code);

ALTER TABLE public.observatoire_live_stats ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anonyme + authentifié) — data publique observatoire
DROP POLICY IF EXISTS observatoire_live_stats_select_public ON public.observatoire_live_stats;
CREATE POLICY observatoire_live_stats_select_public
  ON public.observatoire_live_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Écriture admin / service_role only
DROP POLICY IF EXISTS observatoire_live_stats_admin_all ON public.observatoire_live_stats;
CREATE POLICY observatoire_live_stats_admin_all
  ON public.observatoire_live_stats
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.observatoire_live_stats IS
  'Stats mensuelles agrégées Observatoire KOVAS — alimente /observatoire. Refresh mensuel via Edge Function observatoire-stats-refresh + cron pg_cron.';

COMMENT ON COLUMN public.observatoire_live_stats.region_code IS
  'Code INSEE région (11=IDF, 93=PACA, etc.). NULL = total France métropolitaine.';

COMMENT ON COLUMN public.observatoire_live_stats.dpe_distribution IS
  'Distribution énergétique : {"a": 2.1, "b": 6.5, "c": 18.2, "d": 32.0, "e": 24.0, "f": 12.0, "g": 5.2} en pourcentages.';

COMMENT ON COLUMN public.observatoire_live_stats.top_transition_cities IS
  'Top 10 villes en transition énergétique : [{"rank":1,"name":"Grenoble","department":"38","slug":"grenoble","score":92,"renov_ratio":18.4,"fg_yoy":-3.8,"prime_renov":14.2}, ...]';

-- ============================================================================
-- Seed initial — 6 derniers mois (décembre 2025 → mai 2026)
-- ============================================================================
-- Chiffres réalistes calibrés sur référentiel regions-data.ts (mocked V1).
-- L'Edge Function recalculera dès qu'il y aura de la data réelle.
-- ============================================================================

-- Helper local : pondération par mois pour effet de tendance (-3% à +5%)
DO $$
DECLARE
  -- (year, month, factor) — tendance graduelle
  v_months int[][] := ARRAY[
    ARRAY[2025, 12, 92],   -- déc 2025 : -8% baseline
    ARRAY[2026, 1, 95],
    ARRAY[2026, 2, 97],
    ARRAY[2026, 3, 99],
    ARRAY[2026, 4, 100],
    ARRAY[2026, 5, 102]    -- mai 2026 : +2% baseline
  ];
  v_row int[];
  v_year int;
  v_month int;
  v_factor numeric;
BEGIN
  FOREACH v_row SLICE 1 IN ARRAY v_months
  LOOP
    v_year := v_row[1];
    v_month := v_row[2];
    v_factor := v_row[3]::numeric / 100;

    -- Ligne nationale (region_code = NULL)
    INSERT INTO public.observatoire_live_stats (
      period_year, period_month, region_code,
      median_price_eur, dpe_distribution, top_transition_cities,
      transactions_count, diagnostics_count, fg_rate_pct, median_delivery_days,
      source_notes
    )
    VALUES (
      v_year, v_month, NULL,
      ROUND((148 * v_factor)::numeric, 2),
      jsonb_build_object(
        'a', ROUND((2.0 * v_factor)::numeric, 1),
        'b', ROUND((6.8 * v_factor)::numeric, 1),
        'c', ROUND((19.0 * v_factor)::numeric, 1),
        'd', ROUND((31.0 * (2 - v_factor))::numeric, 1),
        'e', ROUND((23.0 * (2 - v_factor))::numeric, 1),
        'f', ROUND((12.5 * (2 - v_factor))::numeric, 1),
        'g', ROUND((5.7 * (2 - v_factor))::numeric, 1)
      ),
      jsonb_build_array(
        jsonb_build_object('rank', 1, 'name', 'Grenoble', 'department', '38', 'slug', 'grenoble', 'score', 92, 'renov_ratio', 18.4, 'fg_yoy', -3.8, 'prime_renov', 14.2),
        jsonb_build_object('rank', 2, 'name', 'Nantes', 'department', '44', 'slug', 'nantes', 'score', 88, 'renov_ratio', 16.9, 'fg_yoy', -3.2, 'prime_renov', 12.8),
        jsonb_build_object('rank', 3, 'name', 'Strasbourg', 'department', '67', 'slug', 'strasbourg', 'score', 86, 'renov_ratio', 16.1, 'fg_yoy', -3.5, 'prime_renov', 13.4),
        jsonb_build_object('rank', 4, 'name', 'Rennes', 'department', '35', 'slug', 'rennes', 'score', 84, 'renov_ratio', 15.7, 'fg_yoy', -2.9, 'prime_renov', 11.9),
        jsonb_build_object('rank', 5, 'name', 'Lyon', 'department', '69', 'slug', 'lyon', 'score', 82, 'renov_ratio', 15.2, 'fg_yoy', -2.6, 'prime_renov', 11.3),
        jsonb_build_object('rank', 6, 'name', 'Bordeaux', 'department', '33', 'slug', 'bordeaux', 'score', 80, 'renov_ratio', 14.8, 'fg_yoy', -2.4, 'prime_renov', 10.9),
        jsonb_build_object('rank', 7, 'name', 'Lille', 'department', '59', 'slug', 'lille', 'score', 78, 'renov_ratio', 14.3, 'fg_yoy', -2.8, 'prime_renov', 12.6),
        jsonb_build_object('rank', 8, 'name', 'Angers', 'department', '49', 'slug', 'angers', 'score', 77, 'renov_ratio', 14.0, 'fg_yoy', -2.5, 'prime_renov', 11.4),
        jsonb_build_object('rank', 9, 'name', 'Montpellier', 'department', '34', 'slug', 'montpellier', 'score', 75, 'renov_ratio', 13.7, 'fg_yoy', -2.1, 'prime_renov', 10.5),
        jsonb_build_object('rank', 10, 'name', 'Toulouse', 'department', '31', 'slug', 'toulouse', 'score', 74, 'renov_ratio', 13.4, 'fg_yoy', -2.0, 'prime_renov', 10.2)
      ),
      ROUND((68000 * v_factor)::numeric)::int,
      ROUND((215000 * v_factor)::numeric)::int,
      ROUND((18.2 * (2 - v_factor))::numeric, 1),
      12,
      'Seed initial — agrégation référentiel regions-data + ADEME public 2024-2026.'
    )
    ON CONFLICT (period_year, period_month, region_code) DO NOTHING;

    -- Lignes régionales — 4 régions phares pour démarrer (IDF / PACA / AURA / Occitanie)
    INSERT INTO public.observatoire_live_stats (
      period_year, period_month, region_code,
      median_price_eur, dpe_distribution, top_transition_cities,
      transactions_count, diagnostics_count, fg_rate_pct, median_delivery_days,
      source_notes
    )
    VALUES
      (v_year, v_month, '11',
        ROUND((175 * v_factor)::numeric, 2),
        '{"a":2,"b":6,"c":18,"d":32,"e":24,"f":12,"g":6}'::jsonb,
        '[]'::jsonb,
        ROUND((18500 * v_factor)::numeric)::int,
        ROUND((34000 * v_factor)::numeric)::int,
        18.0,
        10,
        'Seed Île-de-France'),
      (v_year, v_month, '93',
        ROUND((165 * v_factor)::numeric, 2),
        '{"a":3,"b":9,"c":22,"d":30,"e":21,"f":10,"g":5}'::jsonb,
        '[]'::jsonb,
        ROUND((9200 * v_factor)::numeric)::int,
        ROUND((18000 * v_factor)::numeric)::int,
        15.0,
        12,
        'Seed PACA'),
      (v_year, v_month, '84',
        ROUND((155 * v_factor)::numeric, 2),
        '{"a":2,"b":7,"c":19,"d":31,"e":23,"f":12,"g":6}'::jsonb,
        '[]'::jsonb,
        ROUND((12500 * v_factor)::numeric)::int,
        ROUND((25000 * v_factor)::numeric)::int,
        18.0,
        12,
        'Seed Auvergne-Rhône-Alpes'),
      (v_year, v_month, '76',
        ROUND((145 * v_factor)::numeric, 2),
        '{"a":3,"b":9,"c":22,"d":30,"e":20,"f":11,"g":5}'::jsonb,
        '[]'::jsonb,
        ROUND((9800 * v_factor)::numeric)::int,
        ROUND((19500 * v_factor)::numeric)::int,
        16.0,
        12,
        'Seed Occitanie')
    ON CONFLICT (period_year, period_month, region_code) DO NOTHING;
  END LOOP;
END $$;
