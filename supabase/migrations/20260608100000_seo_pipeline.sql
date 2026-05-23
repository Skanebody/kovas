-- ============================================================================
-- SEO Pipeline — Schema d'ingestion + scoring + drafts + publications
-- ============================================================================
-- Migration D1 : pipeline SEO multi-sources (GSC, Trends, Autocomplete, PAA,
-- DVF, INSEE, ADEME, NewsAPI, Reddit) avec scoring composite, drafts Claude,
-- versions TipTap, publications avec metrics.
--
-- Architecture en 6 tables + 2 fonctions :
--   - seo_sources           : catalogue des sources d'ingestion (poids dans scoring)
--   - seo_keywords          : mots-clés dédupliqués normalisés (lowercase + unaccent)
--   - seo_keyword_signals   : signaux bruts par source (volume, position, sentiment)
--   - seo_drafts            : drafts générés par Claude (Kanban admin)
--   - seo_draft_versions    : historique des éditions TipTap
--   - seo_publications      : articles publiés en prod avec metrics GSC
--
-- Fonctions :
--   - compute_keyword_score(uuid)            : score composite 0-100 par keyword
--   - refresh_all_keyword_scores(int)        : recompute batch des keywords stale
--
-- Idempotence : tous les CREATE en IF NOT EXISTS, contraintes wrappées DO $$
-- ============================================================================

-- Extensions requises (déjà présentes via init_schema, sécurité idempotente)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================================
-- 0. Helper is_admin(uuid)
-- ============================================================================
-- Renvoie true si le user a un flag admin dans profiles. Fallback safe : si
-- la colonne profiles.is_admin n'existe pas encore, retourne false (à activer
-- ultérieurement via une migration dédiée qui ajoute la colonne).
-- ----------------------------------------------------------------------------
-- Patch idempotent : la fonction is_admin(uuid) existe déjà en prod avec un
-- paramètre nommé "p_user_id" (depuis migration legacy). Drop impossible
-- (policies dépendantes). On skip le CREATE OR REPLACE : la fonction est
-- déjà fonctionnelle et son nom de paramètre n'a pas d'impact sur les RLS.
-- Si elle n'existe pas, on la crée.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'is_admin'
    ) THEN
      EXECUTE $f$
        CREATE FUNCTION public.is_admin(uid uuid)
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        SET search_path = public
        AS $body$
          SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = uid AND is_admin = true
          );
        $body$;
      $f$;
    ELSE
      EXECUTE $f$
        CREATE FUNCTION public.is_admin(uid uuid)
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
        SET search_path = public
        AS $body$
          SELECT false;
        $body$;
      $f$;
    END IF;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role';
  END IF;
END $$;

