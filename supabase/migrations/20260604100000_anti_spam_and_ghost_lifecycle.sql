-- ============================================
-- KOVAS — Mission K1 : Anti-spam leads + multi-envoi 5 diag
--                       + cycle vie diag fantôme
-- Date : 2026-06-04
-- ============================================
--
-- Étend `quote_requests` (B2) et `diagnosticians` (A1) avec :
--   1. Anti-spam V1 : email verification (code 6 chiffres) + reCAPTCHA v3 score
--      + token public de suivi (pages /mes-demandes/[token]).
--   2. Table `quote_request_rate_limits` : compteurs IP / email / email_diag.
--   3. Table `quote_request_recipients` : ventilation multi-envoi (5 diag par défaut),
--      tracking ouverture / réponse / ignorance.
--   4. Cycle vie diag fantôme : seuils 5 / 10 / 15 leads ignorés
--      (statuts active → warned → demoted → soft_disabled → archived)
--      + pause manuelle "vacances".
--   5. Vue `v_diagnostician_routing_score` : ranking premium > verified > basic,
--      démotion automatique selon ghost_status.
--
-- Migration idempotente : ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
-- partout.
-- ============================================

-- ============================================
-- 1. quote_requests : colonnes anti-spam + tracking
-- ============================================
ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS requester_email_verified boolean NOT NULL DEFAULT false;

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS requester_verification_code text;

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS requester_verification_code_expires_at timestamptz;

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS requester_verification_sent_at timestamptz;

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS verification_attempts int NOT NULL DEFAULT 0;

-- recaptcha_score existait déjà en migration B2 (numeric(3,2)) — on n'y touche pas.

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS public_tracking_token text UNIQUE
    DEFAULT encode(gen_random_bytes(16), 'hex');

-- Étend le CHECK existant sur status : ajout de 'pending_email_verification' + 'expired'.
-- L'ancien CHECK pending|contacted|quoted|won|lost|spam ne couvre pas ces deux valeurs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_status_check'
  ) THEN
    ALTER TABLE quote_requests DROP CONSTRAINT quote_requests_status_check;
  END IF;
END $$;

ALTER TABLE quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (
    status IN (
      'pending_email_verification',
      'pending',
      'contacted',
      'quoted',
      'expired',
      'won',
      'lost',
      'spam'
    )
  );

-- Backfill : missions actives existantes restent 'pending' (vérification rétro non requise).
-- Default sur status reste 'pending' côté B2 — la route route.ts pose désormais
-- 'pending_email_verification' explicitement à l'insert pour les nouvelles demandes.

CREATE INDEX IF NOT EXISTS idx_quote_requests_tracking_token
  ON quote_requests(public_tracking_token);

CREATE INDEX IF NOT EXISTS idx_quote_requests_verification_status
  ON quote_requests(status, requester_email_verified);

COMMENT ON COLUMN quote_requests.requester_email_verified IS
  'Anti-spam K1 — true après vérification du code 6 chiffres reçu par email.';
COMMENT ON COLUMN quote_requests.requester_verification_code IS
  'Code 6 chiffres (cryptographic random) envoyé au requester. Effacé après verification réussie.';
COMMENT ON COLUMN quote_requests.public_tracking_token IS
  'Token public 32 hex pour /mes-demandes/<token> — page suivi sans auth.';

-- ============================================
-- 2. Rate limits anti-spam (table simple SQL, V1 ; Redis V1.5)
-- ============================================
CREATE TABLE IF NOT EXISTS quote_request_rate_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             text NOT NULL,
  -- 'ip:1.2.3.4' | 'email:foo@bar.com' | 'email_diag:foo@bar.com:<diag_uuid>'
  bucket_start_at timestamptz NOT NULL,
  count           int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, bucket_start_at)
);

CREATE INDEX IF NOT EXISTS idx_quote_rate_limits_key
  ON quote_request_rate_limits(key, bucket_start_at DESC);

-- Purge auto > 30j (cron côté ghost-lifecycle-cron ou pg_cron séparé)
COMMENT ON TABLE quote_request_rate_limits IS
  'Anti-spam V1 — fenêtres glissantes IP / email / email_diag. Purger > 30j via cron.';
