-- ============================================
-- KOVAS — Système d'upsell intelligent (L1 — 2026-06-05)
-- Cf. CLAUDE.md §4 + docs/upsell-architecture.md
--
-- Deux tables :
--   1. user_behavior_events  — événements comportementaux bruts
--      (création missions/factures, tentatives features gated, seuils quotas)
--   2. upsell_suggestions    — suggestions calculées par
--      behavioral-trigger-analyzer (cron quotidien). Affichage in-app +
--      digest mensuel via monthly-upsell-digest.
--
-- RLS : service-role pour les events (toutes analyses server-side).
-- Les users peuvent lire LEURS suggestions (pour sidebar dot + drawer).
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_behavior_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN (
    'mission_created', 'mission_exported',
    'invoice_created', 'invoice_emitted', 'invoice_paid',
    'devis_created', 'devis_sent',
    'lead_received', 'lead_responded', 'lead_ignored',
    'pennylane_attempted', 'analytics_attempted', 'cockpit_m2_attempted',
    'bilingual_report_attempted', 'signature_attempted',
    'whisper_quota_80pct', 'storage_quota_80pct', 'missions_quota_80pct',
    'vision_quota_80pct'
  )),
  event_data      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user_type
  ON public.user_behavior_events (user_id, event_type, created_at DESC);

-- Patch idempotent : retire le prédicat now() non-immutable, garde l'index simple
CREATE INDEX IF NOT EXISTS idx_user_events_recent
  ON public.user_behavior_events (created_at DESC);

COMMENT ON TABLE public.user_behavior_events IS
  'Events comportementaux pour l''upsell intelligent (L1). Lecture/écriture service-role uniquement — toutes les analyses passent par routes API server-side.';

-- ─────────────────────────────────────────────
-- Suggestions d'upsell
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.upsell_suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type     text NOT NULL CHECK (suggestion_type IN ('addon', 'pack', 'tier_upgrade')),
  suggested_target    text NOT NULL,
  reason_label        text NOT NULL,
  reason_benefit      text NOT NULL,
  estimated_value_eur int,
  priority            int NOT NULL DEFAULT 50,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shown_in_app', 'shown_email', 'dismissed', 'converted')),
  shown_in_app_at     timestamptz,
  shown_email_at      timestamptz,
  dismissed_at        timestamptz,
  converted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, suggestion_type, suggested_target, created_at)
);

-- Patch idempotent : la table peut exister depuis une migration legacy avec un schéma
-- différent. Ajoute les colonnes manquantes attendues par cette migration.
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS suggestion_type text;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS suggested_target text;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS reason_label text;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS reason_benefit text;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS estimated_value_eur int;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 50;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS shown_in_app_at timestamptz;
ALTER TABLE public.upsell_suggestions ADD COLUMN IF NOT EXISTS shown_email_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_upsell_pending
  ON public.upsell_suggestions (user_id, status, priority DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_upsell_user_recent
  ON public.upsell_suggestions (user_id, created_at DESC);

COMMENT ON TABLE public.upsell_suggestions IS
  'Suggestions d''upsell calculées par behavioral-trigger-analyzer. priority desc → top suggestion à afficher.';
COMMENT ON COLUMN public.upsell_suggestions.suggested_target IS
  'Code module (addon code, pack code, ou plan_code).';

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_behavior_events: service role only" ON public.user_behavior_events;
CREATE POLICY "user_behavior_events: service role only"
  ON public.user_behavior_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "upsell_suggestions: user reads own" ON public.upsell_suggestions;
CREATE POLICY "upsell_suggestions: user reads own"
  ON public.upsell_suggestions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "upsell_suggestions: user updates own dismissal" ON public.upsell_suggestions;
CREATE POLICY "upsell_suggestions: user updates own dismissal"
  ON public.upsell_suggestions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "upsell_suggestions: service role full" ON public.upsell_suggestions;
CREATE POLICY "upsell_suggestions: service role full"
  ON public.upsell_suggestions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
