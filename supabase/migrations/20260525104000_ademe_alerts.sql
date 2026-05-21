-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — ademe_alerts
--
-- Alertes opérationnelles émises par le Cockpit ADEME : anomalies
-- détectées (cas isolés via règles cohérence), patterns suspects
-- (récurrence > seuil), incidents publication ADEME, dérives KPIs
-- (chute taux A-C, hausse F-G inhabituelle, etc.).
-- ============================================

CREATE TABLE IF NOT EXISTS ademe_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mission_id            uuid REFERENCES missions(id) ON DELETE CASCADE,
  prevalidation_id      uuid REFERENCES ademe_prevalidations(id) ON DELETE SET NULL,
  rule_id               uuid REFERENCES ademe_coherence_rules(id) ON DELETE SET NULL,

  alert_code            text NOT NULL,                   -- ex: PAC_AIR_SANS_CLIM | DRIFT_FG_RATIO | PUBLISH_FAILED
  severity              text NOT NULL DEFAULT 'warning'
                          CHECK (severity IN ('info','warning','error','critical')),
  title                 text NOT NULL,
  message               text NOT NULL,
  context               jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Cycle de vie
  resolved_at           timestamptz,
  resolved_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note       text,

  -- Notifications (qui a été notifié)
  notified_channels     text[] NOT NULL DEFAULT '{}',    -- ex: {in_app, email, telegram}
  notified_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ademe_alerts_org
  ON ademe_alerts (organization_id);
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_user
  ON ademe_alerts (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_mission
  ON ademe_alerts (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_prevalidation
  ON ademe_alerts (prevalidation_id) WHERE prevalidation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_rule
  ON ademe_alerts (rule_id) WHERE rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_open
  ON ademe_alerts (organization_id, severity, resolved_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_alerts_created
  ON ademe_alerts (organization_id, created_at DESC);

COMMENT ON TABLE ademe_alerts IS
  'Alertes Cockpit ADEME : anomalies de cohérence, patterns suspects, dérives KPIs, incidents publication. Cycle resolved/unresolved par diagnostiqueur.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ademe_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ademe_alerts"
  ON ademe_alerts FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert ademe_alerts"
  ON ademe_alerts FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update ademe_alerts"
  ON ademe_alerts FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete ademe_alerts"
  ON ademe_alerts FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
