-- ============================================
-- KOVAS — Module 3 (Bouclier de défense)
--   1. Storage bucket "defense-dossiers" (PDF dossiers de défense générés)
--   2. Colonnes additionnelles sur `defense_dossiers` :
--      - defense_pdf_url, defense_pdf_generated_at, defense_pdf_sha256
--      - contract_url, cgv_url, certificate_url (documents joints au dossier)
--      - timestamping_anchor (TODO V2 horodatage qualifié Lex Persona / DigiCert)
-- ============================================

-- ────────────────────────────────────────────────────────────
-- 1. Bucket Supabase Storage
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'defense-dossiers',
  'defense-dossiers',
  false,
  52428800, -- 50 MiB max (PDF complet + images embeded)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies sur storage.objects pour le bucket defense-dossiers
-- Convention chemin : <organization_id>/<defense_dossier_id>/<filename>.pdf
DROP POLICY IF EXISTS "defense-dossiers: org members read" ON storage.objects;
CREATE POLICY "defense-dossiers: org members read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'defense-dossiers'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "defense-dossiers: org members upload" ON storage.objects;
CREATE POLICY "defense-dossiers: org members upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'defense-dossiers'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "defense-dossiers: org members update" ON storage.objects;
CREATE POLICY "defense-dossiers: org members update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'defense-dossiers'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

DROP POLICY IF EXISTS "defense-dossiers: org members delete" ON storage.objects;
CREATE POLICY "defense-dossiers: org members delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'defense-dossiers'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- ────────────────────────────────────────────────────────────
-- 2. Colonnes supplémentaires sur defense_dossiers
--    (la table elle-même est créée dans 20260525120000_defense_dossiers.sql)
-- ────────────────────────────────────────────────────────────

ALTER TABLE defense_dossiers
  ADD COLUMN IF NOT EXISTS defense_pdf_url           text,
  ADD COLUMN IF NOT EXISTS defense_pdf_storage_path  text,
  ADD COLUMN IF NOT EXISTS defense_pdf_generated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS defense_pdf_sha256        text,
  ADD COLUMN IF NOT EXISTS defense_pdf_size_bytes    int,
  -- Documents joints (URLs Storage signées ou public-share)
  ADD COLUMN IF NOT EXISTS contract_url              text,
  ADD COLUMN IF NOT EXISTS cgv_url                   text,
  ADD COLUMN IF NOT EXISTS certificate_url           text,
  -- Horodatage qualifié (TODO V2 — Lex Persona / DigiCert avec contrat commercial).
  -- V1 : ancrage opportuniste via OpenTimestamps (RFC 3161, gratuit), stocké en jsonb
  -- (ots_proof, server_calendars, anchored_at).
  ADD COLUMN IF NOT EXISTS timestamping_anchor       jsonb;

COMMENT ON COLUMN defense_dossiers.defense_pdf_url IS
  'URL signée (TTL court) ou storage path du dossier de défense PDF généré.';
COMMENT ON COLUMN defense_dossiers.defense_pdf_sha256 IS
  'SHA-256 hexa du PDF généré. Sert de fingerprint pour OpenTimestamps + preuve d''intégrité.';
COMMENT ON COLUMN defense_dossiers.timestamping_anchor IS
  'Métadonnées d''ancrage OpenTimestamps (V1) ou Lex Persona / DigiCert (V2).';
