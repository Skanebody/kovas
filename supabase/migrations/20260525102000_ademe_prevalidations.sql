-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — ademe_prevalidations
--
-- Pré-validation locale d'un DPE avant publication ADEME : check des
-- 10 règles de cohérence (cf. ademe_coherence_rules), détection
-- d'anomalies, score qualité, suggestions correctives. Une mission peut
-- avoir plusieurs prévalidations (itérations diag → correction → re-run).
-- ============================================

CREATE TABLE IF NOT EXISTS ademe_prevalidations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id            uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- État de la prévalidation
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','running','passed','failed','warning','superseded')),
  triggered_by          text NOT NULL DEFAULT 'manual'
                          CHECK (triggered_by IN ('manual','auto_on_save','auto_pre_export','scheduled')),

  -- Résultats agrégés
  total_rules_checked   int NOT NULL DEFAULT 0,
  rules_passed          int NOT NULL DEFAULT 0,
  rules_failed          int NOT NULL DEFAULT 0,
  rules_warning         int NOT NULL DEFAULT 0,
  quality_score         numeric(4,3),                    -- 0-1 float, score qualité global

  -- Détails (par règle déclenchée)
  -- Format JSONB : [{ "rule_code": "PAC_AIR_SANS_CLIM", "severity": "warning",
  --                   "message": "...", "suggested_fix": "...", "fields": ["type_chauffage"] }]
  findings              jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Snapshot des données ayant servi à la validation (audit + reproductibilité)
  snapshot_payload      jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Décision diagnostiqueur
  acknowledged          boolean NOT NULL DEFAULT false,
  acknowledged_at       timestamptz,
  acknowledged_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  override_reason       text,                            -- justification métier si override

  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prevalidations_org
  ON ademe_prevalidations (organization_id);
CREATE INDEX IF NOT EXISTS idx_prevalidations_mission
  ON ademe_prevalidations (mission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prevalidations_user
  ON ademe_prevalidations (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prevalidations_status
  ON ademe_prevalidations (organization_id, status, created_at DESC);

COMMENT ON TABLE ademe_prevalidations IS
  'Pré-validations locales d''un DPE avant publication ADEME. Exécute le moteur de cohérence (ademe_coherence_rules) et produit findings + score qualité.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ademe_prevalidations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ademe_prevalidations"
  ON ademe_prevalidations FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert ademe_prevalidations"
  ON ademe_prevalidations FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update ademe_prevalidations"
  ON ademe_prevalidations FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete ademe_prevalidations"
  ON ademe_prevalidations FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
