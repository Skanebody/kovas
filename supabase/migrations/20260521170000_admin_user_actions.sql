-- ============================================
-- KOVAS — Admin user actions (itération 4/N — Section Utilisateurs)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 / prompt itération 4
--
-- Ajoute :
--   1. Colonnes organizations : ai_cap_daily_cents, ai_cap_monthly_cents,
--      suspended_at, suspension_reason (override per-org des defaults plan).
--   2. Table admin_notes : notes internes admin sur user OU org.
--
-- Toutes les colonnes restent NULL par défaut (no breaking change) — la logique
-- métier consultera `coalesce(ai_cap_daily_cents, default_per_plan)`.
-- ============================================

-- 1. Caps IA personnalisés + suspension org
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_cap_daily_cents int,
  ADD COLUMN IF NOT EXISTS ai_cap_monthly_cents int,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

CREATE INDEX IF NOT EXISTS idx_orgs_suspended
  ON organizations (suspended_at)
  WHERE suspended_at IS NOT NULL;

-- 2. admin_notes : notes internes (user OU org, l'une OU l'autre non-null)
CREATE TABLE IF NOT EXISTS admin_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  note            text NOT NULL,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_admin_notes_org
  ON admin_notes (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notes_user
  ON admin_notes (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_notes_select" ON admin_notes;
CREATE POLICY "admin_notes_select" ON admin_notes
  FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_notes_insert" ON admin_notes;
CREATE POLICY "admin_notes_insert" ON admin_notes
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid());

-- (Pas d'UPDATE/DELETE : notes append-only par défaut. Suppression possible
-- ultérieurement via service_role si nécessaire — pas via RLS user-scoped.)
