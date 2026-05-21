-- ============================================
-- KOVAS App — Module 8 : Auto-updates système suite à évolution réglementaire
-- Date : 2026-05-25
-- Ex : un nouvel arrêté change un seuil DPE → patch préconisé + approuvé par admin.
-- ============================================

CREATE TABLE system_auto_updates (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Origine.
  triggered_by_doc_id   uuid REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  detected_by           text NOT NULL DEFAULT 'ai_worker'
    CHECK (detected_by IN ('ai_worker','admin_manual','user_report')),
  -- Description.
  title                 text NOT NULL,
  summary               text NOT NULL,
  rationale             text NOT NULL,
  affected_areas        text[] DEFAULT '{}',     -- ['dpe_calc','report_template','export_zip',...]
  -- Plan d'action.
  change_type           text NOT NULL
    CHECK (change_type IN ('config','seed_data','code_patch','content_update','manual_task')),
  proposed_payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_payload      jsonb DEFAULT '{}'::jsonb,
  -- Gouvernance : approbation admin OBLIGATOIRE avant exécution.
  status                text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','applied','rolled_back','failed')),
  reviewed_by           uuid REFERENCES auth.users(id),
  reviewed_at           timestamptz,
  review_notes          text,
  -- Exécution.
  applied_by            uuid REFERENCES auth.users(id),
  applied_at            timestamptz,
  apply_result          jsonb,
  apply_error           text,
  -- Risque estimé (aide la priorisation).
  risk_level            text NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low','medium','high','critical')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auto_updates_status ON system_auto_updates (status, created_at DESC);
CREATE INDEX idx_auto_updates_doc ON system_auto_updates (triggered_by_doc_id);
CREATE INDEX idx_auto_updates_risk ON system_auto_updates (risk_level, created_at DESC)
  WHERE status = 'pending_review';

COMMENT ON TABLE system_auto_updates IS
  'Propositions de mise à jour système (config / seed / contenu) suite à veille IA. Approbation admin OBLIGATOIRE avant application. Aucune exécution automatique.';

CREATE TRIGGER trg_auto_updates_updated BEFORE UPDATE ON system_auto_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS — admin only (lecture ET écriture)
-- ============================================
ALTER TABLE system_auto_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_auto_updates_admin_read"
  ON system_auto_updates FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

CREATE POLICY "system_auto_updates_admin_insert"
  ON system_auto_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "system_auto_updates_admin_update"
  ON system_auto_updates FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "system_auto_updates_admin_delete"
  ON system_auto_updates FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION system_auto_updates
-- ============================================
