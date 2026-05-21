-- ============================================
-- KOVAS — Migration subscriptions vers la nouvelle structure tarifaire
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4 (post-pivot tarifaire mai 2026)
--
-- Cette migration :
--   1. Élargit le CHECK tier pour accepter les 5 nouveaux codes + les anciens en
--      *_legacy (traçabilité audit).
--   2. Renomme les valeurs existantes vers les codes *_legacy. En V1 pré-launch
--      (date courante 2026-05-20), aucun client payant n'est encore en base : la
--      migration est sûre. Les bêta-testeurs seront migrés manuellement vers
--      'pro' ou 'all_inclusive' lors du déploiement (séparé).
--   3. Ajoute les colonnes manquantes pour gérer trial / pause / cabinet
--      multi-users / billing annuel.
--   4. Crée les index nécessaires aux workers de cycle de vie.
-- ============================================

-- Étape 1 — Migrer les valeurs existantes vers *_legacy AVANT de changer le CHECK.
-- Note : ancien CHECK = ('discovery','standard','volume') d'après la migration
-- d'origine + colonne organizations.plan qui peut contenir 'decouverte' / 'founder'.
-- On élargit d'abord en supprimant le CHECK, puis on rename.

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

-- Map des anciens codes vers *_legacy (idempotent — IF gardé pour la sécurité)
UPDATE public.subscriptions SET tier = 'decouverte_legacy' WHERE tier = 'discovery';
UPDATE public.subscriptions SET tier = 'standard_legacy'   WHERE tier = 'standard';
UPDATE public.subscriptions SET tier = 'volume_legacy'     WHERE tier = 'volume';
UPDATE public.subscriptions SET tier = 'founder_legacy'    WHERE tier = 'founder';
-- Compatibilité avec un ancien 'decouverte' éventuel (FR) :
UPDATE public.subscriptions SET tier = 'decouverte_legacy' WHERE tier = 'decouverte';

-- Étape 2 — Nouveau CHECK contenant les 5 codes V1 + les 4 codes *_legacy.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN (
    'essential','decouverte','pro','all_inclusive','cabinet',
    'decouverte_legacy','standard_legacy','volume_legacy','founder_legacy'
  ));

-- Étape 3 — Colonnes additionnelles pour le nouveau modèle.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_code               text REFERENCES public.subscription_plans(plan_code),
  ADD COLUMN IF NOT EXISTS trial_end_at            timestamptz,
  ADD COLUMN IF NOT EXISTS trial_card_setup_intent_id text,
  ADD COLUMN IF NOT EXISTS cancel_reason           text,
  ADD COLUMN IF NOT EXISTS cancel_feedback         text,
  ADD COLUMN IF NOT EXISTS pause_started_at        timestamptz,
  ADD COLUMN IF NOT EXISTS pause_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS launch_offer_id         uuid,
  ADD COLUMN IF NOT EXISTS extra_users_count       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_period          text NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly','annual'));

-- Étape 4 — Index pour les workers de cycle de vie (trial reminders, pause,
-- renewals, dunning).
CREATE INDEX IF NOT EXISTS idx_subs_status_period_end
  ON public.subscriptions (status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_subs_trial_end
  ON public.subscriptions (trial_end_at)
  WHERE status = 'trialing';

CREATE INDEX IF NOT EXISTS idx_subs_pause_end
  ON public.subscriptions (pause_ends_at)
  WHERE pause_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subs_plan_code
  ON public.subscriptions (plan_code, status);

-- Étape 5 — Commentaires documentation.
COMMENT ON COLUMN public.subscriptions.tier IS
  'DEPRECATED legacy. Utiliser plan_code à la place. Conservé pour compat ascendante migration.';
COMMENT ON COLUMN public.subscriptions.plan_code IS
  'FK vers subscription_plans.plan_code (canonical). Source de vérité du forfait actif.';
COMMENT ON COLUMN public.subscriptions.billing_period IS
  'monthly | annual (annuel = 2 mois offerts, facturation sur 10 mois).';
COMMENT ON COLUMN public.subscriptions.extra_users_count IS
  'Cabinet uniquement : nombre d''utilisateurs supplémentaires facturés à +19€/user (max 10 - 3 inclus = 7).';
COMMENT ON COLUMN public.subscriptions.trial_card_setup_intent_id IS
  'Stripe SetupIntent ID associé à la CB enregistrée pendant l''essai (cf. CLAUDE.md §5 anti-friction).';
COMMENT ON COLUMN public.subscriptions.launch_offer_id IS
  'FK optionnelle vers une offre de lancement (founder à vie etc.). Schéma launch_offers défini ailleurs.';
