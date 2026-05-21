-- ============================================
-- KOVAS — Module 2 (Standardisation IA) — parameter_suggestions
--
-- Suggestions paramétrées émises par les modèles ML (cf. ml_models) sur
-- des champs d'une mission : suggestion de valeur, score de confiance,
-- alternatives, justification, données d'entraînement référencées.
-- Le diagnostiqueur accepte / rejette / corrige, ce qui alimente le
-- feedback loop d'auto-apprentissage (cf. ai-autonomy-strategy.md §9).
-- ============================================

CREATE TABLE IF NOT EXISTS parameter_suggestions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mission_id            uuid REFERENCES missions(id) ON DELETE CASCADE,
  -- FK ajoutée par migration suivante (20260525111000_ml_models.sql) : table ml_models créée après celle-ci.
  ml_model_id           uuid,

  -- Champ ciblé
  target_table          text NOT NULL,                   -- ex: 'missions' | 'properties' | 'equipment_findings'
  target_record_id      uuid,                            -- id de la row visée (nullable si pré-création)
  field_name            text NOT NULL,                   -- ex: 'type_chauffage'
  field_kind            text,                            -- ex: 'enum' | 'numeric' | 'text' | 'boolean'

  -- Suggestion
  suggested_value       jsonb NOT NULL,                  -- valeur typée (object pour cohérence)
  alternatives          jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "value": ..., "score": 0.42 }]
  confidence_score      numeric(4,3) NOT NULL,           -- 0-1 float
  explanation           text,                            -- justification courte affichable

  -- Données d'entraînement référencées (audit traçabilité)
  features_snapshot     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source                text NOT NULL DEFAULT 'ml_model'
                          CHECK (source IN ('ml_model','heuristic','claude','manual_override')),

  -- Décision utilisateur (feedback loop)
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected','corrected','expired')),
  decided_at            timestamptz,
  decided_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrected_value       jsonb,                           -- si status='corrected'
  rejection_reason      text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_param_sugg_org
  ON parameter_suggestions (organization_id);
CREATE INDEX IF NOT EXISTS idx_param_sugg_user
  ON parameter_suggestions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_param_sugg_mission
  ON parameter_suggestions (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_param_sugg_model
  ON parameter_suggestions (ml_model_id) WHERE ml_model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_param_sugg_pending
  ON parameter_suggestions (organization_id, status, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_param_sugg_target
  ON parameter_suggestions (target_table, target_record_id)
  WHERE target_record_id IS NOT NULL;

COMMENT ON TABLE parameter_suggestions IS
  'Suggestions de paramètres émises par les modèles ML KOVAS sur des champs de missions/properties/equipment. Accepté/rejeté/corrigé par le diagnostiqueur, alimente l''auto-apprentissage.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE parameter_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read parameter_suggestions"
  ON parameter_suggestions FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert parameter_suggestions"
  ON parameter_suggestions FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update parameter_suggestions"
  ON parameter_suggestions FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete parameter_suggestions"
  ON parameter_suggestions FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
