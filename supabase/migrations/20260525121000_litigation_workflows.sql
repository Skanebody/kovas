-- ============================================
-- KOVAS — Module 3 (Bouclier de défense) — litigation_workflows
--
-- Workflow de gestion d'un litige attaché à un dossier de défense :
-- étapes (réclamation reçue → médiation → mise en demeure → action),
-- échéances, parties prenantes, pièces justificatives, journal.
-- ============================================

CREATE TABLE IF NOT EXISTS litigation_workflows (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  defense_dossier_id    uuid REFERENCES defense_dossiers(id) ON DELETE SET NULL,
  mission_id            uuid REFERENCES missions(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- diag suivant le dossier

  reference             text,                            -- ex: LIT-2026-00007 (per-org seq applicatif)

  -- Type de litige
  litigation_kind       text NOT NULL                    -- claim_client | mediation | rcp_insurer | judicial | other
                          CHECK (litigation_kind IN ('claim_client','mediation','rcp_insurer','judicial','administrative','other')),
  severity              text NOT NULL DEFAULT 'medium'
                          CHECK (severity IN ('low','medium','high','critical')),

  -- État
  status                text NOT NULL DEFAULT 'opened'
                          CHECK (status IN ('opened','in_progress','awaiting_third_party','escalated','resolved','closed','dropped')),
  current_step          text,                            -- libellé de l'étape courante
  next_action           text,                            -- prochaine action métier attendue
  next_action_due_at    timestamptz,

  -- Parties prenantes (snapshot — pas de FK car contacts/avocats hors KOVAS)
  parties               jsonb NOT NULL DEFAULT '[]'::jsonb,
                                                         -- [{ "role": "claimant" | "insurer" | "lawyer" | "mediator",
                                                         --    "name": "...", "email": "...", "phone": "..." }]

  -- Pièces & timeline
  documents             jsonb NOT NULL DEFAULT '[]'::jsonb,
                                                         -- [{ "kind": "letter" | "expertise" | "court_doc",
                                                         --    "storage_path": "...", "uploaded_at": "..." }]
  timeline              jsonb NOT NULL DEFAULT '[]'::jsonb,
                                                         -- [{ "at": "...", "by": "user_id", "event": "...",
                                                         --    "details": {...} }]

  -- Financier (centimes integer, convention KOVAS)
  claim_amount_cents    bigint,                          -- montant réclamé
  settlement_cents      bigint,                          -- montant transactionnel final
  currency              text NOT NULL DEFAULT 'EUR',

  -- Cycle
  opened_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  resolution_outcome    text,                            -- ex: 'in_favor' | 'against' | 'compromise' | 'dropped'

  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_litigation_org
  ON litigation_workflows (organization_id);
CREATE INDEX IF NOT EXISTS idx_litigation_dossier
  ON litigation_workflows (defense_dossier_id) WHERE defense_dossier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_litigation_mission
  ON litigation_workflows (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_litigation_user
  ON litigation_workflows (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_litigation_status
  ON litigation_workflows (organization_id, status, next_action_due_at);
CREATE INDEX IF NOT EXISTS idx_litigation_due
  ON litigation_workflows (next_action_due_at)
  WHERE next_action_due_at IS NOT NULL AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_litigation_reference
  ON litigation_workflows (reference) WHERE reference IS NOT NULL;

COMMENT ON TABLE litigation_workflows IS
  'Workflow d''un litige attaché à un dossier de défense : étapes, échéances, parties prenantes, pièces, timeline. Suivi opérationnel des contentieux KOVAS.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE litigation_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read litigation_workflows"
  ON litigation_workflows FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert litigation_workflows"
  ON litigation_workflows FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update litigation_workflows"
  ON litigation_workflows FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete litigation_workflows"
  ON litigation_workflows FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
