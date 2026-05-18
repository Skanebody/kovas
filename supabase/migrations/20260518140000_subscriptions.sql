-- ============================================
-- KOVAS — Subscriptions table (Stripe sync)
-- Cf. CLAUDE.md §4 — 3 tiers Phase 1 (Découverte 29€ / Standard 59€ / Volume 99€)
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_customer_id  text UNIQUE,
  stripe_subscription_id text UNIQUE,
  status              text NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | canceled | unpaid
  tier                text, -- 'discovery' | 'standard' | 'volume'
  missions_included   int, -- 20 / 60 / 150
  overage_price_cents int, -- 200 / 150 / 100
  current_period_start timestamptz,
  current_period_end  timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  monthly_cap_eur     numeric(10,2), -- Plafond mensuel auto-protecteur (cf. CLAUDE.md §5)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (organization_id, status);

-- RLS : lecture pour les membres de l'org
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: org members read" ON subscriptions;
CREATE POLICY "subscriptions: org members read"
  ON subscriptions FOR SELECT
  USING (public.is_member_of(organization_id));

-- INSERT/UPDATE/DELETE seulement via service_role (webhook Stripe)

-- Compteur mensuel de missions (pour widget transparence)
-- View matérialisée : missions count + overage par mois
CREATE OR REPLACE VIEW monthly_mission_counts AS
SELECT
  organization_id,
  date_trunc('month', created_at)::date AS month,
  COUNT(*)::int AS missions_count
FROM missions
WHERE deleted_at IS NULL
GROUP BY organization_id, date_trunc('month', created_at);

-- Trigger : update updated_at sur subscriptions
CREATE OR REPLACE FUNCTION public.subscriptions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at_trg ON subscriptions;
CREATE TRIGGER subscriptions_set_updated_at_trg
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();
