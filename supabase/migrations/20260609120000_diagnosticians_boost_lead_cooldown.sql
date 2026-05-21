-- ============================================
-- KOVAS Annuaire — Cooldown boost-onboarding-lead
-- Date : 2026-06-09
-- Mission : ajouter colonne last_boost_lead_sent_at sur diagnosticians
--           pour permettre au cron weekly boost-onboarding-lead
--           de respecter un délai de 60 jours minimum entre 2 leads
--           cadeau envoyés au même diagnostiqueur ghost/pending.
-- ============================================

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS last_boost_lead_sent_at timestamptz;

-- Index partiel : utilisé par boost-onboarding-lead pour filtrer rapidement
-- les diag éligibles (claim_status='unclaimed' AND cooldown atteint).
CREATE INDEX IF NOT EXISTS idx_diag_boost_cooldown
  ON diagnosticians (last_boost_lead_sent_at)
  WHERE claim_status = 'unclaimed';

COMMENT ON COLUMN diagnosticians.last_boost_lead_sent_at IS
  'Timestamp du dernier lead synthétique envoyé via boost-onboarding-lead (cooldown 60j).';
