-- ============================================
-- KOVAS — Dashboard Admin (itération 1/N)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 (admin dashboard, prompt itération 1)
--
-- Tables admin GLOBALES (pas multi-tenant) :
--   - admin_users           : allowlist (super_admin | admin | support)
--   - admin_audit_log       : journal IMMUABLE (UPDATE/DELETE bloqués via trigger)
--   - admin_2fa_secrets     : secrets TOTP par admin (chiffrés AES-GCM côté app)
--   - admin_2fa_attempts    : tentatives 2FA (rate limit)
--
-- Helper :
--   - public.is_admin(uuid) : check membership active dans admin_users
--
-- RLS strictes : un admin lit/écrit ses propres secrets 2FA ; SELECT général
-- réservé aux admins ; INSERT/UPDATE/DELETE sur admin_users/audit_log via
-- service_role uniquement (routes API signées).
-- ============================================

-- ============================================
-- 1. admin_users — allowlist
-- ============================================
CREATE TABLE admin_users (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role               text NOT NULL CHECK (role IN ('super_admin', 'admin', 'support')) DEFAULT 'admin',
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  -- Optionnel : chat_id Telegram pour notifications (itération bot Telegram)
  telegram_chat_id   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id),
  last_login_at      timestamptz
);

CREATE INDEX idx_admin_users_active ON admin_users (is_active) WHERE is_active = true;

-- ============================================
-- 2. admin_audit_log — IMMUABLE (append-only)
-- ============================================
CREATE TABLE admin_audit_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id      uuid NOT NULL REFERENCES auth.users(id),
  action_type        text NOT NULL,
  action_source      text NOT NULL CHECK (action_source IN (
    'dashboard_web', 'telegram_bot_command', 'telegram_bot_button',
    'telegram_bot_nlp', 'system_automated', 'cli'
  )),
  target_type        text,                -- 'user' | 'organization' | 'dossier' | 'alert' | ...
  target_id          text,                -- UUID ou identifiant externe
  target_label       text,                -- label humain (pour affichage rapide)
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_state     jsonb,
  new_state          jsonb,
  ip_address         text,
  user_agent         text,
  succeeded          boolean NOT NULL,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_admin   ON admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX idx_audit_target  ON admin_audit_log (target_type, target_id);
CREATE INDEX idx_audit_action  ON admin_audit_log (action_type, created_at DESC);
CREATE INDEX idx_audit_failed  ON admin_audit_log (succeeded, created_at DESC) WHERE succeeded = false;

-- Trigger d'immuabilité : empêche tout UPDATE/DELETE (même depuis service_role)
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is immutable, % not allowed', TG_OP;
END;
$$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

-- ============================================
-- 3. admin_2fa_secrets — TOTP secret par admin
-- ============================================
-- Le secret base32 (RFC 6238) est chiffré côté application via AES-256-GCM
-- avec la clef ADMIN_2FA_ENCRYPTION_KEY (32 bytes hex, env var).
-- Format stocké : base64(nonce || ciphertext || authtag).
CREATE TABLE admin_2fa_secrets (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted   text NOT NULL,
  enabled            boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  enabled_at         timestamptz,
  last_used_at       timestamptz
);

-- ============================================
-- 4. admin_2fa_attempts — rate limit (3 tentatives ratées / 15 min → blocage)
-- ============================================
CREATE TABLE admin_2fa_attempts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success            boolean NOT NULL,
  ip_address         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_2fa_attempts_user_window ON admin_2fa_attempts (user_id, created_at DESC);

-- ============================================
-- 5. Helper SQL is_admin(user_id)
-- ============================================
-- Utilisable dans les policies RLS sans risque de récursion (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = p_user_id
      AND is_active = true
  );
$$;

-- ============================================
-- 6. RLS — toutes tables verrouillées
-- ============================================
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_2fa_secrets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_2fa_attempts ENABLE ROW LEVEL SECURITY;

-- admin_users : SELECT pour les admins seulement.
-- INSERT/UPDATE/DELETE via service_role uniquement (bootstrap CLI / route admin signée).
CREATE POLICY "admin_users_select" ON admin_users
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- admin_audit_log : SELECT pour les admins.
-- INSERT via service_role (routes admin instrumentées).
CREATE POLICY "audit_log_select" ON admin_audit_log
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- admin_2fa_secrets : un admin voit/modifie SES propres secrets.
CREATE POLICY "2fa_secrets_self" ON admin_2fa_secrets
  FOR ALL
  USING (user_id = auth.uid() AND public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_admin(auth.uid()));

-- admin_2fa_attempts : self only en lecture (debug / affichage rate limit).
CREATE POLICY "2fa_attempts_self" ON admin_2fa_attempts
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- 7. Activation manuelle Benjamin (super_admin)
-- ============================================
-- À exécuter MANUELLEMENT après signup :
-- 1. Benjamin signup via /signup avec son email (ex: contact@kovas.fr)
-- 2. Récupérer son user_id :
--    SELECT id FROM auth.users WHERE email = 'contact@kovas.fr';
-- 3. Exécuter :
--    INSERT INTO admin_users (user_id, role, telegram_chat_id, notes)
--    VALUES ('<USER_ID>', 'super_admin', '<TELEGRAM_CHAT_ID_OR_NULL>', 'Founder');
-- 4. Setup 2FA via script CLI :
--    cd apps/web && node scripts/admin-setup-2fa.mjs <USER_EMAIL>
--    (le script génère un secret base32, l'affiche en otpauth:// + en QR ASCII,
--     puis stocke la version chiffrée dans admin_2fa_secrets avec enabled=true).
-- =========================================================================
