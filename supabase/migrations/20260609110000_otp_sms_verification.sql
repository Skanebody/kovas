-- ============================================================================
-- KOVAS — Mission E3 : Vérification OTP par SMS (anti-spam complémentaire)
-- Date : 2026-06-09
-- ============================================================================
--
-- Ajoute :
--   1. Extension pgcrypto (idempotent — déjà présente, sécurité).
--   2. Table `otp_codes` : codes 6 chiffres SMS hashés SHA256.
--   3. Index : (phone_e164, created_at DESC), (lead_id) partiel,
--      (expires_at) partiel sur lignes non vérifiées.
--   4. Fonction `check_otp_rate_limit(phone)` : max 3 OTP / 10 min.
--   5. Colonnes complémentaires `quote_requests.otp_verified_at` et
--      `otp_attempts` (idempotent — peut coexister avec migration E1 parallèle).
--   6. RLS : service_role only — aucune policy publique.
--
-- Usages prévus (`purpose`) :
--   - 'lead_verification'    : OTP avant submit du formulaire devis B2C
--   - 'diag_claim'           : OTP claim fiche diagnostiqueur (complément SMS)
--   - 'login_passwordless'   : OTP login sans mot de passe (V1.5)
--
-- Migration idempotente : CREATE EXTENSION/TABLE/INDEX IF NOT EXISTS,
-- ALTER TABLE ADD COLUMN IF NOT EXISTS, DROP/CREATE FUNCTION.
-- ============================================================================

-- ============================================================================
-- 0. Extensions requises
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Table otp_codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES quote_requests(id) ON DELETE CASCADE,
  phone_e164      text NOT NULL,
  code_hash       text NOT NULL,
  purpose         text NOT NULL DEFAULT 'lead_verification'
                  CHECK (purpose IN (
                    'lead_verification',
                    'diag_claim',
                    'login_passwordless'
                  )),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 5,
  verified_at     timestamptz,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE otp_codes IS
  'KOVAS E3 — codes OTP 6 chiffres envoyés par SMS pour vérification anti-spam B2C, claim diag, login passwordless.';
COMMENT ON COLUMN otp_codes.code_hash IS
  'SHA256 hex du code OTP (jamais le code en clair). Vérification via encode(digest(submitted, ''sha256''), ''hex'').';
COMMENT ON COLUMN otp_codes.purpose IS
  'lead_verification (devis B2C) | diag_claim (SMS claim) | login_passwordless (futur V1.5).';
COMMENT ON COLUMN otp_codes.expires_at IS
  'TTL 5 minutes par défaut. Au-delà : code rejeté (404 / 410).';
COMMENT ON COLUMN otp_codes.verified_at IS
  'NULL = pas encore vérifié. Une fois set, lock définitif (pas de réutilisation).';

-- ============================================================================
-- 2. Index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone_created
  ON otp_codes(phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_codes_lead
  ON otp_codes(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_codes_active_expiry
  ON otp_codes(expires_at)
  WHERE verified_at IS NULL;

-- ============================================================================
-- 3. Rate limit function : max 3 OTP en 10 minutes par phone_e164
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) < 3
  FROM public.otp_codes
  WHERE phone_e164 = p_phone
    AND created_at > now() - interval '10 minutes';
$$;

COMMENT ON FUNCTION public.check_otp_rate_limit(text) IS
  'KOVAS E3 — retourne true si moins de 3 OTP émis pour ce numéro dans les 10 dernières minutes.';

GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(text) TO service_role;

-- ============================================================================
-- 4. quote_requests : colonnes OTP (idempotent vs migration E1 parallèle)
-- ============================================================================
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS otp_verified_at timestamptz;

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS otp_attempts int NOT NULL DEFAULT 0;

COMMENT ON COLUMN quote_requests.otp_verified_at IS
  'KOVAS E3 — timestamp de la validation OTP SMS (anti-spam SMS complémentaire à email_verified).';
COMMENT ON COLUMN quote_requests.otp_attempts IS
  'KOVAS E3 — nombre de tentatives OTP cumulées sur la demande (audit + anti-bruteforce).';

CREATE INDEX IF NOT EXISTS idx_quote_requests_otp_verified
  ON quote_requests(otp_verified_at)
  WHERE otp_verified_at IS NOT NULL;

-- ============================================================================
-- 5. RLS — service_role only (aucune policy publique)
-- ============================================================================
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Pas de policy → seul le service_role (bypass RLS) peut lire/écrire.
-- Les Edge Functions / route handlers utilisent SUPABASE_SERVICE_ROLE_KEY.

-- ============================================================================
-- 6. Helper trigger : nettoyage des OTP expirés (cron-friendly)
-- ============================================================================
-- Fonction de purge appelable manuellement ou via cron (Supabase pg_cron).
CREATE OR REPLACE FUNCTION public.purge_expired_otp_codes()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.otp_codes
    WHERE (verified_at IS NULL AND expires_at < now() - interval '24 hours')
       OR (verified_at IS NOT NULL AND verified_at < now() - interval '90 days')
    RETURNING id
  )
  SELECT COUNT(*)::int FROM deleted;
$$;

COMMENT ON FUNCTION public.purge_expired_otp_codes() IS
  'KOVAS E3 — purge les OTP expirés depuis 24h (non vérifiés) ou vérifiés depuis 90j (audit). Cron Supabase recommandé.';

GRANT EXECUTE ON FUNCTION public.purge_expired_otp_codes() TO service_role;
