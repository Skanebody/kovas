-- ============================================
-- KOVAS — addon_modules (9 modules activables séparément)
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4 (post-pivot tarifaire mai 2026)
--
-- Définition canonique des 9 modules add-on KOVAS. Chaque module peut être :
--   - inclus de base dans certains forfaits (cf. included_in_plans)
--   - souscrit individuellement avec essai gratuit 14j (cf. trial_duration_days)
--
-- Modifiable par les admins uniquement, lisible par tous.
-- ============================================

CREATE TABLE IF NOT EXISTS addon_modules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code           text NOT NULL UNIQUE,
  display_name          text NOT NULL,
  description           text NOT NULL,
  category              text NOT NULL
    CHECK (category IN ('ademe','ia','admin','community','analytics','workflow')),

  -- Pricing
  price_monthly_cents   int NOT NULL,
  stripe_product_id     text,
  stripe_price_id       text,

  -- Trial
  trial_duration_days   int NOT NULL DEFAULT 14,

  -- Inclusion par plan : array JSON de plan_code (ex: ["pro","all_inclusive","cabinet"])
  included_in_plans     jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Métadonnées
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            int NOT NULL DEFAULT 0,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addon_modules_code
  ON addon_modules (module_code)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_addon_modules_category
  ON addon_modules (category, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE addon_modules IS
  '9 modules add-on KOVAS V1, activables avec essai 14j. Lecture publique, écriture admin.';
COMMENT ON COLUMN addon_modules.included_in_plans IS
  'Array JSON de plan_code dans lesquels le module est inclus de base. Ex : ["pro","all_inclusive","cabinet"].';
COMMENT ON COLUMN addon_modules.category IS
  'Catégorie fonctionnelle pour grouper l''UI : ademe | ia | admin | community | analytics | workflow.';

-- RLS
ALTER TABLE addon_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addon_modules: public read" ON addon_modules;
CREATE POLICY "addon_modules: public read"
  ON addon_modules FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "addon_modules: admin insert" ON addon_modules;
CREATE POLICY "addon_modules: admin insert"
  ON addon_modules FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "addon_modules: admin update" ON addon_modules;
CREATE POLICY "addon_modules: admin update"
  ON addon_modules FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "addon_modules: admin delete" ON addon_modules;
CREATE POLICY "addon_modules: admin delete"
  ON addon_modules FOR DELETE
  USING (public.is_admin(auth.uid()));
