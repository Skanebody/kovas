-- ============================================
-- KOVAS — Phase F — Tracking email Brevo des triggers d'upsell R1-R10
-- Cf. CLAUDE.md §5 — UX anti-friction paiement
-- Date : 2026-06-10
-- ============================================

ALTER TABLE public.upsell_suggestions
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_template_slug text,
  ADD COLUMN IF NOT EXISTS brevo_message_id text,
  ADD COLUMN IF NOT EXISTS email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_upsell_email_pending
  ON public.upsell_suggestions (status, email_sent_at)
  WHERE status = 'pending' AND email_sent_at IS NULL;

COMMENT ON COLUMN public.upsell_suggestions.email_sent_at IS
  'Timestamp de l''envoi via Edge Function send-upsell-trigger-email + template Brevo.';
COMMENT ON COLUMN public.upsell_suggestions.email_template_slug IS
  'Slug du template Brevo utilisé (ex: upsell-r1-plan-upgrade).';
COMMENT ON COLUMN public.upsell_suggestions.brevo_message_id IS
  'messageId retourné par Brevo, utilisé pour matcher webhooks open/click/unsubscribe.';
