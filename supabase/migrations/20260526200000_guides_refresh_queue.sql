-- ============================================================================
-- Guides Refresh Queue — Pipeline IA d'auto-update des guides longs /guide/*
-- Lot B65 (refonte-acqui-target-2026-05)
-- ============================================================================
-- Objectif : pipeline cron hebdo qui rafraîchit les 9 guides longs
-- (`apps/web/src/app/guide/[type]`) avec des infos fraîches issues de
-- sources officielles (ADEME, INSEE, DHUP, Géorisques, Légifrance).
--
-- Méthode (Edge Function `refresh-guides-content`) :
--   1. Sélection du prochain guide due for refresh (rotation par slug)
--   2. Fetch sources externes (web_search Anthropic ou WebSearch API)
--   3. Extraction chiffres clés via Claude Haiku (cheap)
--   4. Régénération draft Markdown via Claude Sonnet (cached system prompt)
--   5. Sauvegarde dans `internal.guide_refresh_queue` (status='draft_ready')
--   6. Notification admin via Resend → validation manuelle sur /admin/guides-refresh
--   7. Approbation → snapshot dans `internal.guide_versions` (historique)
--
-- Distinct du pipeline `veille_articles_draft` (Amandine Bart) qui génère
-- des articles SEO ponctuels. Ici on rafraîchit les **guides existants**
-- versionnés et publiés.
--
-- Tables :
--   - internal.guide_refresh_queue  : file des drafts en cours
--   - internal.guide_versions       : historique des versions publiées
-- ============================================================================

-- Pré-requis : le schéma `internal` est créé par
-- `20260525170000_data_lake_schemas.sql`. On le re-crée par sécurité.
CREATE SCHEMA IF NOT EXISTS internal;

