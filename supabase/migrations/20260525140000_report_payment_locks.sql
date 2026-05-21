-- ============================================
-- KOVAS App — Module 4 : Blocage paiement avant export rapport
-- Date : 2026-05-25
-- Objectif : verrou par mission pour conditionner la livraison du
--            rapport diagnostic au paiement effectif (ou override admin)
-- ============================================

-- ============================================
-- 1. ENUM provider de paiement
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_kind') THEN
    CREATE TYPE payment_provider_kind AS ENUM (
      'stripe',
      'gocardless',
      'virement',
      'cb',
      'especes'
    );
  END IF;
END $$;

-- ============================================
-- 2. Table report_payment_locks
-- ============================================
CREATE TABLE report_payment_locks (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id             uuid NOT NULL UNIQUE REFERENCES missions(id) ON DELETE CASCADE,
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                uuid REFERENCES profiles(id) ON DELETE SET NULL,
  locked                 boolean NOT NULL DEFAULT true,
  amount_due             numeric(10,2),
  payment_link           text,
  payment_provider       payment_provider_kind,
  payment_request_sent_at timestamptz,
  payment_received_at    timestamptz,
  payment_intent_id      text,
  override_by_user       boolean NOT NULL DEFAULT false,
  override_reason        text,
  override_at            timestamptz,
  override_by_user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE report_payment_locks IS
  'Verrou de livraison rapport : bloque le téléchargement/envoi du PDF final tant que paiement non reçu ou override admin justifié.';

CREATE INDEX idx_report_payment_locks_org ON report_payment_locks (organization_id);
CREATE INDEX idx_report_payment_locks_locked ON report_payment_locks (organization_id, locked)
  WHERE locked = true;
CREATE INDEX idx_report_payment_locks_user ON report_payment_locks (user_id);
CREATE INDEX idx_report_payment_locks_intent ON report_payment_locks (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- ============================================
-- 3. Trigger updated_at
-- ============================================
CREATE TRIGGER trg_report_payment_locks_updated
  BEFORE UPDATE ON report_payment_locks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. RLS
-- ============================================
ALTER TABLE report_payment_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY rpl_select ON report_payment_locks
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY rpl_insert ON report_payment_locks
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY rpl_update ON report_payment_locks
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY rpl_delete ON report_payment_locks
  FOR DELETE USING (public.is_member_of(organization_id));
