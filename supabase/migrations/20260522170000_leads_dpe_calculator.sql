-- ============================================
-- KOVAS — Lead source: DPE calculator (Lot #143)
-- Date : 2026-05-22
-- Mission : permettre l'enregistrement de leads issus de la page publique
--           `/calculateur-dpe-gratuit` qui n'a PAS de fiche diagnostiqueur
--           source (parcours B2C SEO). On rend diagnostician_id nullable
--           (la dispatch route s'en occupe via routing géographique) et on
--           stocke l'estimation client-side pour audit + scoring.
-- ============================================

-- 1. Rendre diagnostician_id nullable (lead sans fiche source possible)
ALTER TABLE public.quote_requests
  ALTER COLUMN diagnostician_id DROP NOT NULL;

COMMENT ON COLUMN public.quote_requests.diagnostician_id IS
  'Diag d''origine si lead créé via fiche publique. NULL si lead créé via calculateur DPE / formulaire global — dans ce cas, dispatchRecipients sélectionne les diag par géoloc seule.';

-- 2. Source du lead (fiche / calculateur / formulaire global / etc.)
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'diagnostician_page';

-- CHECK idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_source_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_source_check
      CHECK (source IN (
        'diagnostician_page',
        'dpe_calculator',
        'global_form',
        'partner',
        'admin'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.quote_requests.source IS
  'Origine du lead : diagnostician_page (fiche pro) | dpe_calculator (page SEO B2C) | global_form (form principal) | partner | admin.';

-- 3. Classe DPE estimée (calculateur uniquement)
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS estimated_class text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_estimated_class_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests
      ADD CONSTRAINT quote_requests_estimated_class_check
      CHECK (estimated_class IS NULL OR estimated_class IN ('A','B','C','D','E','F','G'));
  END IF;
END $$;

COMMENT ON COLUMN public.quote_requests.estimated_class IS
  'Classe DPE estimée côté client par le calculateur public (indicative, non opposable). NULL si source ≠ dpe_calculator.';

-- 4. Détails du calcul (réponses brutes + facteurs)
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS factors_json jsonb;

COMMENT ON COLUMN public.quote_requests.factors_json IS
  'Détail du calcul calculateur DPE : { answers: {...8 questions}, score: number, confidence: number, positive: [], negative: [] }. Utilisé pour audit + amélioration algo.';

-- 5. Index source pour analytics / dashboard admin
CREATE INDEX IF NOT EXISTS idx_quote_requests_source
  ON public.quote_requests (source, created_at DESC);

-- 6. Mettre à jour la vue `leads` pour exposer les nouvelles colonnes
-- DROP préalable car CREATE OR REPLACE refuse les renames/reorders de colonnes
DROP VIEW IF EXISTS public.leads CASCADE;
CREATE VIEW public.leads AS
SELECT
  id,
  created_at,
  updated_at,
  diagnostician_id,
  -- source (Lot #143 calculator)
  source,
  estimated_class,
  factors_json,
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
  'Alias propre de quote_requests. Inclut source / estimated_class / factors_json (Lot #143 calculateur DPE).';
