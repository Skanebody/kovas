-- ============================================
-- KOVAS — Refonte claim flow Doctolib pattern (2026-05-27)
--
-- Mission : remplacer les 4 méthodes parallèles ("1 seule suffit") par 3
-- étapes obligatoires séquentielles (SIRET + SMS OTP + KYC pièce d'identité
-- + review humaine 24-48h) à la Doctolib.
--
-- Ajoute à `claim_requests` :
--   - phone_verified_at      — étape 2 OK
--   - identity_uploaded_at   — étape 3 upload terminé
--   - identity_doc_path      — bucket claim-identity-documents
--   - identity_kyc_score     — score Vision IA 0..100
--   - identity_kyc_reasons   — jsonb { reasons: [...], recommendation, ... }
--   - kyc_reviewed_at        — décision admin
--   - kyc_decision           — 'approved' | 'rejected'
--   - kyc_review_notes       — texte libre admin
--   - kyc_reviewer_user_id   — auth.users(id) qui a tranché
--   - flow_version           — 'v1_parallel' (legacy 4 méthodes) | 'v2_doctolib' (nouveau)
--   - siret_verified_at      — étape 1 OK (snapshot, distinct de verified_at)
--
-- Étend le check `status` pour la nouvelle state machine :
--   pending → siret_verified → phone_verified → identity_uploaded
--   → review_pending → approved (=verified historique) | rejected
--
-- Crée le bucket Storage privé `claim-identity-documents` (RLS strict,
-- service_role only, lecture admin via signed URLs server-side).
--
-- Idempotent : safe à re-jouer (IF NOT EXISTS, DROP/CREATE POLICY).
-- ============================================

-- ============================================
-- 1. Étendre claim_requests
-- ============================================
ALTER TABLE claim_requests
  ADD COLUMN IF NOT EXISTS phone_verified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS identity_uploaded_at   timestamptz,
  ADD COLUMN IF NOT EXISTS identity_doc_path      text,
  ADD COLUMN IF NOT EXISTS identity_kyc_score     integer,
  ADD COLUMN IF NOT EXISTS identity_kyc_reasons   jsonb,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_decision           text,
  ADD COLUMN IF NOT EXISTS kyc_review_notes       text,
  ADD COLUMN IF NOT EXISTS kyc_reviewer_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS siret_verified_at      timestamptz,
  ADD COLUMN IF NOT EXISTS flow_version           text NOT NULL DEFAULT 'v1_parallel';

-- Contraintes sur les nouvelles colonnes (idempotent — on drop puis recrée)
DO $$
BEGIN
  -- score 0..100
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'claim_requests_identity_kyc_score_range'
  ) THEN
    ALTER TABLE claim_requests
      ADD CONSTRAINT claim_requests_identity_kyc_score_range
      CHECK (identity_kyc_score IS NULL OR (identity_kyc_score >= 0 AND identity_kyc_score <= 100));
  END IF;

  -- kyc_decision enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'claim_requests_kyc_decision_enum'
  ) THEN
    ALTER TABLE claim_requests
      ADD CONSTRAINT claim_requests_kyc_decision_enum
      CHECK (kyc_decision IS NULL OR kyc_decision IN ('approved', 'rejected'));
  END IF;

  -- flow_version enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'claim_requests_flow_version_enum'
  ) THEN
    ALTER TABLE claim_requests
      ADD CONSTRAINT claim_requests_flow_version_enum
      CHECK (flow_version IN ('v1_parallel', 'v2_doctolib'));
  END IF;
END $$;

-- ============================================
-- 2. Étendre le check status pour la nouvelle state machine
-- ============================================
-- On drop l'ancien check puis on en pose un plus large.
-- Ancien : status IN ('pending', 'code_sent', 'verified', 'rejected', 'expired')
-- Nouveau : ajout de siret_verified / phone_verified / identity_uploaded /
-- review_pending / approved. 'verified' reste accepté pour compat back V1.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'claim_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%pending%code_sent%verified%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE claim_requests DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE claim_requests
  ADD CONSTRAINT claim_requests_status_enum_v2
  CHECK (status IN (
    'pending',
    'code_sent',
    'siret_verified',
    'phone_verified',
    'identity_uploaded',
    'review_pending',
    'verified',           -- compat V1 (= approved côté UI v2)
    'approved',
    'rejected',
    'expired'
  ));

-- ============================================
-- 3. Index pour la file d'attente admin et lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_claim_review_queue
  ON claim_requests (status, created_at DESC)
  WHERE status IN ('review_pending', 'identity_uploaded');

CREATE INDEX IF NOT EXISTS idx_claim_diag_status
  ON claim_requests (diagnostician_id, status);

CREATE INDEX IF NOT EXISTS idx_claim_flow_version
  ON claim_requests (flow_version, created_at DESC);

COMMENT ON COLUMN claim_requests.phone_verified_at IS
  'Étape 2 — OTP SMS validé. Doctolib pattern v2.';
COMMENT ON COLUMN claim_requests.siret_verified_at IS
  'Étape 1 — SIRET vérifié (matched). Doctolib pattern v2 (séparé de verified_at).';
COMMENT ON COLUMN claim_requests.identity_uploaded_at IS
  'Étape 3 — Pièce d''identité uploadée vers bucket claim-identity-documents.';
