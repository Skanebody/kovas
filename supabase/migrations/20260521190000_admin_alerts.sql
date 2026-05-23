-- ============================================
-- KOVAS — Admin alerts engine (itération 8/N)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 (admin dashboard, prompt itération 8)
--
-- Tables :
--   - alert_rules     : règles configurables (formule de détection, severity,
--                       cooldown, configuration notification)
--   - alert_events    : historique des déclenchements + état résolution
--
-- Le moteur d'évaluation (alert-engine.ts) lit alert_rules.active = true
-- et appelle Postgres via service_role. Cron Vercel /api/cron/check-alerts
-- toutes les 5 minutes (cf. vercel.json).
--
-- RLS : SELECT/INSERT/UPDATE/DELETE réservés à is_admin(auth.uid()).
-- Les inserts de la part du cron passent par service_role (bypass RLS).
-- ============================================

-- ============================================
-- 1. alert_rules — règles configurables
-- ============================================
CREATE TABLE alert_rules (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  description              text,
  -- Formule de détection : { type, params? } discriminée côté app.
  -- Types V1 : daily_ia_cost | user_daily_ia_cap | api_error_rate
  --            | stripe_webhook_age | mrr_milestone | signups_anomaly
  detection_formula        jsonb NOT NULL,
  threshold_value          numeric,
  severity                 text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
  active                   boolean NOT NULL DEFAULT true,
  -- Cooldown : nombre de minutes minimal entre 2 déclenchements de la même règle.
  -- NULL = pas de cooldown (mrr_milestone par exemple, où chaque palier est unique).
  cooldown_minutes         int NOT NULL DEFAULT 60,
  -- Configuration notification
  notify_email             boolean NOT NULL DEFAULT false,
  notify_telegram          boolean NOT NULL DEFAULT false,
  notify_telegram_channel  text, -- 'alerts' | 'errors' | ...
  notify_message_template  text,
  notify_buttons           jsonb, -- inline keyboard pour bot Telegram (itération 9+)
  -- Auto-action (optionnel — JSON descripteur, executor V2)
  auto_action              jsonb,
  -- Tracking
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_alert_rules_active ON alert_rules (active) WHERE active = true;

-- ============================================
-- 2. alert_events — historique déclenchements
-- ============================================
CREATE TABLE alert_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id             uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  -- Cible (optionnel selon la règle)
  target_type         text, -- 'organization' | 'user' | 'global' | ...
  target_id           text,
  target_label        text,
  actual_value        numeric,
  threshold_value     numeric,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Notification tracking
  notified_email      boolean DEFAULT false,
  notified_telegram   boolean DEFAULT false,
  -- Résolution
  resolved            boolean NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES auth.users(id),
  resolution_note     text,
  -- Tracking
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_events_rule ON alert_events (rule_id, created_at DESC);
CREATE INDEX idx_alert_events_unresolved ON alert_events (resolved, created_at DESC) WHERE resolved = false;

-- ============================================
-- 3. RLS — admins only
-- ============================================
ALTER TABLE alert_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_rules_select" ON alert_rules
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "alert_rules_all" ON alert_rules
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "alert_events_select" ON alert_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "alert_events_all" ON alert_events
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- 4. Seed initial — règles standards
-- ============================================
INSERT INTO alert_rules
  (name, description, detection_formula, threshold_value, severity, cooldown_minutes, notify_telegram, notify_telegram_channel)
VALUES
  ('IA cost daily > 50€',
   'Coût IA quotidien anormalement élevé',
   '{"type":"daily_ia_cost"}'::jsonb,
   50,
   'warning',
   60,
   true,
   'alerts'),
  ('User IA cap exceeded',
   'Un user a dépassé son cap IA quotidien (cap mensuel / 30)',
   '{"type":"user_daily_ia_cap"}'::jsonb,
   NULL,
   'warning',
   1440,
   true,
   'alerts'),
  ('API error rate > 5%',
   'Taux d''erreur API > 5% sur la dernière heure',
   '{"type":"api_error_rate","window_minutes":60}'::jsonb,
   0.05,
   'critical',
   30,
   true,
   'errors'),
  ('Stripe webhook stale > 1h',
   'Aucun webhook Stripe (events.event_type ILIKE ''stripe.%'') reçu depuis 1h',
   '{"type":"stripe_webhook_age","window_minutes":60}'::jsonb,
   NULL,
   'warning',
   60,
   true,
   'errors'),
  ('MRR milestone',
   'MRR atteint un palier (1000 / 5000 / 10000 / 25000€)',
   '{"type":"mrr_milestone","levels":[1000,5000,10000,25000]}'::jsonb,
   NULL,
   'info',
   1440, -- 24h cooldown : un MRR milestone est franchi une fois, pas de spam
   true,
   'alerts'),
  ('Signups daily > avg+2σ',
   'Pic signups journalier (> moyenne 30j + 2σ)',
   '{"type":"signups_anomaly"}'::jsonb,
   NULL,
   'info',
   1440,
   true,
   'alerts')
ON CONFLICT DO NOTHING;
