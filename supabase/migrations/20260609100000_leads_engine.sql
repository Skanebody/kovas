-- ============================================
-- KOVAS Annuaire — Leads Engine (Phase E1)
-- Date : 2026-06-09
-- Mission : enrichir `quote_requests` avec les colonnes routing/OTP/closure,
--           créer la table `lead_assignments` (N:N lead ↔ diagnostiqueur),
--           exposer une vue `leads` alias propre, et la fonction d'expiration
--           des assignations en pending au-delà de 48h.
--
-- Multi-envoi first-come-first-served : un lead B2C peut être envoyé à 5 diag
-- simultanément (mix 2-3 premium + 2-3 basic). Le 1er à accepter "gagne",
-- les autres voient leur assignment passer en 'expired' lors du close.
--
-- Source de vérité : table `quote_requests` (legacy, créée par migration
-- 20260530130000_quote_requests_b2c.sql). On enrichit en place plutôt que
-- de renommer (impact RLS + code routes existants trop élevé). La vue
-- `leads` sert d'alias canonique pour les nouveaux usages.
--
-- Sociétés / produits :
--   - SASU NEXUS 1993 (éditrice)
--   - KOVAS Annuaire (B2C, gratuit) — origine des leads
--   - KOVAS 360 (B2B SaaS payant) — bénéficiaires subscribed
-- ============================================

-- ============================================
-- A. Enrichissement quote_requests — colonnes routing
-- ============================================

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS routed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS routing_strategy  text,
  ADD COLUMN IF NOT EXISTS routing_metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS otp_verified_at   timestamptz,
  ADD COLUMN IF NOT EXISTS otp_attempts      int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_count  int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS close_reason      text;

