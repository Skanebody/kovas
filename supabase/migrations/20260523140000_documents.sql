-- ============================================
-- KOVAS — Document Intelligence (V1.5)
-- Cf. CLAUDE.md §3 feature 6 + roadmap Document Intelligence.
--
-- Tables :
--   - documents          : entrée brute (capture, file upload, drag/drop, email)
--   - document_extractions : résultat extraction IA structurée
--   - document_corrections : corrections utilisateur (apprentissage)
--   - ai_usage_log         : log usage IA par document
--   - user_scan_quotas     : compteurs quota scans / dépassements
--
-- Storage : bucket `documents` (privé, RLS via path <userId>/...)
-- ============================================

-- ============================================
-- 1. documents (entrée brute)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id                  uuid REFERENCES dossiers(id) ON DELETE SET NULL,
  client_id                   uuid REFERENCES clients(id) ON DELETE SET NULL,
  raw_file_path               text NOT NULL,
  thumbnail_path              text,
  file_size_bytes             bigint,
  mime_type                   text,
  original_filename           text,
  source                      text NOT NULL CHECK (source IN (
    'camera', 'file_upload', 'drag_drop', 'email_import', 'drive_import'
  )),
  document_type               text,
  status                      text NOT NULL DEFAULT 'captured' CHECK (status IN (
    'captured', 'classifying', 'classified', 'extracting',
    'extracted', 'prefilled', 'error'
  )),
  classification_confidence   numeric(5, 2),
  ocr_text                    text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user
  ON documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_dossier
  ON documents(dossier_id) WHERE dossier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type
  ON documents(document_type) WHERE document_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_ocr_text
  ON documents USING gin(to_tsvector('french', ocr_text));

-- ============================================
-- 2. document_extractions (résultat IA)
-- ============================================
CREATE TABLE IF NOT EXISTS document_extractions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id             uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extraction_data         jsonb NOT NULL,
  confidence_by_field     jsonb,
  regulatory_validation   jsonb,
  prefill_summary         jsonb,
  ai_model                text,
  ai_input_tokens         int,
  ai_output_tokens        int,
  ai_cost_eur             numeric(10, 6),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extractions_document
  ON document_extractions(document_id);

-- ============================================
-- 3. document_corrections (apprentissage utilisateur)
-- ============================================
CREATE TABLE IF NOT EXISTS document_corrections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id),
  field_path          text NOT NULL,
  ai_value            text,
  ai_confidence       int,
  user_value          text,
  correction_reason   text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 4. ai_usage_log (log par document, complète ai_usage existant)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id     uuid REFERENCES documents(id),
  operation       text NOT NULL,
  ai_model        text NOT NULL,
  input_tokens    int,
  output_tokens   int,
  cost_eur        numeric(10, 6),
  duration_ms     int,
  success         boolean NOT NULL DEFAULT true,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date
  ON ai_usage_log(user_id, created_at DESC);

-- ============================================
-- 5. user_scan_quotas (quotas mensuels)
-- ============================================
CREATE TABLE IF NOT EXISTS user_scan_quotas (
  user_id                     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_period_start        date NOT NULL DEFAULT current_date,
  scans_used_this_period      int NOT NULL DEFAULT 0,
  scans_included              int NOT NULL,
  overage_scans               int NOT NULL DEFAULT 0,
  overage_cost_eur            numeric(10, 2) NOT NULL DEFAULT 0,
  overage_price_per_scan      numeric(6, 4),
  plan_id                     text,
  last_reset_at               timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 6. Storage bucket `documents`
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB max (PDF DPE/audit peuvent être lourds)
  ARRAY[
    'image/webp', 'image/jpeg', 'image/png', 'image/heic',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies storage.objects pour bucket `documents`
-- Path convention : <userId>/<uuid>.<ext> ou <userId>/thumbs/<uuid>.jpg
DROP POLICY IF EXISTS "documents: owner read" ON storage.objects;
CREATE POLICY "documents: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (string_to_array(name, '/'))[1]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS "documents: owner upload" ON storage.objects;
CREATE POLICY "documents: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND (string_to_array(name, '/'))[1]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS "documents: owner delete" ON storage.objects;
CREATE POLICY "documents: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND (string_to_array(name, '/'))[1]::uuid = auth.uid()
  );

-- ============================================
-- 7. RLS
-- ============================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scan_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_self" ON documents;
CREATE POLICY "documents_self" ON documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "extractions_via_doc" ON document_extractions;
CREATE POLICY "extractions_via_doc" ON document_extractions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_extractions.document_id
        AND documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "corrections_self" ON document_corrections;
CREATE POLICY "corrections_self" ON document_corrections
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_usage_self" ON ai_usage_log;
CREATE POLICY "ai_usage_self" ON ai_usage_log
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "scan_quotas_self" ON user_scan_quotas;
CREATE POLICY "scan_quotas_self" ON user_scan_quotas
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- 8. Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.documents_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_set_updated_at();
