-- ============================================
-- KOVAS — Module trials (essai gratuit 14j par module add-on)
-- ============================================
-- Workflow :
--   1. User active un module add-on en mode trial 14j (sans CB)
--   2. Reminders push/email J+1 / J-5 / J-2 envoyés par worker
--   3. À J14 : user_decision = 'keep' (CB demandée -> user_addons) ou 'cancel'
--   4. Si pas de décision : status='expired', accès coupé
--
-- Dépendances :
--   - organizations, auth.users, subscriptions (existantes)
--   - addon_modules, user_addons (créées par autre agent 20260526101000/102000)
--
-- RLS : SELECT/INSERT par membres de l'org ; UPDATE par user lui-même ou service_role
-- ============================================

CREATE TABLE IF NOT EXISTS public.module_trials (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id                         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id                       uuid NOT NULL REFERENCES public.addon_modules(id),
  subscription_id                 uuid NOT NULL REFERENCES public.subscriptions(id),

  trial_started_at                timestamptz NOT NULL DEFAULT now(),
  trial_ends_at                   timestamptz NOT NULL,
  trial_duration_days             int NOT NULL DEFAULT 14,

  status                          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','converted_to_paid','cancelled_before_payment','expired')),

  -- Notifications envoyées (timestamps idempotents)
  reminder_j1_sent_at             timestamptz,
  reminder_j_minus_5_sent_at      timestamptz,
  reminder_j_minus_2_sent_at      timestamptz,

  -- Décision utilisateur
  user_decision                   text CHECK (user_decision IN ('keep','cancel')),
  user_decision_at                timestamptz,
  user_cancel_reason              text,

  -- Si converti vers paid
  converted_to_addon_id           uuid REFERENCES public.user_addons(id),
  first_payment_at                timestamptz,
  first_payment_amount_cents      int,

  created_at                      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.module_trials IS
  'Essais gratuits 14j par module add-on. Un module ne peut être en trial actif qu''une seule fois par organisation (cf. unique index partial).';

-- Anti-doublons : un module ne peut être en trial actif qu'une fois par org
CREATE UNIQUE INDEX IF NOT EXISTS uniq_module_trials_active_per_org
  ON public.module_trials (organization_id, module_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_module_trials_active
  ON public.module_trials (organization_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_module_trials_ending
  ON public.module_trials (trial_ends_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_module_trials_user
  ON public.module_trials (user_id, trial_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_trials_subscription
  ON public.module_trials (subscription_id);

CREATE INDEX IF NOT EXISTS idx_module_trials_module
  ON public.module_trials (module_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.module_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_trials: org members read" ON public.module_trials;
CREATE POLICY "module_trials: org members read"
  ON public.module_trials FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "module_trials: org members insert" ON public.module_trials;
CREATE POLICY "module_trials: org members insert"
  ON public.module_trials FOR INSERT
  WITH CHECK (
    public.is_member_of(organization_id)
    AND user_id = (SELECT auth.uid())
  );

-- UPDATE : user peut annuler son propre trial (user_decision='cancel') ; service_role bypass
DROP POLICY IF EXISTS "module_trials: user can cancel own" ON public.module_trials;
CREATE POLICY "module_trials: user can cancel own"
  ON public.module_trials FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
