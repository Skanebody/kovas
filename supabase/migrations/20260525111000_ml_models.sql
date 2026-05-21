-- ============================================
-- KOVAS — Module 2 (Standardisation IA) — ml_models
--
-- Registre des modèles ML KOVAS (versions, métriques, statut, artefacts).
-- Modèles globaux, partagés par tous les diagnostiqueurs : pas de
-- `organization_id`. Écriture admin uniquement, lecture publique
-- authentifiée pour traçabilité des suggestions.
--
-- Cf. ai-autonomy-strategy.md §9 — auto-apprentissage continu.
-- ============================================

CREATE TABLE IF NOT EXISTS ml_models (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL,                   -- ex: 'field_suggester_chauffage'
  name                  text NOT NULL,                   -- nom lisible
  version               text NOT NULL,                   -- ex: '1.4.2'

  -- Type / framework
  model_kind            text NOT NULL                    -- classifier | regressor | embedder | parser | vision
                          CHECK (model_kind IN ('classifier','regressor','embedder','parser','vision','llm_wrapper','heuristic')),
  framework             text,                            -- ex: 'pytorch' | 'scikit_learn' | 'onnx' | 'llama_finetune'
  base_model            text,                            -- ex: 'llama-3.3-70b-instruct' | 'whisper-large-v3'

  -- Target / scope
  target_table          text,                            -- ex: 'missions' | 'equipment_findings'
  target_field          text,                            -- ex: 'type_chauffage'

  -- Artefacts
  artifact_path         text,                            -- chemin Supabase Storage ou registry
  artifact_hash         text,                            -- SHA-256 reproductibilité
  config                jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Métriques (snapshot d'entraînement / validation)
  metrics               jsonb NOT NULL DEFAULT '{}'::jsonb,
                                                         -- ex: { "accuracy": 0.94, "f1": 0.91, "auc": 0.97,
                                                         --       "n_train": 12450, "n_test": 1500 }
  training_dataset_ref  text,                            -- ex: 's3://kovas-ml/datasets/chauffage_v3'
  trained_at            timestamptz,
  trained_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Cycle de vie
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','training','staging','production','deprecated','archived')),
  deployed_at           timestamptz,
  retired_at            timestamptz,

  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (code, version)
);

CREATE INDEX IF NOT EXISTS idx_ml_models_code
  ON ml_models (code);
CREATE INDEX IF NOT EXISTS idx_ml_models_status
  ON ml_models (status) WHERE status IN ('staging','production');
CREATE INDEX IF NOT EXISTS idx_ml_models_target
  ON ml_models (target_table, target_field)
  WHERE target_table IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ml_models_kind
  ON ml_models (model_kind);

COMMENT ON TABLE ml_models IS
  'Registre des modèles ML KOVAS (versions, métriques, artefacts, cycle de vie). Modèles globaux partagés, écriture admin uniquement.';

-- ============================================
-- FK ajoutée à parameter_suggestions (créée à la migration précédente)
-- ============================================
ALTER TABLE parameter_suggestions
  ADD CONSTRAINT fk_param_sugg_ml_model
  FOREIGN KEY (ml_model_id) REFERENCES ml_models(id) ON DELETE SET NULL;

-- ============================================
-- RLS
-- - SELECT : tout utilisateur authentifié (registre partagé, traçabilité)
-- - INSERT/UPDATE/DELETE : admins KOVAS uniquement
-- ============================================
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read ml_models"
  ON ml_models FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins insert ml_models"
  ON ml_models FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins update ml_models"
  ON ml_models FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins delete ml_models"
  ON ml_models FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
