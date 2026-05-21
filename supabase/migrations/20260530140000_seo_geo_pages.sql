-- ============================================
-- KOVAS — SEO Geo Pages (Mission C1)
-- ============================================
-- Table qui stocke les pages SEO locales générées (city / department / region)
-- pour les 500 villes priority FR + 96 départements + 13 régions.
-- Contenu généré par Claude Haiku (Tier 1/2) ou template statique (Tier 3).
-- Routes Next.js : /diagnostiqueurs/[dept] et /diagnostiqueurs/[dept]/[city].
-- ============================================

CREATE TABLE IF NOT EXISTS seo_geo_pages (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type                   text NOT NULL CHECK (page_type IN ('city', 'department', 'region')),
  slug                        text NOT NULL UNIQUE,
  -- Identité géo
  city_slug                   text,
  city_name                   text,
  department_code             text NOT NULL,
  department_name             text,
  region_code                 text,
  region_name                 text,
  -- SEO
  h1_title                    text NOT NULL,
  meta_title                  text NOT NULL,
  meta_description            text NOT NULL,
  canonical_url               text,
  -- Contenu (généré par Claude Haiku Tier 1/2, template Tier 3)
  intro_content               text,
  long_form_content           text,
  faq_items                   jsonb,
  -- Stats locales (snapshot regen — données INSEE / DVF / count diag)
  diagnosticians_count        int NOT NULL DEFAULT 0,
  average_price_dpe           numeric(10, 2),
  transactions_count_dvf      int,
  avg_price_per_m2            numeric(10, 2),
  population                  int,
  -- Schema.org JSON-LD
  schema_jsonld               jsonb,
  -- Priorité (1 = Paris, 500 = dernière ville)
  priority_rank               int NOT NULL,
  generation_tier             int NOT NULL CHECK (generation_tier IN (1, 2, 3)),
  -- Audit
  last_regenerated_at         timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_geo_priority
  ON seo_geo_pages(priority_rank, page_type);

CREATE INDEX IF NOT EXISTS idx_seo_geo_dept
  ON seo_geo_pages(department_code, page_type);

CREATE INDEX IF NOT EXISTS idx_seo_geo_page_type
  ON seo_geo_pages(page_type);

-- Trigger updated_at standard
CREATE OR REPLACE FUNCTION update_seo_geo_pages_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seo_geo_pages_updated_at ON seo_geo_pages;
CREATE TRIGGER trg_seo_geo_pages_updated_at
  BEFORE UPDATE ON seo_geo_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_geo_pages_updated_at();

-- RLS : lecture publique (SEO), écriture service_role uniquement
ALTER TABLE seo_geo_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_geo_pages_public_read" ON seo_geo_pages;
CREATE POLICY "seo_geo_pages_public_read"
  ON seo_geo_pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Aucun policy INSERT/UPDATE/DELETE : seul service_role (Edge Function avec
-- bypass RLS) peut écrire — protection contre toute mutation utilisateur.

COMMENT ON TABLE seo_geo_pages IS
  'Pages SEO locales générées (500 villes FR + 96 départements + 13 régions). Mission C1.';
COMMENT ON COLUMN seo_geo_pages.page_type IS
  'city | department | region — détermine la route Next.js qui consomme la ligne.';
COMMENT ON COLUMN seo_geo_pages.priority_rank IS
  'Rang de priorité 1-500 (1 = Paris). Trie l''ordre de génération et tier.';
COMMENT ON COLUMN seo_geo_pages.generation_tier IS
  '1 = Top 100 (Haiku long-form 1100 mots + 5 FAQ) · 2 = 101-300 (Haiku 600 mots + 3 FAQ) · 3 = 301-500 (template statique INSEE).';
COMMENT ON COLUMN seo_geo_pages.faq_items IS
  'JSON array [{question, answer}, ...] — 3 ou 5 entrées selon tier.';
COMMENT ON COLUMN seo_geo_pages.schema_jsonld IS
  'JSON-LD pré-calculé schema.org (LocalBusiness pour city, Place pour department).';