-- ============================================================================
-- 1. Table seo_sources — catalogue des sources d'ingestion
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_sources (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE NOT NULL,
  display_name          text NOT NULL,
  category              text NOT NULL,
  weight                numeric(3,2) NOT NULL,
  is_active             boolean NOT NULL DEFAULT true,
  last_ingested_at      timestamptz,
  total_signals_count   int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Contraintes CHECK ajoutées idempotemment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_sources_code_check'
  ) THEN
    ALTER TABLE public.seo_sources
      ADD CONSTRAINT seo_sources_code_check
      CHECK (code IN ('gsc','google_trends','google_autocomplete','paa_apify','dvf','insee','ademe','newsapi','reddit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_sources_category_check'
  ) THEN
    ALTER TABLE public.seo_sources
      ADD CONSTRAINT seo_sources_category_check
      CHECK (category IN ('search_intent','real_estate_data','news','community','government'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_sources_weight_check'
  ) THEN
    ALTER TABLE public.seo_sources
      ADD CONSTRAINT seo_sources_weight_check
      CHECK (weight BETWEEN 0 AND 1);
  END IF;
END $$;

-- Seed 9 sources initiales (somme weights = 1.00)
INSERT INTO public.seo_sources (code, display_name, category, weight) VALUES
  ('gsc',                  'Google Search Console',     'search_intent',     0.25),
  ('google_trends',        'Google Trends',             'search_intent',     0.15),
  ('google_autocomplete',  'Google Autocomplete',       'search_intent',     0.10),
  ('paa_apify',            'People Also Ask (Apify)',   'search_intent',     0.10),
  ('dvf',                  'DVF (data.gouv.fr)',        'real_estate_data',  0.10),
  ('insee',                'INSEE démographie',         'real_estate_data',  0.05),
  ('ademe',                'ADEME DPE',                 'real_estate_data',  0.10),
  ('newsapi',              'NewsAPI immobilier',        'news',              0.05),
  ('reddit',               'Reddit r/ImmobilierFR',     'community',         0.10)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 2. Table seo_keywords — mots-clés dédupliqués normalisés
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_keywords (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_normalized       text UNIQUE NOT NULL,            -- lowercase + unaccent + trim
  keyword_display          text NOT NULL,                   -- version originale lisible
  language                 text NOT NULL DEFAULT 'fr',
  geo_scope                text,                            -- 'FR', 'Paris'… null = national
  category                 text,                            -- 'dpe', 'amiante', 'plomb', 'general'
  monthly_search_volume    int,                             -- estimation GSC/Trends
  competition              numeric(3,2),                    -- 0-1, provenance GSC
  intent_type              text,
  score                    numeric(5,2),                    -- score composite 0-100
  score_components         jsonb,                           -- détail par source
  score_computed_at        timestamptz,
  signal_count             int NOT NULL DEFAULT 0,
  first_seen_at            timestamptz NOT NULL DEFAULT now(),
  last_seen_at             timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_keywords_intent_type_check'
  ) THEN
    ALTER TABLE public.seo_keywords
      ADD CONSTRAINT seo_keywords_intent_type_check
      CHECK (intent_type IS NULL OR intent_type IN ('informational','transactional','navigational','commercial','unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_keywords_competition_check'
  ) THEN
    ALTER TABLE public.seo_keywords
      ADD CONSTRAINT seo_keywords_competition_check
      CHECK (competition IS NULL OR competition BETWEEN 0 AND 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_keywords_score_check'
  ) THEN
    ALTER TABLE public.seo_keywords
      ADD CONSTRAINT seo_keywords_score_check
      CHECK (score IS NULL OR score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Index de scoring / filtres admin
CREATE INDEX IF NOT EXISTS idx_seo_keywords_score
  ON public.seo_keywords (score DESC NULLS LAST)
  WHERE score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seo_keywords_category_score
  ON public.seo_keywords (category, score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_seo_keywords_geo_score
  ON public.seo_keywords (geo_scope, score DESC NULLS LAST);

-- Index trigram pour recherche fuzzy admin
CREATE INDEX IF NOT EXISTS idx_seo_keywords_normalized_trgm
  ON public.seo_keywords USING gin (keyword_normalized gin_trgm_ops);

-- ============================================================================
-- 3. Table seo_keyword_signals — signaux bruts par source
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_keyword_signals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id          uuid NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
  source_code         text NOT NULL REFERENCES public.seo_sources(code),
  signal_value        numeric NOT NULL,
  signal_type         text NOT NULL,                     -- 'volume','position','cpc','sentiment'
  metadata            jsonb,                             -- payload API source complet
  captured_at         timestamptz NOT NULL DEFAULT now(),
  ingestion_run_id    uuid
);

CREATE INDEX IF NOT EXISTS idx_seo_signals_keyword_source_time
  ON public.seo_keyword_signals (keyword_id, source_code, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_signals_source_time
  ON public.seo_keyword_signals (source_code, captured_at DESC);

-- ============================================================================
-- 4. Table seo_drafts — drafts générés par Claude (Kanban admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_drafts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id              uuid REFERENCES public.seo_keywords(id) ON DELETE SET NULL,
  title                   text NOT NULL,
  slug                    text UNIQUE NOT NULL,
  meta_description        text,
  content_markdown        text NOT NULL,
  content_html            text,                          -- rendu cached
  status                  text NOT NULL DEFAULT 'draft',
  eeat_score              numeric(3,1),                  -- 0-10
  eeat_validations        jsonb,                         -- { hasAnecdote, hasPhoto, hasFigures, hasExpertQuote }
  target_url              text,                          -- URL finale publication
  published_url           text,
  published_at            timestamptz,
  published_by            uuid REFERENCES auth.users(id),
  claude_model            text,
  claude_cost_eur         numeric(6,4),
  generation_prompt_id    text,                          -- id du prompt cached Anthropic
  revision_count          int NOT NULL DEFAULT 0,
  assigned_to             uuid REFERENCES auth.users(id),
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_drafts_status_check'
  ) THEN
    ALTER TABLE public.seo_drafts
      ADD CONSTRAINT seo_drafts_status_check
      CHECK (status IN ('draft','review','approved','published','archived','rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seo_drafts_eeat_score_check'
  ) THEN
    ALTER TABLE public.seo_drafts
      ADD CONSTRAINT seo_drafts_eeat_score_check
      CHECK (eeat_score IS NULL OR eeat_score BETWEEN 0 AND 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_seo_drafts_status_created
  ON public.seo_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_drafts_assigned_status
  ON public.seo_drafts (assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_seo_drafts_keyword
  ON public.seo_drafts (keyword_id);

-- ============================================================================
-- 5. Table seo_draft_versions — historique éditions TipTap
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_draft_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id            uuid NOT NULL REFERENCES public.seo_drafts(id) ON DELETE CASCADE,
  version_number      int NOT NULL,
  content_markdown    text NOT NULL,
  edit_summary        text,                              -- résumé du diff
  edited_by           uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_seo_draft_versions_draft_version
  ON public.seo_draft_versions (draft_id, version_number DESC);

-- ============================================================================
-- 6. Table seo_publications — articles publiés en prod avec metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.seo_publications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id              uuid NOT NULL REFERENCES public.seo_drafts(id),
  published_url         text NOT NULL,
  seo_title             text NOT NULL,
  seo_description       text NOT NULL,
  canonical_url         text,
  schema_org_json       jsonb,
  published_at          timestamptz NOT NULL DEFAULT now(),
  views_count           int NOT NULL DEFAULT 0,
  clicks_count          int NOT NULL DEFAULT 0,
  last_gsc_sync_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_seo_publications_published_at
  ON public.seo_publications (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_publications_url
  ON public.seo_publications (published_url);

-- ============================================================================
-- 7. Fonction compute_keyword_score(uuid) — score composite 0-100
-- ============================================================================
-- Agrège les signaux des 90 derniers jours, pondère par poids de source actif.
-- Volume normalisé sur 10k recherches/mois cap. Score plafonné à 100.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_keyword_score(p_keyword_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score   numeric := 0;
  v_signal  RECORD;
BEGIN
  FOR v_signal IN
    SELECT
      s.source_code,
      src.weight,
      AVG(s.signal_value) FILTER (WHERE s.signal_type = 'volume')    AS avg_volume,
      MAX(s.signal_value) FILTER (WHERE s.signal_type = 'sentiment') AS max_sentiment,
      MAX(s.captured_at)                                             AS latest_at
    FROM public.seo_keyword_signals s
    JOIN public.seo_sources src ON src.code = s.source_code
    WHERE s.keyword_id = p_keyword_id
      AND src.is_active = true
      AND s.captured_at >= now() - interval '90 days'
    GROUP BY s.source_code, src.weight
  LOOP
    -- Contribution : normalize signal × source weight × 100, capée par weight × 100
    v_score := v_score + LEAST(
      COALESCE(v_signal.avg_volume, 0) / 10000 * v_signal.weight * 100,
      v_signal.weight * 100
    );
  END LOOP;

  RETURN LEAST(100, GREATEST(0, v_score));
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_keyword_score(uuid) TO authenticated, service_role;

-- ============================================================================
-- 8. Fonction refresh_all_keyword_scores(int) — recompute batch stale
-- ============================================================================
-- Recalcule les scores des keywords dont score_computed_at est null ou plus
-- vieux de 24h. Limite par défaut 1000 keywords par appel (CRON friendly).
-- Retourne le nombre de keywords mis à jour.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_all_keyword_scores(p_limit int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   int := 0;
  v_record  RECORD;
BEGIN
  FOR v_record IN
    SELECT id FROM public.seo_keywords
    WHERE score_computed_at IS NULL OR score_computed_at < now() - interval '24 hours'
    ORDER BY score_computed_at NULLS FIRST
    LIMIT p_limit
  LOOP
    UPDATE public.seo_keywords
    SET score             = public.compute_keyword_score(v_record.id),
        score_computed_at = now()
    WHERE id = v_record.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_all_keyword_scores(int) TO service_role;

-- ============================================================================
-- 9. Triggers updated_at (réutilise update_updated_at() de init_schema)
-- ============================================================================
DO $$
BEGIN
  -- Si la fonction générique n'existe pas (sécurité), on la crée localement.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.update_updated_at()
      RETURNS trigger LANGUAGE plpgsql AS $body$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END $body$;
    $f$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seo_sources_updated'
  ) THEN
    CREATE TRIGGER trg_seo_sources_updated BEFORE UPDATE ON public.seo_sources
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seo_keywords_updated'
  ) THEN
    CREATE TRIGGER trg_seo_keywords_updated BEFORE UPDATE ON public.seo_keywords
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seo_drafts_updated'
  ) THEN
    CREATE TRIGGER trg_seo_drafts_updated BEFORE UPDATE ON public.seo_drafts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 10. Row Level Security
-- ============================================================================
ALTER TABLE public.seo_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keywords         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keyword_signals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_drafts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_draft_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_publications     ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- seo_sources : SELECT public (catalogue affiché en footer admin), mutations service_role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_sources' AND policyname = 'seo_sources_select_public'
  ) THEN
    CREATE POLICY seo_sources_select_public ON public.seo_sources
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- seo_keywords : SELECT authenticated, mutations service_role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_keywords' AND policyname = 'seo_keywords_select_auth'
  ) THEN
    CREATE POLICY seo_keywords_select_auth ON public.seo_keywords
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- seo_keyword_signals : service_role uniquement (pas de policy → RLS bloque tout
-- accès authenticated/anon, service_role bypass RLS par défaut)
-- ----------------------------------------------------------------------------
-- (Aucune policy créée volontairement : signaux bruts réservés au backend.)

-- ----------------------------------------------------------------------------
-- seo_drafts : SELECT/INSERT/UPDATE/DELETE admin uniquement
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_drafts' AND policyname = 'seo_drafts_select_admin'
  ) THEN
    CREATE POLICY seo_drafts_select_admin ON public.seo_drafts
      FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_drafts' AND policyname = 'seo_drafts_insert_admin'
  ) THEN
    CREATE POLICY seo_drafts_insert_admin ON public.seo_drafts
      FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_drafts' AND policyname = 'seo_drafts_update_admin'
  ) THEN
    CREATE POLICY seo_drafts_update_admin ON public.seo_drafts
      FOR UPDATE TO authenticated USING (public.is_admin((SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_drafts' AND policyname = 'seo_drafts_delete_admin'
  ) THEN
    CREATE POLICY seo_drafts_delete_admin ON public.seo_drafts
      FOR DELETE TO authenticated USING (public.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- seo_draft_versions : SELECT/INSERT admin uniquement
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_draft_versions' AND policyname = 'seo_draft_versions_select_admin'
  ) THEN
    CREATE POLICY seo_draft_versions_select_admin ON public.seo_draft_versions
      FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_draft_versions' AND policyname = 'seo_draft_versions_insert_admin'
  ) THEN
    CREATE POLICY seo_draft_versions_insert_admin ON public.seo_draft_versions
      FOR INSERT TO authenticated WITH CHECK (public.is_admin((SELECT auth.uid())));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- seo_publications : SELECT public (articles en ligne), mutations service_role
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seo_publications' AND policyname = 'seo_publications_select_public'
  ) THEN
    CREATE POLICY seo_publications_select_public ON public.seo_publications
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ============================================================================
-- Fin migration D1 — SEO Pipeline
-- ============================================================================
