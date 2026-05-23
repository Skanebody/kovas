-- ============================================================================
-- KOVAS — Consolidate schema reconciliation (FIX-AA)
-- Date : 2026-05-24
-- ============================================================================
-- Cette migration consolide les écarts identifiés entre les 130+ migrations
-- locales et l'état de la prod (project ref jlizdkffwjdiokvmhcwg). Elle est
-- 100% idempotente — peut être rejouée sans risque, ne supprime aucune donnée.
--
-- Contexte : la prod a été construite par patches successifs via Management API
-- sans tracking dans `supabase_migrations.schema_migrations`. Certaines
-- colonnes/tables intermédiaires manquent, ce qui bloque le replay séquentiel
-- de plusieurs migrations clés (quote_requests, upsell_suggestions, etc).
--
-- Objet : réparer les écarts identifiés par scripts/migration-status-audit.ts
-- (snapshot prod : 144 tables, 715 fns, 628 indexes, 256 policies avant
-- exécution de cette consolidate).
--
-- Audit JSON associé : scripts/migration-status-result.json
-- Snapshot pré-consolidate : backups/prod-snapshot-2026-05-23-*.json
-- ============================================================================

-- ============================================================================
-- 0. Extensions requises
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. Helper : immutable_unaccent — nécessaire pour les index sur unaccent()
-- ============================================================================
-- L'index sur `unaccent(full_name)` exige une fonction IMMUTABLE. La fonction
-- native unaccent() est STABLE (peut dépendre du dictionnaire). On wrappe avec
-- une version explicitement IMMUTABLE.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT unaccent('unaccent', $1)
$$;

COMMENT ON FUNCTION public.immutable_unaccent IS
  'Wrapper IMMUTABLE autour de unaccent() pour usage dans index predicates et generation expressions.';

-- ============================================================================
-- 2. Ajout colonnes manquantes sur `diagnosticians`
-- ============================================================================
-- Identifiées par l'audit : claimed_by_user_id, claimed_at, email, slug_city,
-- full_name_normalized (pour search), email_verified_at, withdrawal_status,
-- ghost_status etc. — colonnes attendues par migrations en aval.

ALTER TABLE public.diagnosticians
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS email              text,
  ADD COLUMN IF NOT EXISTS email_verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS slug_city          text,
  ADD COLUMN IF NOT EXISTS full_name_normalized text
    GENERATED ALWAYS AS (lower(public.immutable_unaccent(coalesce(full_name, ''))) ) STORED,
  ADD COLUMN IF NOT EXISTS lead_cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS boost_lead_active   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leads_received_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_unlocked_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_level       text NOT NULL DEFAULT 'free'
    CHECK (listing_level IN ('free', 'standard', 'premium')),
  ADD COLUMN IF NOT EXISTS organization_id_v2  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes utiles pour les colonnes ajoutées
