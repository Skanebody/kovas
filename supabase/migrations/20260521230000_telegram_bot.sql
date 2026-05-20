-- ============================================
-- KOVAS — Bot Telegram admin (itération 12/N — partie 1)
-- Date : 2026-05-21
-- Cf. CLAUDE.md §22 (admin dashboard, prompt itération 12 partie 1)
--
-- Tables :
--   - telegram_bot_interactions : historique conversations (commandes, boutons,
--     NLP, notifications) — audit immuable côté bot Telegram
--   - pending_admin_actions     : confirmations 2-étapes (NLP / boutons) avec
--     expiration auto 10 minutes
--
-- Tous les writes passent par service_role (le webhook bot signe via secret
-- header — pas d'auth utilisateur). RLS strictes : SELECT réservé aux admins
-- (lecture audit/debug depuis dashboard /admin).
-- ============================================

-- ============================================
-- 1. telegram_bot_interactions — historique
-- ============================================
CREATE TABLE telegram_bot_interactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id             bigint NOT NULL,
  user_id             uuid REFERENCES auth.users(id),
  message_id          bigint,
  -- Type d'interaction (discriminant)
  type                text NOT NULL CHECK (type IN (
    'command', 'callback_query', 'nlp_message', 'notification_sent',
    'confirmation_request', 'confirmation_response'
  )),
  -- Payload
  user_message        text,
  bot_response        text,
  command_name        text,
  callback_data       text,
  tool_uses           jsonb,
  -- IA cost si NLP
  ai_cost_eur         numeric,
  -- Tracking
  succeeded           boolean,
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tg_chat ON telegram_bot_interactions (chat_id, created_at DESC);
CREATE INDEX idx_tg_user ON telegram_bot_interactions (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ============================================
-- 2. pending_admin_actions — confirmations 2-étapes
-- ============================================
CREATE TABLE pending_admin_actions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id             bigint NOT NULL,
  user_id             uuid REFERENCES auth.users(id),
  -- Description user-friendly affichée dans le message de confirmation
  description         text NOT NULL,
  -- Tool calls à exécuter une fois confirmé (descripteur JSON, exécuté côté app)
  tool_uses           jsonb NOT NULL,
  -- Message NLP d'origine (contexte audit)
  original_message    text,
  -- État
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  resolved_at         timestamptz,
  -- Expiration auto 10 min — le webhook vérifie expires_at avant exécution
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_chat    ON pending_admin_actions (chat_id, status);
CREATE INDEX idx_pending_expires ON pending_admin_actions (expires_at)
  WHERE status = 'pending';

-- ============================================
-- 3. RLS — admins only (lecture), writes via service_role
-- ============================================
ALTER TABLE telegram_bot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_admin_actions     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tg_interactions_select" ON telegram_bot_interactions
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "pending_actions_select" ON pending_admin_actions
  FOR SELECT
  USING (public.is_admin(auth.uid()));
