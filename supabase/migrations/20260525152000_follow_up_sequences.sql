-- ============================================
-- KOVAS App — Module 5 : Séquences de relance (follow_up_sequences)
-- Date : 2026-05-25
-- Objectif : moteur de relance multi-canal (email/SMS/tâche manuelle)
--            sur entités cibles diverses (devis, factures, missions,
--            contacts prescripteurs), exécuté par job worker.
-- ============================================

CREATE TABLE follow_up_sequences (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Cible polymorphe : pas de FK SQL, contrôle applicatif.
  -- target_entity_type → table à interroger pour target_entity_id :
  --   'quote'     → quotes(id)
  --   'invoice'   → invoices(id)
  --   'mission'   → missions(id)
  --   'auto_quote'→ auto_quotes(id)
  --   'contact'   → contacts(id)
  target_entity_type  text NOT NULL CHECK (target_entity_type IN (
                        'quote', 'invoice', 'mission', 'auto_quote', 'contact'
                      )),
  target_entity_id    uuid NOT NULL,
  sequence_template   text NOT NULL, -- ex: 'quote_no_response_J7_J15_J30'
  current_step        int NOT NULL DEFAULT 0,
  total_steps         int NOT NULL DEFAULT 3,
  channel             text NOT NULL DEFAULT 'email' CHECK (channel IN (
                        'email', 'sms', 'task', 'mixed'
                      )),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN (
                        'active', 'paused', 'completed', 'cancelled', 'failed'
                      )),
  next_action_at      timestamptz,
  last_action_at      timestamptz,
  last_action_result  text,
  context             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE follow_up_sequences IS
  'Moteur de relances automatisées multi-canal. La cible (quote/invoice/mission/auto_quote/contact) est polymorphe — l''intégrité référentielle est assurée applicativement.';
COMMENT ON COLUMN follow_up_sequences.target_entity_type IS
  'Type de l''entité ciblée : quote|invoice|mission|auto_quote|contact. Mapping vers la table SQL homonyme.';
COMMENT ON COLUMN follow_up_sequences.target_entity_id IS
  'ID de l''entité ciblée (FK applicative selon target_entity_type — pas de FK SQL car polymorphe).';

CREATE INDEX idx_follow_up_org_status ON follow_up_sequences (organization_id, status);
CREATE INDEX idx_follow_up_next_action ON follow_up_sequences (next_action_at)
  WHERE status = 'active' AND next_action_at IS NOT NULL;
CREATE INDEX idx_follow_up_target ON follow_up_sequences (target_entity_type, target_entity_id);
CREATE INDEX idx_follow_up_user ON follow_up_sequences (user_id);

-- Trigger updated_at
CREATE TRIGGER trg_follow_up_sequences_updated
  BEFORE UPDATE ON follow_up_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY fus_select ON follow_up_sequences
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY fus_insert ON follow_up_sequences
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY fus_update ON follow_up_sequences
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY fus_delete ON follow_up_sequences
  FOR DELETE USING (public.is_member_of(organization_id));
