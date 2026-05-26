-- ============================================
-- Annexes d'export (Aides Rénovation, COFRAC, RGE…)
-- ============================================
-- Trace pour chaque export DPE F/G la simulation France Rénov' utilisée
-- et le PDF généré. Permet aux diagnostiqueurs de réimprimer une annexe
-- ou de la renvoyer au client par email sans rejouer la simulation.
-- ============================================

CREATE TABLE IF NOT EXISTS dossier_export_annexes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id      uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  annexe_type     text NOT NULL CHECK (annexe_type IN ('aides_renovation', 'cofrac', 'rge')),
  storage_path    text NOT NULL,
  payload         jsonb NOT NULL, -- snapshot des aides retournées pour audit
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_export_annexes_dossier
  ON dossier_export_annexes (dossier_id, annexe_type);

CREATE INDEX IF NOT EXISTS idx_dossier_export_annexes_org
  ON dossier_export_annexes (organization_id, annexe_type, generated_at DESC);

ALTER TABLE dossier_export_annexes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annexes_org_read ON dossier_export_annexes;
CREATE POLICY annexes_org_read ON dossier_export_annexes
  FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS annexes_org_write ON dossier_export_annexes;
CREATE POLICY annexes_org_write ON dossier_export_annexes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- Bucket Storage `mission-annexes` (privé)
-- ============================================
-- Path convention : <org_id>/<dossier_id>/<filename>.pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-annexes',
  'mission-annexes',
  false,
  10485760, -- 10 MB max par annexe
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS : lecture pour les membres de l'org propriétaire (1er segment du path),
-- INSERT/UPDATE/DELETE réservés au service_role (génération côté API server).

DROP POLICY IF EXISTS "mission-annexes: org members read" ON storage.objects;
CREATE POLICY "mission-annexes: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'mission-annexes'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
