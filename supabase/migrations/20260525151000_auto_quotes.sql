-- ============================================
-- KOVAS App — Module 5 : Devis automatiques (auto_quotes)
-- Date : 2026-05-25
-- Objectif : générer un devis pré-rempli à partir d'un déclencheur
--            (lead web, demande prescripteur, relance), avec workflow
--            de validation et lien vers le quote final si converti.
-- ============================================

CREATE TABLE auto_quotes (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id         uuid REFERENCES contacts(id) ON DELETE SET NULL,
  quote_id           uuid REFERENCES quotes(id) ON DELETE SET NULL,
  trigger_source     text NOT NULL CHECK (trigger_source IN (
                       'lead_web', 'prescriber_request', 'follow_up',
                       'manual', 'inbound_call', 'inbound_email'
                     )),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN (
                       'pending', 'generated', 'sent', 'accepted',
                       'rejected', 'expired', 'cancelled'
                     )),
  generated_amount_ht  numeric(10,2),
  generated_amount_ttc numeric(10,2),
  property_snapshot  jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostics_requested text[] NOT NULL DEFAULT '{}',
  ai_confidence      numeric(4,3),
  generated_at       timestamptz,
  sent_at            timestamptz,
  decided_at         timestamptz,
  decision_notes     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auto_quotes IS
  'Pipeline de devis automatiques : capture d''un lead, génération IA d''un devis pré-rempli, suivi jusqu''à conversion en quote final.';

CREATE INDEX idx_auto_quotes_org_status ON auto_quotes (organization_id, status);
CREATE INDEX idx_auto_quotes_contact ON auto_quotes (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_auto_quotes_quote ON auto_quotes (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX idx_auto_quotes_user ON auto_quotes (user_id);
CREATE INDEX idx_auto_quotes_trigger ON auto_quotes (organization_id, trigger_source);

-- Trigger updated_at
CREATE TRIGGER trg_auto_quotes_updated
  BEFORE UPDATE ON auto_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE auto_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_quotes_select ON auto_quotes
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY auto_quotes_insert ON auto_quotes
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY auto_quotes_update ON auto_quotes
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY auto_quotes_delete ON auto_quotes
  FOR DELETE USING (public.is_member_of(organization_id));
