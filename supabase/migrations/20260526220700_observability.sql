-- ============================================
-- KOVAS — Observabilité P1 (email_events + perf_metrics)
--
-- Deux tables d'observabilité opérationnelle pour les sections admin
-- /admin/email-health et /admin/performance.
--
--   1. email_events    → événements Resend (delivered, bounced, complained, etc.)
--                        alimentée par /api/webhooks/resend (signature HMAC)
--   2. perf_metrics    → latence des opérations non-IA critiques
--                        (export ZIP Liciel, génération PDF, etc.)
--                        ai_usage déjà tracké séparément (cf. /admin/cout-ia).
--
-- Lecture admin seule (RLS denied pour les users — service_role uniquement).
-- ============================================

-- ============================================
-- 1. email_events — webhook Resend
-- ============================================
CREATE TABLE IF NOT EXISTS email_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  text,                   -- Resend message id (uniqueness côté webhook)
  recipient   text NOT NULL,
  -- Catégorie KOVAS (correspond à EmailCategory côté code) — null si webhook
  -- avant de matcher la tag « category ».
  email_type  text,                   -- 'transactional' | 'alert' | 'digest' | 'product' | 'invoice' | 'gain_report'
  event_type  text NOT NULL CHECK (event_type IN (
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',         -- hard bounce
    'soft_bounced',
    'complained',
    'opened',
    'clicked',
    'unsubscribed'
  )),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_created
  ON email_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient
  ON email_events (recipient, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type
  ON email_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type
  ON email_events (email_type, created_at DESC) WHERE email_type IS NOT NULL;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
-- Aucune policy SELECT — accès uniquement via service_role (createAdminClient).

COMMENT ON TABLE email_events IS
  'Événements Resend (delivery/bounce/complaint). Alimentée par /api/webhooks/resend. Lecture admin uniquement (service_role).';

-- ============================================
-- 2. perf_metrics — latence opérations non-IA
-- ============================================
CREATE TABLE IF NOT EXISTS perf_metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation       text NOT NULL,      -- 'export_zip_liciel', 'pdf_generation', 'mission_consolidate', etc.
  duration_ms     int NOT NULL CHECK (duration_ms >= 0),
  status          text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  error_code      text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perf_metrics_op_created
  ON perf_metrics (operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_created
  ON perf_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_status
  ON perf_metrics (status, created_at DESC) WHERE status <> 'success';

ALTER TABLE perf_metrics ENABLE ROW LEVEL SECURITY;
-- Aucune policy SELECT user — accès via service_role admin uniquement.

COMMENT ON TABLE perf_metrics IS
  'Latence des opérations non-IA (export ZIP Liciel, PDF, etc.). Compagne de ai_usage. Lecture admin uniquement (service_role).';

-- ============================================
-- 3. user_admin_tags — tags admin pour les users (ex : "à appeler")
-- Référencée par /admin/churn-risk (bouton "Tag → à appeler").
-- ============================================
CREATE TABLE IF NOT EXISTS user_admin_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_admin_tags_user
  ON user_admin_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_tags_tag
  ON user_admin_tags (tag, created_at DESC);

ALTER TABLE user_admin_tags ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_admin_tags IS
  'Tags admin (manuels) sur les users — ex. "à appeler", "à relancer". Lecture/écriture admin uniquement.';
