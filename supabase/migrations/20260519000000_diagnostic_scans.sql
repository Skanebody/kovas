-- ============================================
-- KOVAS — Scans de diagnostics existants (vérification validité)
-- Cf. CLAUDE.md §3 — feature complémentaire MVP V1 :
-- le diagnostiqueur scanne d'anciens diagnostics (DPE, amiante, plomb…),
-- l'IA détecte type/date/adresse/numéro ADEME, et la fiche est rangée
-- dans le bon client/bien.
-- ============================================

-- ============================================
-- 1. Storage bucket "diagnostic-scans"
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'diagnostic-scans',
  'diagnostic-scans',
  false,
  20971520, -- 20 MB max
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage : lecture pour les membres de l'org (path = <org_id>/...)
-- INSERT/DELETE passent par l'API serveur (service_role).
DROP POLICY IF EXISTS "diagnostic-scans: org members read" ON storage.objects;
CREATE POLICY "diagnostic-scans: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'diagnostic-scans'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- ============================================
-- 2. Table diagnostic_scans
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostic_scans (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES clients(id) ON DELETE SET NULL,
  property_id         uuid REFERENCES properties(id) ON DELETE SET NULL,
  file_storage_path   text NOT NULL,
  original_name       text,
  size_bytes          bigint,
  mime_type           text,
  -- Champs métier extraits (IA + édition manuelle)
  diagnostic_type     text,
  date_emission       date,
  date_expiration     date,
  usage_context       text,    -- 'vente' | 'location' | 'unknown'
  result_positive     boolean, -- pour amiante / plomb
  adresse             text,
  proprietaire        text,
  ademe_number        text,
  energy_class        text,
  -- Brut IA + meta
  extracted_data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_confidence       numeric,
  ai_cost_eur         numeric,
  ai_latency_ms       integer,
  -- Workflow
  status              text NOT NULL DEFAULT 'pending',
  confirmed_at        timestamptz,
  rejected_at         timestamptz,
  -- Audit
  uploaded_by         uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT diagnostic_scans_type_chk CHECK (
    diagnostic_type IS NULL OR diagnostic_type IN
      ('dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp')
  ),
  CONSTRAINT diagnostic_scans_status_chk CHECK (
    status IN ('pending', 'analyzing', 'analyzed', 'confirmed', 'rejected', 'failed')
  ),
  CONSTRAINT diagnostic_scans_energy_chk CHECK (
    energy_class IS NULL OR energy_class IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')
  ),
  CONSTRAINT diagnostic_scans_usage_chk CHECK (
    usage_context IS NULL OR usage_context IN ('vente', 'location', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_scans_org
  ON diagnostic_scans (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_scans_client
  ON diagnostic_scans (client_id) WHERE deleted_at IS NULL AND client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_scans_property
  ON diagnostic_scans (property_id) WHERE deleted_at IS NULL AND property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_diagnostic_scans_expiration
  ON diagnostic_scans (date_expiration) WHERE deleted_at IS NULL AND date_expiration IS NOT NULL;

-- ============================================
-- 3. RLS
-- ============================================
ALTER TABLE diagnostic_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diagnostic_scans: org members read" ON diagnostic_scans;
CREATE POLICY "diagnostic_scans: org members read"
  ON diagnostic_scans FOR SELECT
  USING (public.is_member_of(organization_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "diagnostic_scans: org members create" ON diagnostic_scans;
CREATE POLICY "diagnostic_scans: org members create"
  ON diagnostic_scans FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "diagnostic_scans: org members update" ON diagnostic_scans;
CREATE POLICY "diagnostic_scans: org members update"
  ON diagnostic_scans FOR UPDATE
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "diagnostic_scans: org members delete" ON diagnostic_scans;
CREATE POLICY "diagnostic_scans: org members delete"
  ON diagnostic_scans FOR DELETE
  USING (public.is_member_of(organization_id));

-- ============================================
-- 4. Trigger updated_at
-- ============================================
DROP TRIGGER IF EXISTS diagnostic_scans_set_updated_at ON diagnostic_scans;
CREATE TRIGGER diagnostic_scans_set_updated_at
  BEFORE UPDATE ON diagnostic_scans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 5. Realtime
-- ============================================
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.diagnostic_scans';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