COMMENT ON COLUMN claim_requests.identity_doc_path IS
  'Path Supabase Storage bucket claim-identity-documents/{diag_id}/{claim_id}/{front|back}.jpg';
COMMENT ON COLUMN claim_requests.identity_kyc_score IS
  'Score Claude Vision 0-100. Seuil 70 = auto-OK ; <70 = priorité review humaine.';
COMMENT ON COLUMN claim_requests.identity_kyc_reasons IS
  'Raisons Vision IA structurées : { is_id_document, doc_type, expiry_ok, name_match, no_falsification_signs, recommendation, reasons:[] }';
COMMENT ON COLUMN claim_requests.flow_version IS
  'v1_parallel = ancien flow (Email/SIRET/SMS/Manuel parallèles). v2_doctolib = nouveau flow 3 étapes obligatoires séquentielles.';

-- ============================================
-- 4. Bucket Storage claim-identity-documents (privé, service_role only)
-- ============================================
-- Bucket séparé du bucket V1 `claim-id-uploads` : isolation forte pour le
-- pattern KYC strict (RLS, lifecycle, archivage spécifique).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-identity-documents',
  'claim-identity-documents',
  false,
  10485760, -- 10 MB max par fichier (CNI recto + verso ≤ 5 Mo chacun)
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Aucune RLS policy publique (anon/authenticated). Tous les accès passent
-- par les routes API server-side avec SERVICE_ROLE_KEY (signed URLs admin).
-- On drop d'éventuelles policies legacy par sécurité.
DROP POLICY IF EXISTS "claim-identity-documents: anon select" ON storage.objects;
DROP POLICY IF EXISTS "claim-identity-documents: anon insert" ON storage.objects;
DROP POLICY IF EXISTS "claim-identity-documents: authenticated select" ON storage.objects;

-- ============================================
-- 5. View admin claim_kyc_queue (modération KYC)
--    Lecture seule via service_role (frontend admin lit cette vue).
-- ============================================
CREATE OR REPLACE VIEW claim_kyc_queue
WITH (security_invoker = on) AS
SELECT
  c.id                              AS claim_id,
  c.diagnostician_id,
  d.full_name                       AS diagnostician_name,
  d.city                            AS diagnostician_city,
  d.postcode                        AS diagnostician_postcode,
  d.email                           AS diagnostician_email,
  c.method,
  c.status,
  c.flow_version,
  c.siret_verified_at,
  c.phone_verified_at,
  c.identity_uploaded_at,
  c.identity_doc_path,
  c.identity_kyc_score,
  c.identity_kyc_reasons,
  c.kyc_reviewed_at,
  c.kyc_decision,
  c.kyc_review_notes,
  c.kyc_reviewer_user_id,
  c.contact_email,
  c.contact_phone,
  c.contact_siret,
  c.ip_address,
  c.created_at
FROM claim_requests c
LEFT JOIN diagnosticians d ON d.id = c.diagnostician_id
WHERE c.flow_version = 'v2_doctolib'
  AND c.status IN ('identity_uploaded', 'review_pending', 'approved', 'rejected');

COMMENT ON VIEW claim_kyc_queue IS
  'File de modération KYC claim Doctolib. Lecture admin via service_role uniquement (security_invoker=on respecte RLS de claim_requests).';

-- ============================================
-- 6. Helper trigger : transition status automatique
-- ============================================
-- Quand on update kyc_decision='approved' avec kyc_reviewed_at set,
-- on bascule status='approved' + on copie sur diagnosticians.claim_status
-- (cf. linkClaimToUser pour le signup). On laisse l'app gérer l'étape
-- signup en main (pas de side-effect ici).
CREATE OR REPLACE FUNCTION public.claim_kyc_apply_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Auto-transition status si décision posée
  IF NEW.kyc_decision = 'approved' AND NEW.kyc_reviewed_at IS NOT NULL
     AND (OLD.kyc_decision IS DISTINCT FROM 'approved' OR OLD.kyc_reviewed_at IS DISTINCT FROM NEW.kyc_reviewed_at) THEN
    NEW.status := 'approved';
    NEW.verified_at := COALESCE(NEW.verified_at, NEW.kyc_reviewed_at);
  ELSIF NEW.kyc_decision = 'rejected' AND NEW.kyc_reviewed_at IS NOT NULL
     AND (OLD.kyc_decision IS DISTINCT FROM 'rejected' OR OLD.kyc_reviewed_at IS DISTINCT FROM NEW.kyc_reviewed_at) THEN
    NEW.status := 'rejected';
    NEW.rejected_reason := COALESCE(NEW.rejected_reason, 'kyc_rejected_by_admin');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_claim_kyc_apply_decision ON claim_requests;
CREATE TRIGGER trg_claim_kyc_apply_decision
  BEFORE UPDATE OF kyc_decision, kyc_reviewed_at ON claim_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_kyc_apply_decision();

COMMENT ON FUNCTION public.claim_kyc_apply_decision IS
  'Trigger BEFORE UPDATE : applique la décision admin (approved/rejected) sur le status + verified_at + rejected_reason. Idempotent (no-op si déjà appliqué).';
