-- ============================================
-- KOVAS — Workflow réclamation fiche diagnostiqueur (Mission A4)
-- Cf. CLAUDE.md §20 — annuaire public + claim multi-méthodes
--
-- Note : cette migration référence `diagnosticians` créée par A1.
-- Si A1 n'a pas encore été appliquée, le FK échoue à l'application — c'est
-- volontaire (ordre de migrations chronologique garanti par le timestamp).
-- ============================================

-- ============================================
-- 1. Table claim_requests
-- ============================================
CREATE TABLE IF NOT EXISTS claim_requests (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id             uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  method                       text NOT NULL
    CHECK (method IN ('email_official', 'sms_official', 'siret_match', 'manual_id_upload')),
  status                       text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'code_sent', 'verified', 'rejected', 'expired')),
  -- Code de vérification (email/SMS uniquement)
  verification_code            text,                       -- 6 chiffres, null pour siret/manual
  verification_code_expires_at timestamptz,
  verification_attempts        int NOT NULL DEFAULT 0,
  -- Contact utilisé (snapshot au moment du claim, avant masking RGPD)
  contact_email                text,
  contact_phone                text,
  contact_siret                text,
  -- Manuel : justificatifs uploadés
  id_upload_path               text,                       -- Supabase Storage path
  cert_upload_path             text,                       -- attestation certification
  -- Audit + anti-abus
  ip_address                   inet,
  user_agent                   text,
  user_id_created              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at                  timestamptz,
  rejected_reason              text,
  created_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_diag
  ON claim_requests (diagnostician_id, status, created_at DESC);

-- Index partiel pour lookup rapide d'un code actif (status='code_sent')
CREATE INDEX IF NOT EXISTS idx_claim_code
  ON claim_requests (verification_code)
  WHERE status = 'code_sent';

-- Index audit rate-limit (par IP + diag, 1h fenêtre glissante)
CREATE INDEX IF NOT EXISTS idx_claim_rate_limit
  ON claim_requests (ip_address, created_at DESC);

COMMENT ON TABLE claim_requests IS
  'Demandes de réclamation de fiche diagnostiqueur — 4 méthodes (email/SMS/SIRET/manuel)';
COMMENT ON COLUMN claim_requests.verification_code IS
  'Code 6 chiffres pour email_official/sms_official, null sinon';
COMMENT ON COLUMN claim_requests.id_upload_path IS
  'Chemin Supabase Storage bucket claim-id-uploads pour la CNI/justificatif (manuel uniquement)';
COMMENT ON COLUMN claim_requests.cert_upload_path IS
  'Chemin Supabase Storage pour attestation de certification (manuel uniquement)';

-- ============================================
-- 2. RLS — service-role only (toutes routes passent par admin client)
-- ============================================
ALTER TABLE claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim_requests: service role only" ON claim_requests;
CREATE POLICY "claim_requests: service role only"
  ON claim_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Aucune policy anon/authenticated : les routes API utilisent
-- SUPABASE_SERVICE_ROLE_KEY pour bypass RLS de manière contrôlée.

-- ============================================
-- 3. Bucket Storage claim-id-uploads (privé, service-role only)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-id-uploads',
  'claim-id-uploads',
  false,
  10485760, -- 10 MB max (CNI + attestation = 2 fichiers)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Aucune RLS policy publique : tout passe par routes API server-side
-- avec service_role. Les utilisateurs anonymes ne peuvent ni lister,
-- ni lire, ni écrire dans ce bucket.
DROP POLICY IF EXISTS "claim-id-uploads: service role only" ON storage.objects;
-- (volontairement aucune policy SELECT/INSERT/DELETE pour role anon/authenticated)

-- ============================================
-- 4. Helper : nettoyage codes expirés (job cron à brancher M9+)
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_old_claim_codes()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE claim_requests
     SET status = 'expired'
   WHERE status = 'code_sent'
     AND verification_code_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.expire_old_claim_codes IS
  'Marque les codes verification_code expirés (status=code_sent → expired). À brancher sur pg_cron toutes les 15min M9+.';
