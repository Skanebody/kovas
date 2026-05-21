-- ============================================
-- KOVAS App — Module 8 : Sources réglementaires (CENTRAL global)
-- Date : 2026-05-25
-- Référentiel système. Pas d'organization_id : ce sont des sources publiques.
-- ============================================

CREATE TABLE regulatory_sources (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  text NOT NULL UNIQUE,
  name                  text NOT NULL,
  authority             text NOT NULL, -- 'legifrance' | 'ademe' | 'cstb' | 'cofrac' | 'dgccrf' | ...
  url                   text NOT NULL,
  feed_url              text,          -- RSS/Atom si dispo
  api_url               text,          -- API JSON si dispo (PISTE pour Légifrance)
  fetch_method          text NOT NULL DEFAULT 'http_scrape'
    CHECK (fetch_method IN ('http_scrape','rss','atom','api','manual')),
  fetch_frequency_hours int NOT NULL DEFAULT 24,
  -- Sélecteurs CSS / XPath / JSON path pour parser le contenu (selon fetch_method).
  parser_config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Robustesse opérationnelle.
  is_active             boolean NOT NULL DEFAULT true,
  last_fetched_at       timestamptz,
  last_success_at       timestamptz,
  last_error            text,
  consecutive_failures  int NOT NULL DEFAULT 0,
  -- Étiquetage : 'critical' = blocage métier si KO > 48h ; 'standard' = best effort.
  reliability           text NOT NULL DEFAULT 'standard'
    CHECK (reliability IN ('critical','standard','experimental')),
  -- Conformité robots.txt / ToS — à valider manuellement avant activation.
  robots_txt_checked    boolean NOT NULL DEFAULT false,
  tos_compatible        boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reg_sources_active ON regulatory_sources (is_active, last_fetched_at);
CREATE INDEX idx_reg_sources_authority ON regulatory_sources (authority);

COMMENT ON TABLE regulatory_sources IS
  'Sources de veille réglementaire (Légifrance, ADEME, COFRAC, etc.). Référentiel système global, lecture publique.';

CREATE TRIGGER trg_reg_sources_updated BEFORE UPDATE ON regulatory_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE regulatory_sources ENABLE ROW LEVEL SECURITY;

-- SELECT public (tout authentifié).
CREATE POLICY "regulatory_sources_public_read"
  ON regulatory_sources FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE admin uniquement.
CREATE POLICY "regulatory_sources_admin_write"
  ON regulatory_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "regulatory_sources_admin_update"
  ON regulatory_sources FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "regulatory_sources_admin_delete"
  ON regulatory_sources FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION regulatory_sources
-- ============================================