COMMENT ON COLUMN quote_request_rate_limits.key IS
  'Format : "ip:<addr>" | "email:<addr>" | "email_diag:<addr>:<diag_uuid>".';

ALTER TABLE quote_request_rate_limits ENABLE ROW LEVEL SECURITY;

-- Aucune politique anon — uniquement service_role peut lire/écrire (route handler)
DROP POLICY IF EXISTS "rate_limits_service_all" ON quote_request_rate_limits;
CREATE POLICY "rate_limits_service_all"
  ON quote_request_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. Multi-envoi : recipients par demande
-- ============================================
CREATE TABLE IF NOT EXISTS quote_request_recipients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id  uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  diagnostician_id  uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  recipient_tier    text NOT NULL
    CHECK (recipient_tier IN ('premium', 'verified', 'basic')),
  status            text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'opened', 'responded', 'declined', 'expired', 'ignored')),
  sent_at           timestamptz NOT NULL DEFAULT now(),
  opened_at         timestamptz,
  responded_at      timestamptz,
  declined_at       timestamptz,
  ignored_at        timestamptz,
  -- Tracking Resend (tag email pour open tracking)
  resend_message_id text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_request_id, diagnostician_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_recipients_diag_status
  ON quote_request_recipients(diagnostician_id, status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_recipients_request
  ON quote_request_recipients(quote_request_id);

CREATE INDEX IF NOT EXISTS idx_quote_recipients_ghost_lifecycle
  ON quote_request_recipients(diagnostician_id, status, sent_at)
  WHERE status = 'sent' AND opened_at IS NULL;

COMMENT ON TABLE quote_request_recipients IS
  'Multi-envoi K1 — 5 diag par demande (mix premium / verified / basic). Tracking ouverture + réponse pour cycle vie fantôme.';
COMMENT ON COLUMN quote_request_recipients.recipient_tier IS
  'premium = abonnement Pro+ ; verified = compte claimed Essential/Découverte ; basic = fiche DHUP non-claimed.';

ALTER TABLE quote_request_recipients ENABLE ROW LEVEL SECURITY;

-- Diag claimed lit ses propres recipients
DROP POLICY IF EXISTS "recipients_diag_read" ON quote_request_recipients;
CREATE POLICY "recipients_diag_read"
  ON quote_request_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Diag claimed met à jour son propre statut (declined / opened)
DROP POLICY IF EXISTS "recipients_diag_update" ON quote_request_recipients;
CREATE POLICY "recipients_diag_update"
  ON quote_request_recipients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Service role full access (route handlers + cron)
DROP POLICY IF EXISTS "recipients_service_all" ON quote_request_recipients;
CREATE POLICY "recipients_service_all"
  ON quote_request_recipients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon lit recipients d'une demande via tracking_token (jointure dans la vue ci-dessous)
-- → la route /api/quote-requests/[token]/timeline utilise service_role pour join.

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_quote_recipients_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quote_recipients_updated_at ON quote_request_recipients;
CREATE TRIGGER trg_quote_recipients_updated_at
  BEFORE UPDATE ON quote_request_recipients
  FOR EACH ROW EXECUTE FUNCTION public.touch_quote_recipients_updated_at();

-- ============================================
-- 4. Cycle vie diag fantôme : seuils 5 / 10 / 15
-- ============================================
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS consecutive_ignored_leads int NOT NULL DEFAULT 0;

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS last_lead_interaction_at timestamptz;

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS ghost_status text NOT NULL DEFAULT 'active'
    CHECK (ghost_status IN ('active', 'warned', 'demoted', 'soft_disabled', 'archived'));

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS ghost_status_updated_at timestamptz;

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS ghost_notification_sent_at timestamptz;

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS manual_pause_until timestamptz;

-- Patch idempotent : intervention_radius_km manquait sur prod, l'ajouter
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS intervention_radius_km int DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_diag_ghost_status
  ON diagnosticians(ghost_status, ghost_status_updated_at)
  WHERE ghost_status <> 'active';

CREATE INDEX IF NOT EXISTS idx_diag_manual_pause
  ON diagnosticians(manual_pause_until)
  WHERE manual_pause_until IS NOT NULL;

COMMENT ON COLUMN diagnosticians.ghost_status IS
  'Cycle vie fantôme K1 — active (défaut) → warned (5 ignored 30j) → demoted (10 ignored 60j) → soft_disabled (15 ignored 90j) → archived (no login 6mo).';
COMMENT ON COLUMN diagnosticians.manual_pause_until IS
  'Pause volontaire "vacances" — pas de routing lead jusqu''à cette date.';

-- ============================================
-- 5. Vue routing score : premium > verified > basic, démotion auto
-- ============================================
CREATE OR REPLACE VIEW v_diagnostician_routing_score AS
SELECT
  d.id,
  d.slug,
  d.city,
  d.department_code,
  d.postcode AS postal_code,
  d.geo_lat,
  d.geo_lng,
  d.intervention_radius_km,
  d.certifications,
  d.gmb_rating,
  d.gmb_review_count,
  d.claimed_by_user_id,
  d.ghost_status,
  d.manual_pause_until,
  CASE
    WHEN d.ghost_status IN ('soft_disabled', 'archived') THEN 0
    WHEN d.manual_pause_until IS NOT NULL AND d.manual_pause_until > now() THEN 0
    WHEN d.ghost_status = 'demoted' THEN 1
    WHEN d.ghost_status = 'warned' THEN 5
    ELSE 10
  END AS routing_score,
  -- Tier de visibilité (heuristique V1 : claimed = verified, sinon basic ;
  -- premium = à enrichir avec join sur subscriptions Pro+ une fois K1 stabilisé)
  CASE
    WHEN d.claimed_by_user_id IS NULL THEN 'basic'
    ELSE 'verified'
  END AS recipient_tier
FROM diagnosticians d
WHERE d.is_published = true
  AND d.withdrawal_requested = false;

COMMENT ON VIEW v_diagnostician_routing_score IS
  'Ranking K1 multi-envoi — routing_score 0 (disabled) / 1 (demoted) / 5 (warned) / 10 (active). recipient_tier basic/verified/premium pour le mix 2-3/2-3/2-3.';

-- ============================================
-- 6. Helper PL/pgSQL : recompute_diag_ghost_status
--    (appelable par cron Edge Function `ghost-lifecycle-cron`)
-- ============================================
-- Compte les leads "sent" depuis > 7j sans opened_at ni responded_at,
-- met à jour ghost_status selon les seuils 5 / 10 / 15.
-- Retourne un JSONB { warned: n, demoted: n, soft_disabled: n, archived: n }.
CREATE OR REPLACE FUNCTION public.recompute_diag_ghost_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warned         int := 0;
  v_demoted        int := 0;
  v_soft_disabled  int := 0;
  v_archived       int := 0;
BEGIN
  -- 1. Marquer comme 'ignored' les recipients 'sent' > 7j sans interaction
  UPDATE quote_request_recipients
  SET status = 'ignored', ignored_at = now()
  WHERE status = 'sent'
    AND opened_at IS NULL
    AND responded_at IS NULL
    AND sent_at < now() - interval '7 days';

  -- 2. Recompute consecutive_ignored_leads pour chaque diag actif
  WITH ignored_counts AS (
    SELECT
      r.diagnostician_id,
      COUNT(*) FILTER (WHERE r.sent_at > now() - interval '30 days') AS ignored_30d,
      COUNT(*) FILTER (WHERE r.sent_at > now() - interval '60 days') AS ignored_60d,
      COUNT(*) FILTER (WHERE r.sent_at > now() - interval '90 days') AS ignored_90d
    FROM quote_request_recipients r
    WHERE r.status = 'ignored'
    GROUP BY r.diagnostician_id
  )
  UPDATE diagnosticians d
  SET
    consecutive_ignored_leads = COALESCE(ic.ignored_30d, 0),
    ghost_status = CASE
      -- Reset à active si interaction récente (< 30j)
      WHEN d.last_lead_interaction_at IS NOT NULL
       AND d.last_lead_interaction_at > now() - interval '30 days'
        THEN 'active'
      -- Seuils croissants
      WHEN COALESCE(ic.ignored_90d, 0) >= 15 THEN 'soft_disabled'
      WHEN COALESCE(ic.ignored_60d, 0) >= 10 THEN 'demoted'
      WHEN COALESCE(ic.ignored_30d, 0) >= 5  THEN 'warned'
      ELSE 'active'
    END,
    ghost_status_updated_at = now()
  FROM ignored_counts ic
  WHERE d.id = ic.diagnostician_id
    AND d.ghost_status <> 'archived';

  -- 3. Archive : pas de last_lead_interaction_at depuis 6 mois
  --    (et fiche claimed, sinon DHUP-only on garde 'active' pour SEO)
  UPDATE diagnosticians
  SET ghost_status = 'archived',
      ghost_status_updated_at = now()
  WHERE ghost_status <> 'archived'
    AND claimed_by_user_id IS NOT NULL
    AND (
      last_lead_interaction_at IS NULL
      OR last_lead_interaction_at < now() - interval '180 days'
    )
    AND created_at < now() - interval '180 days';

  -- 4. Récap métriques
  SELECT
    COUNT(*) FILTER (WHERE ghost_status = 'warned'),
    COUNT(*) FILTER (WHERE ghost_status = 'demoted'),
    COUNT(*) FILTER (WHERE ghost_status = 'soft_disabled'),
    COUNT(*) FILTER (WHERE ghost_status = 'archived')
  INTO v_warned, v_demoted, v_soft_disabled, v_archived
  FROM diagnosticians;

  RETURN jsonb_build_object(
    'warned', v_warned,
    'demoted', v_demoted,
    'soft_disabled', v_soft_disabled,
    'archived', v_archived,
    'computed_at', now()
  );
END $$;

COMMENT ON FUNCTION public.recompute_diag_ghost_status IS
  'K1 — Cron job idempotent : marque ignored_at + recompute ghost_status 5/10/15. Appelé par Edge Function ghost-lifecycle-cron 6h CET.';

-- ============================================
-- 7. Helper : enregistrer interaction lead (reset compteur ghost)
-- ============================================
CREATE OR REPLACE FUNCTION public.record_diag_lead_interaction(
  p_diagnostician_id uuid,
  p_recipient_id     uuid,
  p_event            text  -- 'opened' | 'responded' | 'declined'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update recipient
  UPDATE quote_request_recipients
  SET
    opened_at    = COALESCE(opened_at, CASE WHEN p_event = 'opened' THEN now() END),
    responded_at = COALESCE(responded_at, CASE WHEN p_event = 'responded' THEN now() END),
    declined_at  = COALESCE(declined_at, CASE WHEN p_event = 'declined' THEN now() END),
    status       = CASE
      WHEN p_event = 'responded' THEN 'responded'
      WHEN p_event = 'declined'  THEN 'declined'
      WHEN p_event = 'opened' AND status = 'sent' THEN 'opened'
      ELSE status
    END
  WHERE id = p_recipient_id;

  -- Update diagnostician (reset compteur si responded)
  UPDATE diagnosticians
  SET
    last_lead_interaction_at = now(),
    consecutive_ignored_leads = CASE
      WHEN p_event = 'responded' THEN 0
      ELSE consecutive_ignored_leads
    END,
    ghost_status = CASE
      WHEN p_event = 'responded' AND ghost_status <> 'archived' THEN 'active'
      ELSE ghost_status
    END,
    ghost_status_updated_at = CASE
      WHEN p_event = 'responded' AND ghost_status <> 'archived' THEN now()
      ELSE ghost_status_updated_at
    END
  WHERE id = p_diagnostician_id;
END $$;

COMMENT ON FUNCTION public.record_diag_lead_interaction IS
  'K1 — RPC appelée par routes API quand un diag ouvre / répond / décline un lead. Reset ghost_status si responded.';
