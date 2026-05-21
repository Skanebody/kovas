-- ============================================
-- KOVAS App — Module 4 + 5 : Idempotence Stripe + journal d'envoi messages
-- Date : 2026-05-25
--
-- Trois ajouts complémentaires :
--   1. stripe_webhook_events : journal d'idempotence pour les webhooks Stripe
--   2. outgoing_message_log  : journal RGPD des envois email/SMS automatiques
--   3. user_preferences.email_marketing_enabled : opt-out par utilisateur
-- ============================================

-- ============================================
-- 1. Idempotence webhook Stripe
-- ============================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id                text PRIMARY KEY,                          -- evt_xxx (Stripe event ID)
  event_type        text NOT NULL,                              -- 'invoice.payment_succeeded', etc.
  livemode          boolean NOT NULL DEFAULT false,
  payload_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,         -- extrait minimal (PI id, customer id...)
  processed_at      timestamptz NOT NULL DEFAULT now(),
  processing_result text NOT NULL DEFAULT 'ok'
                      CHECK (processing_result IN ('ok','error','ignored')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stripe_webhook_events IS
  'Journal d''idempotence des webhooks Stripe. PRIMARY KEY = Stripe event.id, donc une seconde
   réception du même event sera ignorée naturellement (ON CONFLICT DO NOTHING côté worker).';

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON stripe_webhook_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_result
  ON stripe_webhook_events (processing_result, created_at DESC)
  WHERE processing_result <> 'ok';

-- RLS : admin only en lecture (audit interne).
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_webhook_events_admin_read"
  ON stripe_webhook_events FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- Pas de policy INSERT/UPDATE/DELETE : seul le service_role écrit (bypass RLS).

-- ============================================
-- 2. Journal d'envoi messages automatiques (RGPD audit)
-- ============================================
CREATE TABLE IF NOT EXISTS outgoing_message_log (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  channel             text NOT NULL CHECK (channel IN ('email','sms','task','in_app')),
  category            text NOT NULL CHECK (category IN (
                        'transactional','alert','digest','product',
                        'follow_up_quote','follow_up_invoice','follow_up_post_dpe',
                        'follow_up_prescriber','follow_up_review','payment_unlock'
                      )),
  recipient_to        text NOT NULL,                            -- email ou +33...
  subject             text,
  template_slug       text,                                     -- ex: 'quote_pending_step1'
  sequence_id         uuid REFERENCES follow_up_sequences(id) ON DELETE SET NULL,
  sequence_step       int,
  -- Cible polymorphe (mission/quote/invoice/contact...).
  target_entity_type  text,
  target_entity_id    uuid,
  -- Statut d'envoi.
  status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','failed','skipped_optout','skipped_rate_limit')),
  provider_id         text,                                     -- Resend/Brevo ID retourné
  error_message       text,
  sent_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outgoing_message_log IS
  'Journal RGPD de tous les envois automatiques (email/SMS/in_app). Sert d''audit, de quota
   et de garde-fou anti-spam (rate limit applicatif).';

CREATE INDEX IF NOT EXISTS idx_outgoing_message_log_org
  ON outgoing_message_log (organization_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outgoing_message_log_sequence
  ON outgoing_message_log (sequence_id) WHERE sequence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outgoing_message_log_target
  ON outgoing_message_log (target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_message_log_recipient
  ON outgoing_message_log (recipient_to, sent_at DESC);

-- RLS : org members peuvent lire leurs propres envois.
ALTER TABLE outgoing_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY oml_select_org
  ON outgoing_message_log FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_member_of(organization_id)
  );

CREATE POLICY oml_select_admin
  ON outgoing_message_log FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- Pas de policy INSERT/UPDATE/DELETE : seul le service_role écrit.

-- ============================================
-- 3. Opt-out marketing par utilisateur
-- ============================================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS email_marketing_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_marketing_enabled   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_up_opt_out_at    timestamptz;

COMMENT ON COLUMN user_preferences.email_marketing_enabled IS
  'Opt-out global emails non-transactionnels (séquences de relance, digests).
   Les emails transactionnels (auth, paiement) NE sont JAMAIS bloqués par ce flag.';
COMMENT ON COLUMN user_preferences.sms_marketing_enabled IS
  'Opt-out global SMS non-transactionnels (rappels RDV J-1 restent envoyés en transactionnel).';
COMMENT ON COLUMN user_preferences.follow_up_opt_out_at IS
  'Horodatage d''opt-out des séquences de relance — null tant qu''actif.';

-- ============================================
-- FIN MIGRATION webhook_events_and_messaging_log
-- ============================================
