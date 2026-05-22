-- =============================================================
-- Alert system — philosophie KOVAS (cf. docs/ALERT-PHILOSOPHY.md)
-- =============================================================
-- 3 tables :
--  1. alert_preferences      — préférences par organisation (1 ligne / org)
--  2. alert_dismissals       — historique des ignorances utilisateur (audit + apprentissage)
--  3. alert_auto_disabled    — état courant : types d'alertes auto-désactivés
--
-- Toutes les tables sont RLS-protégées via public.is_member_of(organization_id).

-- -------------------------------------------------------------
-- 1. alert_preferences
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  fraud_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fraud_sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (fraud_sensitivity IN ('normal', 'low', 'very_low')),
  pre_export_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pre_export_strictness TEXT NOT NULL DEFAULT 'standard' CHECK (pre_export_strictness IN ('standard', 'permissive')),
  proactive_suggestions_mode TEXT NOT NULL DEFAULT 'checkout_only' CHECK (proactive_suggestions_mode IN ('disabled', 'checkout_only', 'in_mission')),
  coach_ai_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  coach_ai_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (coach_ai_frequency IN ('weekly', 'monthly', 'quarterly', 'disabled')),
  lead_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lead_notifications_quiet_hours_start TIME NOT NULL DEFAULT '20:00',
  lead_notifications_quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  lead_notifications_weekend BOOLEAN NOT NULL DEFAULT FALSE,
  gamification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  level_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_preferences_org ON alert_preferences(organization_id);

-- -------------------------------------------------------------
-- 2. alert_dismissals — audit + apprentissage
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  alert_subtype TEXT,
  context JSONB,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dismissals_org_type ON alert_dismissals(organization_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_dismissals_org_type_subtype ON alert_dismissals(organization_id, alert_type, alert_subtype);
CREATE INDEX IF NOT EXISTS idx_dismissals_dismissed_at ON alert_dismissals(dismissed_at DESC);

-- -------------------------------------------------------------
-- 3. alert_auto_disabled — état courant
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_auto_disabled (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  alert_subtype TEXT,
  disabled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE (organization_id, alert_type, alert_subtype)
);

CREATE INDEX IF NOT EXISTS idx_auto_disabled_org ON alert_auto_disabled(organization_id);

-- -------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_auto_disabled ENABLE ROW LEVEL SECURITY;

-- alert_preferences
DROP POLICY IF EXISTS "alert_pref: org read" ON alert_preferences;
CREATE POLICY "alert_pref: org read" ON alert_preferences
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "alert_pref: org write" ON alert_preferences;
CREATE POLICY "alert_pref: org write" ON alert_preferences
  FOR ALL TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- alert_dismissals
DROP POLICY IF EXISTS "alert_dismissals: org read" ON alert_dismissals;
CREATE POLICY "alert_dismissals: org read" ON alert_dismissals
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "alert_dismissals: org write" ON alert_dismissals;
CREATE POLICY "alert_dismissals: org write" ON alert_dismissals
  FOR ALL TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- alert_auto_disabled
DROP POLICY IF EXISTS "alert_auto_disabled: org read" ON alert_auto_disabled;
CREATE POLICY "alert_auto_disabled: org read" ON alert_auto_disabled
  FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "alert_auto_disabled: org write" ON alert_auto_disabled;
CREATE POLICY "alert_auto_disabled: org write" ON alert_auto_disabled
  FOR ALL TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- -------------------------------------------------------------
-- Trigger : updated_at sur alert_preferences
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_alert_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alert_preferences_updated_at ON alert_preferences;
CREATE TRIGGER trg_alert_preferences_updated_at
  BEFORE UPDATE ON alert_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_alert_preferences_updated_at();

COMMENT ON TABLE alert_preferences IS 'Préférences d''alertes par organisation — philosophie KOVAS : sobre, non bloquant, max 3 alertes/mission.';
COMMENT ON TABLE alert_dismissals IS 'Historique des ignorances — alimente le moteur d''apprentissage (5 ignorances → auto-disable).';
COMMENT ON TABLE alert_auto_disabled IS 'Types d''alertes auto-désactivés. État courant unique par (org, type, subtype).';
