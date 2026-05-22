-- ============================================
-- KOVAS — Audit trail RGPD : accès aux données personnelles
-- ============================================
-- Trace tout accès (lecture, export, suppression) à des données
-- personnelles couvertes par le RGPD (clients, dossiers, photos).
--
-- Cf. apps/web/src/lib/compliance/rgpd-checker.ts > logDataAccess()
-- Cf. docs/SECURITY.md > "Politique RGPD résumée"
--
-- RLS : admin-only (owner OU admin de l'organisation). Aucun user
-- standard ne peut lire ses propres logs (sinon falsification possible).

CREATE TABLE audit_data_access (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  data_type       text NOT NULL,
  action          text NOT NULL CHECK (action IN ('read','export','delete')),
  ip              text,
  user_agent      text,
  accessed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_data_access_user ON audit_data_access (user_id, accessed_at DESC);
CREATE INDEX idx_audit_data_access_org ON audit_data_access (organization_id, accessed_at DESC);
CREATE INDEX idx_audit_data_access_action ON audit_data_access (action, accessed_at DESC);

COMMENT ON TABLE audit_data_access IS
  'Audit trail RGPD — toute lecture/export/suppression de données personnelles.';
COMMENT ON COLUMN audit_data_access.data_type IS
  'Catégorie de données — ex « client.email », « dossier.address », « photo.geo ».';
COMMENT ON COLUMN audit_data_access.action IS
  'read | export | delete — trois actions tracées au sens RGPD.';

-- ─── RLS : admin-only ─────────────────────────────────────────
ALTER TABLE audit_data_access ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux owner/admin de l'organisation concernée.
CREATE POLICY "admin reads org audit" ON audit_data_access
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = audit_data_access.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner','admin')
        AND m.status = 'active'
    )
  );

-- Insertion autorisée pour tout user authentifié (sur ses propres accès uniquement).
-- L'insertion se fait depuis les server actions via rgpd-checker.logDataAccess().
CREATE POLICY "user inserts own audit" ON audit_data_access
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Pas de UPDATE ni DELETE : audit immutable par design.

-- ============================================
-- Politique de confidentialité — preuve d'acceptation (RGPD art. 7)
-- ============================================
-- Stocke la date d'acceptation de la politique de confidentialité par
-- l'utilisateur. Revalidée tous les 12 mois côté app via
-- assertPrivacyPolicyCurrent() (cf. rgpd-checker.ts).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz;

COMMENT ON COLUMN profiles.privacy_policy_accepted_at IS
  'Date d''acceptation de la politique de confidentialité (RGPD art. 7). '
  'Revalidée tous les 12 mois par l''app.';

