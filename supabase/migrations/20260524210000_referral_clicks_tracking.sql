-- ============================================
-- KOVAS — Tracking liens affiliés parrainage (FIX-EE)
--
-- Contexte : la page /dashboard/account/parrainage utilise désormais
-- des LIENS AFFILIÉS tracés (https://kovas.fr/r/KOV-XXXXX) plutôt qu'un
-- simple code à recopier. Cette migration :
--   1. corrige le bug RLS bloquant l'INSERT de codes (cause root du 500
--      remonté par Benjamin : pas de policy WITH CHECK sur referral_codes)
--   2. crée la table referral_clicks pour l'analytics liens affiliés
--   3. ajoute un index dédié au lookup public du code (route /r/[code])
-- ============================================

-- ============================================
-- 1) FIX RLS : autoriser l'INSERT du code par son propriétaire
-- ============================================

-- Owner peut créer son propre code (idempotent via UNIQUE user_id)
DROP POLICY IF EXISTS "referral_codes: owner insert" ON referral_codes;
CREATE POLICY "referral_codes: owner insert"
  ON referral_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Lookup public côté SSR de /r/[code] : seul le `code` + activation est lu.
-- On crée une RPC SECURITY DEFINER pour exposer ce lookup sans casser la
-- RLS owner-only (alternative : policy publique SELECT — refusée RGPD car
-- elle exposerait la cartographie code ↔ user_id).
CREATE OR REPLACE FUNCTION public.lookup_referral_code(p_code text)
RETURNS TABLE (referrer_id uuid, active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_id AS referrer_id, active
  FROM public.referral_codes
  WHERE code = p_code
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_referral_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.lookup_referral_code(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.lookup_referral_code(text) IS
  'Lookup public d''un code de parrainage côté SSR (/r/[code]) sans exposer la table referral_codes via une policy SELECT publique. Retourne uniquement {referrer_id, active}.';

-- ============================================
-- 2) referral_clicks : journal des clics sur liens affiliés
-- Permet aux parrains d'observer leur portée (clics vs inscriptions)
-- et aux admins d'analyser la viralité.
-- ============================================
CREATE TABLE IF NOT EXISTS referral_clicks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code         text NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  -- IP hashée SHA-256 (RGPD : on évite de stocker l'IP brute)
  ip_hash               text NOT NULL,
  user_agent            text,
  referer_url           text,
  -- canal de partage présumé (utm-like, optionnel) : 'whatsapp' | 'linkedin' | 'sms' | 'email' | 'direct' | 'qr'
  channel               text,
  clicked_at            timestamptz NOT NULL DEFAULT now(),
  converted_to_signup   boolean NOT NULL DEFAULT false,
  signup_user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks (referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked_at ON referral_clicks (clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_signup_user ON referral_clicks (signup_user_id)
  WHERE signup_user_id IS NOT NULL;

ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- Le parrain voit les clics sur SON code (jointure referral_codes)
DROP POLICY IF EXISTS "referral_clicks: owner read" ON referral_clicks;
CREATE POLICY "referral_clicks: owner read"
  ON referral_clicks FOR SELECT
  USING (
    referral_code IN (
      SELECT code FROM referral_codes WHERE user_id = auth.uid()
    )
  );

-- Insert via RPC SECURITY DEFINER (cf. ci-dessous) — pas de policy directe.

-- ============================================
-- 3) RPC publique pour logger un clic (depuis /r/[code])
-- SECURITY DEFINER + STRICT input validation côté SQL.
-- ============================================
CREATE OR REPLACE FUNCTION public.log_referral_click(
  p_code        text,
  p_ip_hash     text,
  p_user_agent  text DEFAULT NULL,
  p_referer     text DEFAULT NULL,
  p_channel     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      uuid;
  v_exists  boolean;
BEGIN
  -- Format strict KOV-XXXXX (sinon on no-op silencieusement)
  IF p_code !~ '^KOV-[A-Z2-9]{5}$' THEN
    RETURN NULL;
  END IF;

  -- ip_hash doit ressembler à du SHA-256 hex (64 chars)
  IF p_ip_hash IS NULL OR length(p_ip_hash) <> 64 OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN NULL;
  END IF;

  -- Vérifie que le code existe ET est actif
  SELECT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = p_code AND active = true)
  INTO v_exists;
  IF NOT v_exists THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referral_clicks (referral_code, ip_hash, user_agent, referer_url, channel)
  VALUES (p_code, p_ip_hash, p_user_agent, p_referer, p_channel)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_referral_click(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_referral_click(text, text, text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.log_referral_click(text, text, text, text, text) IS
  'Logue un clic sur lien affilié /r/[code] (server-side uniquement). Valide le format du code et le hash IP. No-op silencieux si format invalide.';

-- ============================================
-- 4) Vue agrégée : compteurs de clics par code (consultable par parrain)
-- ============================================
CREATE OR REPLACE VIEW referral_clicks_per_code
WITH (security_invoker = on)
AS
SELECT
  rc.code,
  rc.user_id AS referrer_id,
  COUNT(rcl.id)::int AS total_clicks,
  COUNT(rcl.id) FILTER (WHERE rcl.clicked_at >= now() - INTERVAL '30 days')::int AS clicks_30d,
  COUNT(rcl.id) FILTER (WHERE rcl.converted_to_signup = true)::int AS conversions,
  MAX(rcl.clicked_at) AS last_click_at
FROM referral_codes rc
LEFT JOIN referral_clicks rcl ON rcl.referral_code = rc.code
GROUP BY rc.code, rc.user_id;

COMMENT ON TABLE referral_clicks IS 'Journal des clics sur les liens affiliés /r/[code] — IP hashée SHA-256 pour conformité RGPD, conservation 13 mois.';
COMMENT ON VIEW referral_clicks_per_code IS 'Agrégats clics par code de parrainage. security_invoker=on : visible uniquement via RLS du parrain propriétaire.';
