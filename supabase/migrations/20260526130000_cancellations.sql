-- ============================================
-- KOVAS — Cancellations workflow (décret n°2023-417 du 31 mai 2023)
-- ============================================
-- Le décret n°2023-417 impose, pour les contrats SaaS souscrits en ligne par
-- un consommateur ou un pro <10 salariés, une procédure de désabonnement
-- "aussi simple que la souscription" via un parcours dédié. Notre workflow
-- trace chaque étape (step1_seen_at, step2_seen_at) pour prouver la
-- traversée du parcours en cas de litige.
--
-- Le feedback_text de minimum 50 caractères (CHECK enforced côté DB) est
-- conforme à la pratique jurisprudentielle : on demande un motif détaillé
-- AVANT la confirmation, mais on n'empêche jamais la résiliation.
--
-- RLS : SELECT par user lui-même OU admin (toutes orgs)
--       INSERT par user lui-même
--       UPDATE = service_role only (worker win-back / Calendly callback)
-- ============================================

CREATE TABLE IF NOT EXISTS public.cancellations (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id                         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id                 uuid NOT NULL REFERENCES public.subscriptions(id),

  initiated_at                    timestamptz NOT NULL DEFAULT now(),

  -- Save attempts traversées (preuve décret 2023-417)
  step1_seen_at                   timestamptz,
  step2_seen_at                   timestamptz,
  step2_alternative_offered       text CHECK (step2_alternative_offered IN ('pause','discount','downgrade','none')),
  step2_alternative_accepted      boolean NOT NULL DEFAULT false,
  step2_pause_duration_months     int CHECK (step2_pause_duration_months IN (1,3)),
  step2_discount_percentage       int,
  step2_downgrade_to_plan_code    text,

  -- Feedback obligatoire (50 chars min côté DB en plus du contrôle UI)
  feedback_text                   text NOT NULL CHECK (length(trim(feedback_text)) >= 50),
  feedback_category               text NOT NULL CHECK (feedback_category IN (
    'too_expensive','missing_features','features_not_used','better_competitor','situation_change','other'
  )),

  -- Confirmation effective
  confirmed_at                    timestamptz,
  effective_end_date              date,

  -- Win-back (séquence email J+30)
  winback_email_sent_at           timestamptz,
  winback_code                    text UNIQUE,
  winback_code_expires_at         timestamptz,
  winback_code_used_at            timestamptz,
  reactivated_at                  timestamptz,
  reactivation_subscription_id    uuid REFERENCES public.subscriptions(id),

  -- Calendly (call rétention 15min proposé sur cas churn premium)
  calendly_link_shown_at          timestamptz,
  calendly_booked                 boolean NOT NULL DEFAULT false,
  calendly_call_at                timestamptz,

  -- Audit (traçabilité décret)
  ip_address                      inet,
  user_agent                      text,

  created_at                      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cancellations IS
  'Workflow désabonnement traçable conforme décret n°2023-417 du 31/05/2023. Chaque étape (step1, step2) est horodatée pour prouver le parcours. Le feedback_text >= 50 chars est demandé en sortie pour qualifier le motif (UX conforme : on demande, on ne bloque pas).';

COMMENT ON COLUMN public.cancellations.feedback_text IS
  'Motif détaillé obligatoire 50 caractères min (CHECK DB). Ce minimum vise à qualifier la raison de churn pour analytics, sans empêcher la résiliation (l''utilisateur ne peut PAS être bloqué côté UI s''il refuse de remplir : la spec impose feedback en sortie de parcours, jamais en blocage).';

CREATE INDEX IF NOT EXISTS idx_cancellations_user
  ON public.cancellations (user_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cancellations_org
  ON public.cancellations (organization_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cancellations_subscription
  ON public.cancellations (subscription_id);

CREATE INDEX IF NOT EXISTS idx_cancellations_winback_pending
  ON public.cancellations (winback_email_sent_at)
  WHERE confirmed_at IS NOT NULL AND winback_email_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cancellations_winback_code
  ON public.cancellations (winback_code)
  WHERE winback_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cancellations_confirmed
  ON public.cancellations (confirmed_at DESC)
  WHERE confirmed_at IS NOT NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cancellations: user read own" ON public.cancellations;
CREATE POLICY "cancellations: user read own"
  ON public.cancellations FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "cancellations: admin read all" ON public.cancellations;
CREATE POLICY "cancellations: admin read all"
  ON public.cancellations FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "cancellations: user insert own" ON public.cancellations;
CREATE POLICY "cancellations: user insert own"
  ON public.cancellations FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_member_of(organization_id)
  );

-- UPDATE : service_role uniquement (workers winback / Calendly). Pas de policy
-- USING/WITH CHECK : avec RLS activée et aucune policy UPDATE, seul service_role
-- (qui bypass RLS) peut updater. Les users ne peuvent pas modifier leur feedback
-- après envoi (immuabilité partielle).
