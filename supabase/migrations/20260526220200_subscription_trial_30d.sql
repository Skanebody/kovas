-- ============================================
-- KOVAS — Essai gratuit 30 jours AVEC CB (modèle Qonto/Linear/ManyChat)
-- Cf. CLAUDE.md §6 (refonte 2026-05-22)
--
-- Le diagnostiqueur saisit sa CB dès l'inscription via Stripe Setup Intent
-- (validation, pas de débit). trial_period_days=30 sur la subscription Stripe.
-- À J+30 le débit est automatique sans confirmation supplémentaire.
-- ============================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz;

-- Colonne générée : true tant que l'essai n'est pas terminé.
-- Si Stripe convertit trialing → active à J+30, trial_ends_at reste figé dans le passé
-- et is_in_trial bascule automatiquement à false.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'subscriptions'
      AND column_name  = 'is_in_trial'
  ) THEN
    ALTER TABLE subscriptions
      ADD COLUMN is_in_trial boolean
        GENERATED ALWAYS AS (trial_ends_at IS NOT NULL AND trial_ends_at > NOW()) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_ends_at
  ON subscriptions (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

COMMENT ON COLUMN subscriptions.trial_started_at IS 'Date début essai 30j — alimentée par webhook customer.subscription.created';
COMMENT ON COLUMN subscriptions.trial_ends_at   IS 'Date fin essai 30j (= début débit auto) — alimentée par webhook';
COMMENT ON COLUMN subscriptions.is_in_trial     IS 'TRUE pendant les 30j d''essai, FALSE après conversion automatique';
