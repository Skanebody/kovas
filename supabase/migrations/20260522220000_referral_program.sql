-- ============================================
-- KOVAS — Programme de parrainage
-- Cf. CLAUDE.md §21bis Gain Tracker + Lot #150 PARRAINAGE-GAMIFICATION
--
-- Objectif business : coefficient viral K = 1,3 M6 → 1,5 M12.
-- Mécanique :
--   - 1 code unique 8 chars par user (format KOV-A4F2G)
--   - Filleul -> 1 mois offert (via Stripe coupon ou crédit applicatif)
--   - Parrain -> 50€ crédits applicables sur factures suivantes
--   - Limite anti-abus : 12 récompenses payantes / 12 mois glissants / parrain
-- ============================================

-- ============================================
-- referral_codes : 1 code unique par diagnostiqueur
-- ============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE CHECK (code ~ '^KOV-[A-Z2-9]{5}$'),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code_active ON referral_codes (code) WHERE active = true;

-- ============================================
-- referrals : 1 ligne par filleul tracé
-- Status progression :
--   pending        = filleul a cliqué le lien mais pas inscrit
--   subscribed     = filleul a créé un compte avec ce code
--   paid_invoice_1 = filleul a payé sa 1re facture (post trial)
--   rewarded       = crédit attribué au parrain
--   cancelled      = filleul a churn avant trial+1 mois ou code invalide
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code           text NOT NULL REFERENCES referral_codes(code),
  status                  text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','subscribed','paid_invoice_1','rewarded','cancelled')),
  signed_up_at            timestamptz,
  first_invoice_paid_at   timestamptz,
  rewarded_at             timestamptz,
  reward_eur_cents        int,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referred_id),
  UNIQUE (referred_id) -- 1 user ne peut être parrainé qu'une seule fois
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals (referral_code);

-- ============================================
-- user_credits : solde des crédits applicatifs (50€/filleul payant)
-- Affiché en bannière + déduit automatiquement des factures Stripe
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
  user_id                 uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_eur_cents       int NOT NULL DEFAULT 0,
  total_earned_eur_cents  int NOT NULL DEFAULT 0,
  total_spent_eur_cents   int NOT NULL DEFAULT 0,
  last_updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (balance_eur_cents >= 0),
  CHECK (total_earned_eur_cents >= 0),
  CHECK (total_spent_eur_cents >= 0)
);

-- ============================================
-- credit_transactions : journal d'écritures (audit + analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type              text NOT NULL CHECK (type IN ('referral_reward','invoice_deduction','manual_adjustment')),
  amount_eur_cents  int NOT NULL, -- + (gain) ou - (dépense)
  description       text NOT NULL,
  reference_id      uuid, -- referral_id ou invoice_id selon type
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_ref ON credit_transactions (reference_id);

-- ============================================
-- RLS — lecture par le propriétaire uniquement
-- Écritures via service_role (server actions / webhook)
-- ============================================

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- referral_codes : lecture par owner + lookup public du code (server-side uniquement)
DROP POLICY IF EXISTS "referral_codes: owner read" ON referral_codes;
CREATE POLICY "referral_codes: owner read"
  ON referral_codes FOR SELECT
  USING (user_id = auth.uid());

-- referrals : un parrain voit ses filleuls, un filleul voit sa ligne
DROP POLICY IF EXISTS "referrals: participant read" ON referrals;
CREATE POLICY "referrals: participant read"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- user_credits : owner only
DROP POLICY IF EXISTS "user_credits: owner read" ON user_credits;
CREATE POLICY "user_credits: owner read"
  ON user_credits FOR SELECT
  USING (user_id = auth.uid());

-- credit_transactions : owner only
DROP POLICY IF EXISTS "credit_transactions: owner read" ON credit_transactions;
CREATE POLICY "credit_transactions: owner read"
  ON credit_transactions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- Helper : génération d'un code unique côté DB (fallback si jamais collision)
-- L'algo principal est en TypeScript (apps/web/src/lib/referral/code-generator.ts)
-- pour permettre de tester en pure prévisualisation côté client.
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
  rnd      int;
BEGIN
  FOR i IN 1..5 LOOP
    rnd := 1 + floor(random() * length(alphabet))::int;
    result := result || substr(alphabet, rnd, 1);
  END LOOP;
  RETURN 'KOV-' || result;
END;
$$;

-- ============================================
-- View parrain : agrégats lisibles (compteurs, gains, statuts)
-- ============================================
CREATE OR REPLACE VIEW referral_stats_per_user AS
SELECT
  rc.user_id,
  rc.code,
  rc.active,
  COUNT(r.id) FILTER (WHERE r.id IS NOT NULL)::int AS total_referred,
  COUNT(r.id) FILTER (WHERE r.status IN ('subscribed','paid_invoice_1','rewarded'))::int AS total_subscribed,
  COUNT(r.id) FILTER (WHERE r.status IN ('paid_invoice_1','rewarded'))::int AS total_paid,
  COUNT(r.id) FILTER (WHERE r.status = 'rewarded')::int AS total_rewarded,
  COALESCE(SUM(r.reward_eur_cents) FILTER (WHERE r.status = 'rewarded'), 0)::int AS total_earned_eur_cents
FROM referral_codes rc
LEFT JOIN referrals r ON r.referrer_id = rc.user_id
GROUP BY rc.user_id, rc.code, rc.active;

COMMENT ON TABLE referral_codes IS 'Codes uniques de parrainage (1 par diagnostiqueur). Format KOV-XXXXX, alphabet sans ambiguïtés (0/O/I/1 exclus).';
COMMENT ON TABLE referrals IS 'Suivi des filleuls et progression de statut (pending → subscribed → paid_invoice_1 → rewarded).';
COMMENT ON TABLE user_credits IS 'Solde de crédits applicatifs par utilisateur (gagnés via parrainage, dépensés sur factures).';
COMMENT ON TABLE credit_transactions IS 'Journal d''écritures des crédits (audit + analytics).';
