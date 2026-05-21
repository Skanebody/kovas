-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — ademe_coherence_rules
--
-- Catalogue système des règles de cohérence ADEME (arrêté 31 mars 2021
-- méthode 3CL-2021 + arrêté 25 mars 2024 modificatif). Règles globales,
-- partagées par tous les diagnostiqueurs : pas de `organization_id`.
-- Lecture publique authentifiée, écriture admin uniquement (is_admin).
--
-- Format `rule_logic` JSONB exécutable :
--   { "operator": "AND" | "OR",
--     "conditions": [
--       { "field": "type_chauffage", "op": "eq" | "ne" | "in" | "gt" | "lt"
--                                       | "between" | "is_null" | "is_not_null"
--                                       | "matches",
--         "value": ... } ] }
-- ============================================

CREATE TABLE IF NOT EXISTS ademe_coherence_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code             text NOT NULL UNIQUE,            -- ex: PAC_AIR_SANS_CLIM (identifiant stable code)
  title                 text NOT NULL,
  description           text NOT NULL,
  diagnostic_types      text[] NOT NULL DEFAULT '{dpe_vente,dpe_location}',
  severity              text NOT NULL DEFAULT 'warning'
                          CHECK (severity IN ('info','warning','error','blocking')),

  -- Logique exécutable
  rule_logic            jsonb NOT NULL,
  suggested_fix         text,                            -- texte indicatif affiché au diag

  -- Références réglementaires
  source_url            text,                            -- lien Légifrance arrêté
  source_reference      text,                            -- ex: "Arrêté 31/03/2021, annexe 1 §2.4"
  applies_from          date,                            -- entrée en vigueur de la règle
  applies_until         date,                            -- abrogation éventuelle

  enabled               boolean NOT NULL DEFAULT true,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coherence_rules_enabled
  ON ademe_coherence_rules (enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_coherence_rules_severity
  ON ademe_coherence_rules (severity) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_coherence_rules_diag_types
  ON ademe_coherence_rules USING gin (diagnostic_types);

COMMENT ON TABLE ademe_coherence_rules IS
  'Catalogue système des règles de cohérence ADEME (arrêté 31/03/2021 méthode 3CL-2021 + arrêté 25/03/2024). Règles globales partagées par tous les diagnostiqueurs.';

-- ============================================
-- RLS
-- - SELECT : tout utilisateur authentifié (catalogue partagé)
-- - INSERT/UPDATE/DELETE : admins KOVAS uniquement
-- ============================================
ALTER TABLE ademe_coherence_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read coherence_rules"
  ON ademe_coherence_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admins insert coherence_rules"
  ON ademe_coherence_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins update coherence_rules"
  ON ademe_coherence_rules FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins delete coherence_rules"
  ON ademe_coherence_rules FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