-- ============================================================================
-- 1. Table internal.guide_refresh_queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS internal.guide_refresh_queue (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug            text NOT NULL,
  scheduled_for         timestamptz NOT NULL DEFAULT now(),
  processed_at          timestamptz,
  status                text NOT NULL DEFAULT 'pending',

  -- Résultat du pipeline IA (draft Markdown + metadata structurée)
  draft_content         jsonb,
  -- Sources externes fetchées et utilisées pour la régénération
  -- Forme : [{ title, url, organization, published_at, excerpt }]
  sources_fetched       jsonb,
  -- Chiffres clés extraits par Haiku (audit traceable)
  -- Forme : [{ figure, context, source_url, source_org }]
  key_figures           jsonb,

  -- Métadonnées IA (coût + tokens)
  ai_model_extraction   text,
  ai_model_generation   text,
  ai_input_tokens       int NOT NULL DEFAULT 0,
  ai_output_tokens      int NOT NULL DEFAULT 0,
  ai_cache_read_tokens  int NOT NULL DEFAULT 0,
  ai_cost_eur           numeric(8, 4) NOT NULL DEFAULT 0,

  -- Workflow validation (parallèle à veille_articles_draft)
  reviewed_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  review_notes          text,
  error_log             text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guide_refresh_queue_status_check'
  ) THEN
    ALTER TABLE internal.guide_refresh_queue
      ADD CONSTRAINT guide_refresh_queue_status_check
      CHECK (status IN ('pending', 'processing', 'draft_ready', 'approved', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guide_refresh_queue_slug_check'
  ) THEN
    ALTER TABLE internal.guide_refresh_queue
      ADD CONSTRAINT guide_refresh_queue_slug_check
      CHECK (guide_slug IN (
        'dpe', 'amiante', 'plomb', 'gaz', 'electricite',
        'termites', 'carrez', 'erp', 'audit-energetique'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guide_refresh_queue_slug_status
  ON internal.guide_refresh_queue (guide_slug, status);

CREATE INDEX IF NOT EXISTS idx_guide_refresh_queue_scheduled
  ON internal.guide_refresh_queue (scheduled_for)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_guide_refresh_queue_ready
  ON internal.guide_refresh_queue (created_at DESC)
  WHERE status = 'draft_ready';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION internal.guide_refresh_queue_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = internal, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guide_refresh_queue_updated_at ON internal.guide_refresh_queue;
CREATE TRIGGER trg_guide_refresh_queue_updated_at
  BEFORE UPDATE ON internal.guide_refresh_queue
  FOR EACH ROW
  EXECUTE FUNCTION internal.guide_refresh_queue_touch_updated_at();

-- ============================================================================
-- 2. Table internal.guide_versions — historique des versions publiées
-- ============================================================================
CREATE TABLE IF NOT EXISTS internal.guide_versions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_slug            text NOT NULL,
  version_number        int NOT NULL,
  -- Contenu Markdown long (5000+ mots typique)
  content_md            text NOT NULL,
  -- JSON-LD Schema.org Article (pré-calculé pour insertion directe en head)
  schema_org_jsonld     jsonb,
  -- Compteur de sources externes citées (pour suivi qualité E-E-A-T)
  sources_count         int NOT NULL DEFAULT 0,
  word_count            int NOT NULL DEFAULT 0,
  -- Référence vers le draft d'origine (traçabilité)
  source_draft_id       uuid REFERENCES internal.guide_refresh_queue(id) ON DELETE SET NULL,
  published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guide_versions_slug_check'
  ) THEN
    ALTER TABLE internal.guide_versions
      ADD CONSTRAINT guide_versions_slug_check
      CHECK (guide_slug IN (
        'dpe', 'amiante', 'plomb', 'gaz', 'electricite',
        'termites', 'carrez', 'erp', 'audit-energetique'
      ));
  END IF;

  -- Unicité (guide_slug, version_number) — pas de doublon de version
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guide_versions_slug_version_unique'
  ) THEN
    ALTER TABLE internal.guide_versions
      ADD CONSTRAINT guide_versions_slug_version_unique
      UNIQUE (guide_slug, version_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_guide_versions_slug_latest
  ON internal.guide_versions (guide_slug, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_guide_versions_published_at
  ON internal.guide_versions (published_at DESC);

-- ============================================================================
-- 3. RLS — service_role only (admin-facing via Server Components)
-- ============================================================================
ALTER TABLE internal.guide_refresh_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal.guide_versions ENABLE ROW LEVEL SECURITY;

-- Aucune policy permissive → seul service_role peut SELECT/INSERT/UPDATE.
-- Les Server Components admin utilisent createAdminClient() qui injecte
-- SERVICE_ROLE_KEY et bypass RLS. Les utilisateurs anon/authenticated
-- ne voient strictement rien.

-- Grants explicites
GRANT USAGE ON SCHEMA internal TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON internal.guide_refresh_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON internal.guide_versions TO service_role;

-- REVOKE explicite des rôles publics par sécurité
REVOKE ALL ON internal.guide_refresh_queue FROM anon, authenticated, public;
REVOKE ALL ON internal.guide_versions FROM anon, authenticated, public;

-- ============================================================================
-- 4. Helper RPC : sélectionner le prochain guide à rafraîchir
-- ============================================================================
-- Rotation : pick le guide_slug dont la dernière version publiée (ou le
-- dernier draft pending) est le plus ancien, parmi les 9 slugs supportés.
-- Permet au cron hebdo (lundi 04h UTC) de couvrir les 9 guides en ~9 semaines.
CREATE OR REPLACE FUNCTION internal.guides_pick_next_for_refresh(limit_count int DEFAULT 3)
RETURNS TABLE (
  guide_slug text,
  last_refreshed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = internal, public
STABLE
AS $$
  WITH all_slugs AS (
    SELECT unnest(ARRAY[
      'dpe', 'amiante', 'plomb', 'gaz', 'electricite',
      'termites', 'carrez', 'erp', 'audit-energetique'
    ]::text[]) AS slug
  ),
  last_activity AS (
    SELECT
      s.slug,
      GREATEST(
        COALESCE(
          (SELECT MAX(published_at) FROM internal.guide_versions WHERE guide_slug = s.slug),
          'epoch'::timestamptz
        ),
        COALESCE(
          (SELECT MAX(created_at) FROM internal.guide_refresh_queue
           WHERE guide_slug = s.slug AND status IN ('pending', 'processing', 'draft_ready')),
          'epoch'::timestamptz
        )
      ) AS last_at
    FROM all_slugs s
  )
  SELECT slug AS guide_slug, last_at AS last_refreshed_at
  FROM last_activity
  ORDER BY last_at ASC
  LIMIT GREATEST(limit_count, 1);
$$;

GRANT EXECUTE ON FUNCTION internal.guides_pick_next_for_refresh(int) TO service_role;
REVOKE EXECUTE ON FUNCTION internal.guides_pick_next_for_refresh(int) FROM anon, authenticated, public;

-- ============================================================================
-- 5. Helper RPC : version courante d'un guide (dernière approuvée)
-- ============================================================================
CREATE OR REPLACE FUNCTION internal.guides_current_version(p_slug text)
RETURNS TABLE (
  id uuid,
  guide_slug text,
  version_number int,
  content_md text,
  sources_count int,
  word_count int,
  published_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = internal, public
STABLE
AS $$
  SELECT id, guide_slug, version_number, content_md, sources_count, word_count, published_at
  FROM internal.guide_versions
  WHERE guide_slug = p_slug
  ORDER BY version_number DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION internal.guides_current_version(text) TO service_role;
REVOKE EXECUTE ON FUNCTION internal.guides_current_version(text) FROM anon, authenticated, public;

-- ============================================================================
-- COMMIT
-- ============================================================================
COMMENT ON TABLE internal.guide_refresh_queue IS
  'Lot B65 — File de drafts IA pour la mise à jour automatique des 9 guides longs /guide/*. Pipeline cron hebdo (`refresh-guides-content`) : fetch sources officielles + extraction chiffres (Haiku) + régénération (Sonnet cached) → validation admin sur /admin/guides-refresh.';

COMMENT ON TABLE internal.guide_versions IS
  'Lot B65 — Historique versionné des publications des guides /guide/*. Une ligne par publication approuvée (admin). Référence vers le draft d''origine pour traçabilité.';

COMMENT ON FUNCTION internal.guides_pick_next_for_refresh(int) IS
  'Lot B65 — Rotation : retourne les N guide_slug les moins récemment rafraîchis (publiés OU en draft pending). Utilisé par le cron `refresh-guides-content` pour couvrir les 9 guides en ~9 semaines.';