CREATE INDEX IF NOT EXISTS idx_diag_claimed_by
  ON public.diagnosticians (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diag_email
  ON public.diagnosticians (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diag_full_name_normalized_trgm
  ON public.diagnosticians USING gin (full_name_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_diag_listing_level
  ON public.diagnosticians (listing_level, dept_code)
  WHERE listing_level <> 'free';

-- ============================================================================
-- 3. Création table `quote_requests` (bloquante pour 6+ migrations en aval)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostician_id         uuid REFERENCES public.diagnosticians(id) ON DELETE CASCADE,

  -- Contact requester
  requester_first_name     text NOT NULL,
  requester_last_name      text NOT NULL,
  requester_email          text NOT NULL,
  requester_phone          text,

  -- Bien
  property_type            text NOT NULL,
  property_situation       text NOT NULL,
  property_address         text,
  property_postal_code     text,
  property_city            text,
  property_surface_m2      int,
  property_year_built      int,
  property_geo_lat         double precision,
  property_geo_lng         double precision,

  diagnostics_requested    text[] NOT NULL DEFAULT '{}',
  diagnostics_suggested    jsonb,

  message                  text,

  status                   text NOT NULL DEFAULT 'pending',

  diag_notified_at         timestamptz,
  diag_responded_at        timestamptz,

  ip_address               inet,
  user_agent               text,
  honeypot_filled          boolean DEFAULT false,
  recaptcha_score          numeric(3,2),

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Contrainte CHECK status — extensible par migrations futures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_status_check'
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_status_check
      CHECK (status IN (
        'pending_email_verification',
        'pending_routing',
        'pending',
        'contacted',
        'quoted',
        'expired',
        'won',
        'lost',
        'spam'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quote_req_diag
  ON public.quote_requests (diagnostician_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_req_email
  ON public.quote_requests (requester_email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_pending_routing
  ON public.quote_requests (created_at DESC)
  WHERE status = 'pending_routing';

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_requests_anon_insert ON public.quote_requests;
CREATE POLICY quote_requests_anon_insert
  ON public.quote_requests
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS quote_requests_service_all ON public.quote_requests;
CREATE POLICY quote_requests_service_all
  ON public.quote_requests
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS quote_requests_diag_read ON public.quote_requests;
CREATE POLICY quote_requests_diag_read
  ON public.quote_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_updated_at_quote_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_requests_updated_at ON public.quote_requests;
CREATE TRIGGER trg_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_quote_requests();

-- ============================================================================
-- 4. Création table `user_preferences` (bloquante pour scheduling + reports)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id                      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone                     text NOT NULL DEFAULT 'Europe/Paris',
  locale                       text NOT NULL DEFAULT 'fr-FR',
  email_notifications_enabled  boolean NOT NULL DEFAULT true,
  push_notifications_enabled   boolean NOT NULL DEFAULT true,
  sms_notifications_enabled    boolean NOT NULL DEFAULT false,
  monthly_report_enabled       boolean NOT NULL DEFAULT true,
  weekly_summary_enabled       boolean NOT NULL DEFAULT true,
  daily_briefing_enabled       boolean NOT NULL DEFAULT false,
  marketing_emails_enabled     boolean NOT NULL DEFAULT true,
  theme                        text NOT NULL DEFAULT 'auto'
    CHECK (theme IN ('auto', 'light', 'dark')),
  preferences_json             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_self ON public.user_preferences;
CREATE POLICY user_preferences_self
  ON public.user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. Création table `upsell_suggestions` (bloquante upsell_email_tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.upsell_suggestions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id         uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_event           text NOT NULL,
  target_addon_module_id  uuid REFERENCES public.addon_modules(id) ON DELETE CASCADE,
  target_plan_code        text,
  suggested_at            timestamptz NOT NULL DEFAULT now(),
  surfaced_at             timestamptz,
  clicked_at              timestamptz,
  dismissed_at            timestamptz,
  converted_at            timestamptz,
  conversion_value_cents  int,
  context_json            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upsell_suggestions_user
  ON public.upsell_suggestions (user_id, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_upsell_suggestions_trigger
  ON public.upsell_suggestions (trigger_event, suggested_at DESC);
CREATE INDEX IF NOT EXISTS idx_upsell_suggestions_unsurfaced
  ON public.upsell_suggestions (user_id, suggested_at DESC)
  WHERE surfaced_at IS NULL;

ALTER TABLE public.upsell_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upsell_suggestions_self ON public.upsell_suggestions;
CREATE POLICY upsell_suggestions_self
  ON public.upsell_suggestions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS upsell_suggestions_service ON public.upsell_suggestions;
CREATE POLICY upsell_suggestions_service
  ON public.upsell_suggestions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. Ajout colonnes manquantes sur `addon_modules` et `user_addons`
-- ============================================================================
ALTER TABLE public.addon_modules
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category  text;

CREATE INDEX IF NOT EXISTS idx_addon_modules_active
  ON public.addon_modules (is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_addon_modules_code
  ON public.addon_modules (module_code);
CREATE INDEX IF NOT EXISTS idx_addon_modules_category
  ON public.addon_modules (category);

ALTER TABLE public.user_addons
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata    jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_addons_expires
  ON public.user_addons (expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_addons_org
  ON public.user_addons (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_subscription
  ON public.user_addons (subscription_id);

-- ============================================================================
-- 7. Ajout colonnes manquantes sur `accounting_connectors` (Pennylane)
-- ============================================================================
ALTER TABLE public.accounting_connectors
  ADD COLUMN IF NOT EXISTS encrypted_token     text,
  ADD COLUMN IF NOT EXISTS encrypted_secret    text,
  ADD COLUMN IF NOT EXISTS pennylane_company_id text,
  ADD COLUMN IF NOT EXISTS is_active           boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_accounting_connectors_active
  ON public.accounting_connectors (is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_accounting_connectors_org
  ON public.accounting_connectors (organization_id);

-- ============================================================================
-- 8. Helper `is_admin(p_user_id uuid)` — référencé partout dans les policies
-- ============================================================================
-- IMPORTANT : on garde la signature existante `p_user_id uuid` (audit prod
-- confirme ce nom). CREATE OR REPLACE sans DROP pour ne pas casser les ~50
-- policies dépendantes.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = p_user_id
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin(uuid) IS
  'Renvoie true si l''utilisateur est dans admin_users avec is_active=true. Utilisable dans les policies RLS (SECURITY DEFINER, anti-récursion).';

-- ============================================================================
-- 9. Backfill : si une fiche diagnostician a déjà été "claimed" via l'ancien
-- système (user_id direct dans organizations), recopier sur claimed_by_user_id.
-- ============================================================================
UPDATE public.diagnosticians d
SET claimed_by_user_id = m.user_id,
    claimed_at = COALESCE(d.claimed_at, now())
FROM public.memberships m
WHERE d.organization_id = m.organization_id
  AND m.role IN ('owner', 'admin')
  AND d.claimed_by_user_id IS NULL
  AND d.organization_id IS NOT NULL;

-- ============================================================================
-- 10. Sentinel : INSERT dans schema_migrations pour tracker cette consolidate
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version    text PRIMARY KEY,
  name       text,
  statements text[],
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260524180000',
  '20260524180000_consolidate_schema_reconciliation',
  ARRAY[]::text[]
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- FIN — Vérifier post-execution avec :
--   pnpm tsx scripts/migration-status-audit.ts
-- ============================================================================
