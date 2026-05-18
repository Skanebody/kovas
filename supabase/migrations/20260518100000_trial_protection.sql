-- ============================================
-- KOVAS — Trial Protection schema
-- Cf. docs/trial-protection.md
-- ============================================

-- 1. Table cabinet_trials : 1 SIRET = 1 essai à vie
CREATE TABLE IF NOT EXISTS cabinet_trials (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  siret               varchar(14) NOT NULL UNIQUE,
  email               varchar(255) NOT NULL,
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  trial_started_at    timestamptz NOT NULL DEFAULT now(),
  trial_ended_at      timestamptz,
  converted_to_paid   boolean NOT NULL DEFAULT false,
  blocked_reason      text, -- 'fraud_detection' | 'siret_naf_invalid' | 'patterns_abuse' | 'manual_block'
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cabinet_trials_email ON cabinet_trials (email);
CREATE INDEX IF NOT EXISTS idx_cabinet_trials_user ON cabinet_trials (user_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_trials_org ON cabinet_trials (organization_id);

-- 2. Table abuse_detection_logs (V1.5 mais schéma prêt dès V1)
CREATE TABLE IF NOT EXISTS abuse_detection_logs (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type         text NOT NULL, -- 'volume_anormal' | 'comportement_bot' | 'multi_comptes_ip' | 'temps_actions_irrealiste'
  severity            int NOT NULL CHECK (severity BETWEEN 1 AND 3),
  details             jsonb,
  ip_address          inet,
  user_agent          text,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  action_taken        text -- 'logged' | 'suspended' | 'banned'
);
CREATE INDEX IF NOT EXISTS idx_abuse_org_severity ON abuse_detection_logs (organization_id, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_user ON abuse_detection_logs (user_id, detected_at DESC);

-- 3. RLS
ALTER TABLE cabinet_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_detection_logs ENABLE ROW LEVEL SECURITY;

-- Aucune lecture cabinet_trials côté client (admin only via service_role)
-- L'app n'a pas besoin de lire cette table en self-service.
CREATE POLICY "cabinet_trials: no client read"
  ON cabinet_trials FOR SELECT
  USING (false);

CREATE POLICY "abuse_detection_logs: no client read"
  ON abuse_detection_logs FOR SELECT
  USING (false);

-- 4. Trigger : marquer le trial converted quand un abonnement Stripe actif est créé
-- (à implémenter dans webhook Stripe — placeholder pour J13)
