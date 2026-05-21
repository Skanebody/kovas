-- ============================================
-- KOVAS App — Module 8 : Notifications de veille réglementaire
-- Date : 2026-05-25
-- Une notification = un document réglementaire poussé vers un user d'une org.
-- ============================================

CREATE TABLE regulatory_notifications (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id       uuid NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
  -- Personnalisation : pourquoi cette notif a été générée (ex : "concerne vos missions DPE").
  reason            text,
  matched_topics    text[] DEFAULT '{}',
  matched_kinds     text[] DEFAULT '{}',
  -- Importance dérivée de regulatory_documents.importance + filtres user.
  severity          text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warning','critical')),
  -- Lifecycle.
  delivered_email   boolean NOT NULL DEFAULT false,
  delivered_push    boolean NOT NULL DEFAULT false,
  delivered_in_app  boolean NOT NULL DEFAULT false,
  read_at           timestamptz,
  dismissed_at      timestamptz,
  acted_at          timestamptz,
  -- Anti-doublon : un document n'est notifié qu'une fois par (user, doc).
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);

CREATE INDEX idx_reg_notif_user_unread ON regulatory_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX idx_reg_notif_org ON regulatory_notifications (organization_id, created_at DESC);
CREATE INDEX idx_reg_notif_doc ON regulatory_notifications (document_id);
CREATE INDEX idx_reg_notif_severity ON regulatory_notifications (user_id, severity, created_at DESC)
  WHERE read_at IS NULL;

COMMENT ON TABLE regulatory_notifications IS
  'Notifications poussées aux users : nouveau document réglementaire pertinent. RLS scoping organization_id.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE regulatory_notifications ENABLE ROW LEVEL SECURITY;

-- SELECT : les membres de l'org voient les notifs (utile équipe cabinet Phase 2).
CREATE POLICY "regulatory_notifications_member_read"
  ON regulatory_notifications FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

-- UPDATE : seuls le destinataire et les admins peuvent marquer lu / dismiss.
CREATE POLICY "regulatory_notifications_user_update"
  ON regulatory_notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.is_member_of(organization_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_member_of(organization_id));

-- INSERT : via worker (service_role) ou admin. Pas d'INSERT user.
CREATE POLICY "regulatory_notifications_admin_insert"
  ON regulatory_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION regulatory_notifications
-- ============================================