-- CHECK contraints idempotentes (wrappées DO $$)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_routing_strategy_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_routing_strategy_check
      CHECK (routing_strategy IS NULL OR routing_strategy IN (
        'subscribed_nearby',
        'claimed_non_subscribed',
        'onboarding_gift',
        'manual',
        'none'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_close_reason_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_close_reason_check
      CHECK (close_reason IS NULL OR close_reason IN (
        'accepted',
        'expired',
        'cancelled_by_user',
        'spam'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.quote_requests.routed_at IS
  'Timestamp du 1er envoi à un ou plusieurs diagnostiqueurs (route-lead).';
COMMENT ON COLUMN public.quote_requests.routing_strategy IS
  'Stratégie de routage retenue : subscribed_nearby | claimed_non_subscribed | onboarding_gift | manual | none.';
COMMENT ON COLUMN public.quote_requests.routing_metadata IS
  'Métadonnées d''audit : { candidates_count, top_score, geo_radius_km, certification_type }.';
COMMENT ON COLUMN public.quote_requests.otp_verified_at IS
  'Phase E3 — timestamp validation OTP du demandeur (anti-spam K1).';
COMMENT ON COLUMN public.quote_requests.otp_attempts IS
  'Phase E3 — nombre de tentatives OTP (rate limit).';
COMMENT ON COLUMN public.quote_requests.acceptance_count IS
  'Nb de diagnostiqueurs ayant accepté ce lead (1er en first-come, mais on garde la trace).';
COMMENT ON COLUMN public.quote_requests.closed_at IS
  'Timestamp de fermeture définitive du lead (accepté définitif OU expiré 48h).';
COMMENT ON COLUMN public.quote_requests.close_reason IS
  'Motif de fermeture : accepted | expired | cancelled_by_user | spam.';

-- ============================================
-- B. Index supplémentaires
-- ============================================

CREATE INDEX IF NOT EXISTS idx_qr_routing
  ON public.quote_requests (routing_strategy, routed_at DESC)
  WHERE routed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qr_open
  ON public.quote_requests (closed_at)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_qr_otp
  ON public.quote_requests (otp_verified_at)
  WHERE otp_verified_at IS NOT NULL;

-- ============================================
-- C. Table lead_assignments — N:N lead ↔ diagnosticien
-- ============================================
-- Multi-envoi : 1 lead peut viser jusqu'à 5 diag simultanément.
-- L'unicité (lead_id, diagnostician_id) garantit qu'un diag ne reçoit
-- jamais le même lead 2 fois (anti-doublon notif).

CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  diagnostician_id     uuid NOT NULL REFERENCES public.diagnosticians(id) ON DELETE CASCADE,

  assignment_type      text NOT NULL CHECK (assignment_type IN (
    'subscribed',
    'claimed_non_subscribed',
    'onboarding_gift'
  )),

  notified_at          timestamptz NOT NULL DEFAULT now(),
  notification_method  text DEFAULT 'email'
    CHECK (notification_method IN ('email', 'sms', 'push', 'none')),

  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  responded_at         timestamptz,
  decline_reason       text,

  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),

  score                numeric,
  distance_km          numeric,

  created_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (lead_id, diagnostician_id)
);

COMMENT ON TABLE public.lead_assignments IS
  'N:N lead ↔ diagnosticien — multi-envoi first-come-first-served. Un diag ne peut recevoir un lead qu''une fois (UNIQUE).';
COMMENT ON COLUMN public.lead_assignments.assignment_type IS
  'Catégorie de routing : subscribed (KOVAS 360 actif) | claimed_non_subscribed (upsell cible) | onboarding_gift (ghost à activer).';
COMMENT ON COLUMN public.lead_assignments.score IS
  'activity_score du diag au moment de l''assignment (snapshot).';
COMMENT ON COLUMN public.lead_assignments.distance_km IS
  'Distance au lead au moment de l''assignment (snapshot).';
COMMENT ON COLUMN public.lead_assignments.expires_at IS
  'Date d''expiration (defaut notified_at + 48h). Au-delà : status passe à expired via expire_pending_lead_assignments().';

-- Index
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_status
  ON public.lead_assignments (lead_id, status);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_diag_status
  ON public.lead_assignments (diagnostician_id, status, notified_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_pending_expires
  ON public.lead_assignments (expires_at)
  WHERE status = 'pending';

-- ============================================
-- D. RLS lead_assignments
-- ============================================
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- Le diagnostiqueur ayant réclamé sa fiche voit ses propres assignments
DROP POLICY IF EXISTS "lead_assignments_diag_read" ON public.lead_assignments;
CREATE POLICY "lead_assignments_diag_read"
  ON public.lead_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = lead_assignments.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- Le diag peut UPDATE son status (accept / decline) sur ses propres assignments
DROP POLICY IF EXISTS "lead_assignments_diag_update" ON public.lead_assignments;
CREATE POLICY "lead_assignments_diag_update"
  ON public.lead_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = lead_assignments.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.diagnosticians d
      WHERE d.id = lead_assignments.diagnostician_id
        AND d.claimed_by_user_id = auth.uid()
    )
  );

-- service_role : full access (Edge Functions route-lead, expire job, etc.)
DROP POLICY IF EXISTS "lead_assignments_service_all" ON public.lead_assignments;
CREATE POLICY "lead_assignments_service_all"
  ON public.lead_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- E. Vue `leads` — alias propre de quote_requests
-- ============================================
-- Adapte la liste de colonnes au schéma RÉEL de quote_requests
-- (voir 20260530130000_quote_requests_b2c.sql).
CREATE OR REPLACE VIEW public.leads AS
SELECT
  id,
  created_at,
  updated_at,
  diagnostician_id,
  -- contact requester
  requester_first_name,
  requester_last_name,
  requester_email,
  requester_phone,
  -- bien
  property_type,
  property_situation,
  property_address,
  property_postal_code,
  property_city,
  property_surface_m2,
  property_year_built,
  property_geo_lat,
  property_geo_lng,
  -- mission
  diagnostics_requested,
  diagnostics_suggested,
  message,
  status,
  -- diag notif (legacy single-diag)
  diag_notified_at,
  diag_responded_at,
  -- anti-spam
  ip_address,
  user_agent,
  honeypot_filled,
  recaptcha_score,
  -- routing (E1)
  routed_at,
  routing_strategy,
  routing_metadata,
  otp_verified_at,
  otp_attempts,
  acceptance_count,
  closed_at,
  close_reason
FROM public.quote_requests;

COMMENT ON VIEW public.leads IS
  'Alias propre de quote_requests. Le code applicatif (Edge Functions, dashboard) référence `leads`, le schéma legacy garde le nom historique pour éviter une migration cassante des routes existantes.';

-- ============================================
-- F. Fonction expire_pending_lead_assignments
-- ============================================
-- À appeler par cron (toutes les heures) :
--   SELECT public.expire_pending_lead_assignments();
-- Renvoie le nombre d'assignments mis à jour.

CREATE OR REPLACE FUNCTION public.expire_pending_lead_assignments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- 1. Passer en expired toutes les assignations pending dont expires_at est dépassé
  UPDATE public.lead_assignments
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 2. Auto-close les leads dont toutes les assignations sont expirées
  --    (et aucune accepted) — évite de garder des leads "orphelins" ouverts.
  UPDATE public.quote_requests qr
  SET closed_at    = now(),
      close_reason = 'expired'
  WHERE qr.closed_at IS NULL
    AND qr.routed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.lead_assignments la
      WHERE la.lead_id = qr.id
        AND la.status IN ('pending', 'accepted')
    );

  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.expire_pending_lead_assignments() IS
  'Cron-friendly : passe les lead_assignments pending expirés en expired et auto-ferme les leads orphelins (close_reason=expired). Renvoie le nb d''assignments mis à jour.';

GRANT EXECUTE ON FUNCTION public.expire_pending_lead_assignments() TO service_role;

-- ============================================
-- G. Trigger : sync acceptance_count quand un assignment passe à accepted
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_lead_acceptance_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.quote_requests
    SET acceptance_count = acceptance_count + 1
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_assignments_acceptance ON public.lead_assignments;
CREATE TRIGGER trg_lead_assignments_acceptance
  AFTER UPDATE OF status ON public.lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_acceptance_count();

COMMENT ON FUNCTION public.sync_lead_acceptance_count() IS
  'Trigger incrément acceptance_count sur quote_requests à chaque transition status→accepted.';
