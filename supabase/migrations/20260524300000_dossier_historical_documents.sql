-- ============================================
-- KOVAS App — Chantier B : Upload scans documents anciens du bien
-- Date : 2026-05-24
--
-- Authority : CLAUDE.md §22 + FIX-KK §B.
--
-- Objectif :
--   Permettre au diagnostiqueur d'uploader des documents historiques liés
--   au bien (ancien DPE, ancien amiante, plans, factures énergie, actes
--   notariés, photos anciennes, autre) directement depuis le dossier.
--   Une extraction IA Vision (Claude Sonnet 4.6) peut être déclenchée
--   pour les anciens diagnostics, et le résultat est stocké dans
--   `ai_extracted_data` (classe DPE, surface, dates, etc.) pour
--   pré-remplir le nouveau dossier.
--
-- Idempotent : `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
-- `CREATE POLICY` protégé par `DROP POLICY IF EXISTS`.
-- ============================================

-- ============================================
-- 1. Table dossier_historical_documents
-- ============================================
CREATE TABLE IF NOT EXISTS dossier_historical_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id      uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (category IN (
    'previous_dpe',
    'previous_amiante',
    'plans',
    'energy_bills',
    'notary_acts',
    'historical_photos',
    'other'
  )),
  storage_path    text NOT NULL,
  original_filename text,
  file_size_bytes int,
  mime_type       text,
  uploaded_by     uuid REFERENCES auth.users(id),
  ai_extracted_data jsonb,  -- {dpe_class, ges_class, surface, audit_date, document_date, ...}
  ai_extraction_status text DEFAULT 'pending' CHECK (ai_extraction_status IN (
    'pending','running','done','failed','skipped'
  )),
  ai_extraction_cost_eur numeric(10,4),
  notes           text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dhd_dossier
  ON dossier_historical_documents (dossier_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_dhd_org
  ON dossier_historical_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_dhd_category
  ON dossier_historical_documents (dossier_id, category);

COMMENT ON TABLE dossier_historical_documents IS
  'Documents historiques du bien (anciens DPE, plans, factures énergie, actes notariés, photos) uploadés depuis le dossier (FIX-KK §B).';
COMMENT ON COLUMN dossier_historical_documents.ai_extracted_data IS
  'Données extraites par Claude Vision si DPE/amiante : {dpe_class, ges_class, surface, document_date, ...}. NULL si extraction skip ou échouée.';

-- ============================================
-- 2. RLS — accès par organisation (multi-tenant)
-- ============================================
ALTER TABLE dossier_historical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dhd_org_select ON dossier_historical_documents;
DROP POLICY IF EXISTS dhd_org_insert ON dossier_historical_documents;
DROP POLICY IF EXISTS dhd_org_update ON dossier_historical_documents;
DROP POLICY IF EXISTS dhd_org_delete ON dossier_historical_documents;

CREATE POLICY dhd_org_select ON dossier_historical_documents
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY dhd_org_insert ON dossier_historical_documents
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY dhd_org_update ON dossier_historical_documents
  FOR UPDATE USING (public.is_member_of(organization_id))
              WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY dhd_org_delete ON dossier_historical_documents
  FOR DELETE USING (public.is_member_of(organization_id));

-- ============================================
-- 3. Bucket Storage `dossier-documents` (privé, signed URL)
--    Convention path : <organization_id>/<dossier_id>/<uuid>.<ext>
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dossier-documents',
  'dossier-documents',
  false,
  52428800, -- 50 MB max par fichier (FIX-KK : scans PDF haute résolution)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dossier-documents: org read"   ON storage.objects;
DROP POLICY IF EXISTS "dossier-documents: org upload" ON storage.objects;
DROP POLICY IF EXISTS "dossier-documents: org update" ON storage.objects;
DROP POLICY IF EXISTS "dossier-documents: org delete" ON storage.objects;

CREATE POLICY "dossier-documents: org read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dossier-documents'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "dossier-documents: org upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dossier-documents'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "dossier-documents: org update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dossier-documents'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'dossier-documents'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "dossier-documents: org delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dossier-documents'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );
