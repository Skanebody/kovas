-- ============================================
-- KOVAS — Module Utilities (5 gadgets metier)
-- Date : 2026-05-23
-- Authority : CLAUDE.md §3 + brief module Utilities
-- ============================================

CREATE TABLE IF NOT EXISTS utilities_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  utility text NOT NULL CHECK (utility IN (
    'diagnostic_requirements',
    'validity_checker',
    'surface_calculator',
    'client_template_generator',
    'pre_departure_checklist'
  )),
  context jsonb,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_utilities_usage_user
  ON utilities_usage(user_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_utilities_usage_utility
  ON utilities_usage(utility, used_at DESC);

ALTER TABLE utilities_usage ENABLE ROW LEVEL SECURITY;

-- Politique unique : chaque user voit/écrit uniquement ses propres traces.
-- L'organization_id est dénormalisé pour faciliter les futures stats admin.
DROP POLICY IF EXISTS "utilities_usage_self" ON utilities_usage;
CREATE POLICY "utilities_usage_self"
  ON utilities_usage
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
