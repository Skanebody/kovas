-- ============================================
-- KOVAS — Séquence RGPD préalable diagnostiqueurs (Mission B1)
-- Cf. CLAUDE.md §14 (RGPD article 6.1.f intérêt légitime + droit information)
-- ============================================
-- Pré-requis : table `diagnosticians` créée par Agent A1 avec colonnes :
--   - id (uuid PK)
--   - first_name, last_name, email, city, department_code, department_name, phone
--   - certifications (jsonb) ou certifications_list (text[])
--   - certification_organization (text)
--   - public_page_slug (text)
--   - claim_status (text DEFAULT 'unclaimed' CHECK IN ('unclaimed','claimed','disputed'))
--   - claim_token (text)
--   - is_published (bool DEFAULT true)
--   - unsubscribed (bool DEFAULT false)
--   - unsubscribed_at (timestamptz)
--   - withdrawal_requested (bool DEFAULT false)
--   - withdrawal_requested_at (timestamptz)
--   - pre_notification_email_1_sent_at (timestamptz)
--   - pre_notification_email_2_sent_at (timestamptz)
--   - pre_notification_email_3_sent_at (timestamptz)
--   - created_at, updated_at
--
-- Cette migration est ADDITIVE : elle crée uniquement les tables propres B1
-- sans toucher au schéma de `diagnosticians` (responsabilité Agent A1).
-- ============================================

-- ============================================
-- 1. Table events emails (tracking Resend webhook)
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostician_email_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id    uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  email_step          int  NOT NULL CHECK (email_step IN (1, 2, 3)),
  event_type          text NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  resend_message_id   text,
  clicked_url         text,
  user_agent          text,
  ip_address          inet,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diag_email_events
  ON diagnostician_email_events (diagnostician_id, email_step, event_type);

CREATE INDEX IF NOT EXISTS idx_diag_email_events_msg
  ON diagnostician_email_events (resend_message_id)
  WHERE resend_message_id IS NOT NULL;

COMMENT ON TABLE diagnostician_email_events IS
  'Tracking opens/clicks/bounces de la séquence 3 emails RGPD préalable. Alimentée par webhook Resend.';

-- ============================================
-- 2. Table corrections proposées par diagnostiqueurs (page /corriger)
-- ============================================
CREATE TABLE IF NOT EXISTS diagnostician_corrections_pending (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id    uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  current_values      jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_changes    jsonb NOT NULL DEFAULT '{}'::jsonb,
  message             text,
  contact_email       text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'reviewed', 'applied', 'rejected')),
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES auth.users(id),
  reviewer_notes      text,
  submitter_ip        inet,
  submitter_user_agent text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diag_corrections_status
  ON diagnostician_corrections_pending (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_diag_corrections_diag
  ON diagnostician_corrections_pending (diagnostician_id, created_at DESC);

COMMENT ON TABLE diagnostician_corrections_pending IS
  'Corrections soumises via /diagnostiqueurs/[id]/corriger, à valider manuellement par Benjamin.';

-- ============================================
-- 3. RLS — bloqué par défaut (accès uniquement via service_role / Edge Functions)
-- ============================================
ALTER TABLE diagnostician_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostician_corrections_pending ENABLE ROW LEVEL SECURITY;

-- Aucune policy publique : ces tables sont écrites uniquement via service_role
-- (webhook Resend + Edge Function cron + pages publiques server-side avec admin client).
-- Les lectures se font côté admin uniquement.

-- ============================================
-- 4. Vue helper : prochaine étape email à envoyer
-- ============================================
-- Logique smart skip implémentée également côté TS (lib/emails/diagnostician-rgpd-sender.ts)
-- mais cette vue facilite les requêtes d'analytics admin.
CREATE OR REPLACE VIEW diagnostician_email_next_step AS
SELECT
  d.id AS diagnostician_id,
  d.email,
  d.claim_status,
  d.unsubscribed,
  d.withdrawal_requested,
  d.pre_notification_email_1_sent_at,
  d.pre_notification_email_2_sent_at,
  d.pre_notification_email_3_sent_at,
  CASE
    WHEN d.unsubscribed IS TRUE THEN NULL
    WHEN d.withdrawal_requested IS TRUE THEN NULL
    WHEN d.claim_status <> 'unclaimed' THEN NULL
    WHEN d.pre_notification_email_1_sent_at IS NULL THEN 1
    WHEN d.pre_notification_email_2_sent_at IS NULL
         AND d.pre_notification_email_1_sent_at < now() - interval '7 days' THEN 2
    WHEN d.pre_notification_email_3_sent_at IS NULL
         AND d.pre_notification_email_2_sent_at < now() - interval '14 days' THEN 3
    ELSE NULL
  END AS next_step
FROM diagnosticians d;

COMMENT ON VIEW diagnostician_email_next_step IS
  'Aide à l''analyse admin : étape suivante de la séquence RGPD pour chaque diagnostiqueur.';
