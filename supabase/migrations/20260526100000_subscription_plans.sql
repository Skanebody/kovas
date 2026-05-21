-- ============================================
-- KOVAS — subscription_plans (table de DÉFINITION canonique des 5 forfaits)
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4 (post-pivot tarifaire mai 2026)
--
-- Cette table contient la définition canonique des 5 forfaits KOVAS V1 :
--   essential (9€) / decouverte (19€) / pro (35€) / all_inclusive (49€) / cabinet (89€)
--
-- Modifiable par les admins uniquement, lisible par tous (publique pour la
-- page /pricing et le widget de tarification in-app).
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code                         text NOT NULL UNIQUE
    CHECK (plan_code IN ('essential','decouverte','pro','all_inclusive','cabinet')),
  display_name                      text NOT NULL,
  description                       text,

  -- Pricing (centimes integer — convention CLAUDE.md §10)
  price_monthly_cents               int NOT NULL,
  price_annual_cents                int NOT NULL, -- 10 mois sur 12 (2 mois offerts)
  stripe_product_id                 text,
  stripe_price_monthly_id           text,
  stripe_price_annual_id            text,

  -- Quotas
  missions_quota                    int NOT NULL,           -- -1 = illimité
  storage_gb                        int NOT NULL,
  users_included                    int NOT NULL DEFAULT 1,
  extra_user_price_cents            int,                    -- ex Cabinet : 1900 (+19€/user)
  max_users                         int,                    -- ex Cabinet : 10
  chatbot_messages_quota            int NOT NULL,
  yousign_signatures_quota          int NOT NULL DEFAULT 0,
  geocoding_requests_quota          int NOT NULL DEFAULT 0,

  -- Overflow pricing (centimes)
  overage_mission_price_cents       int NOT NULL DEFAULT 200,  -- 2,00 €/mission
  overage_chatbot_price_cents       int NOT NULL DEFAULT 5,    -- 0,05 €/message
  overage_signature_price_cents     int NOT NULL DEFAULT 50,   -- 0,50 €/signature
  overage_geocoding_price_cents     int NOT NULL DEFAULT 1,    -- 0,005 € arrondi sup → 1 centime
  overage_storage_price_cents_per_gb int NOT NULL DEFAULT 10,  -- 0,10 €/Go/mois

  -- Feature flags pour gating UI (clés bool/int/string)
  features                          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Métadonnées affichage
  is_active                         boolean NOT NULL DEFAULT true,
  is_featured                       boolean NOT NULL DEFAULT false,
  sort_order                        int NOT NULL DEFAULT 0,

  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code
  ON subscription_plans (plan_code)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort
  ON subscription_plans (sort_order, plan_code)
  WHERE is_active = true;

COMMENT ON TABLE subscription_plans IS
  'Définition canonique des 5 forfaits KOVAS V1. Lecture publique, écriture admin only.';
COMMENT ON COLUMN subscription_plans.missions_quota IS
  'Quota mensuel de missions. -1 = illimité (All Inclusive / Cabinet).';
COMMENT ON COLUMN subscription_plans.features IS
  'Feature flags JSONB pour gating UI. Ex : { "cockpit_ademe_mode1": true }.';
COMMENT ON COLUMN subscription_plans.price_annual_cents IS
  '10 × price_monthly_cents (2 mois offerts).';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.subscription_plans_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS subscription_plans_set_updated_at_trg ON subscription_plans;
CREATE TRIGGER subscription_plans_set_updated_at_trg
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.subscription_plans_set_updated_at();

-- RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Lecture publique (page /pricing, widget tarification in-app)
DROP POLICY IF EXISTS "subscription_plans: public read" ON subscription_plans;
CREATE POLICY "subscription_plans: public read"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Écriture : admins uniquement (cf. public.is_admin)
DROP POLICY IF EXISTS "subscription_plans: admin insert" ON subscription_plans;
CREATE POLICY "subscription_plans: admin insert"
  ON subscription_plans FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "subscription_plans: admin update" ON subscription_plans;
CREATE POLICY "subscription_plans: admin update"
  ON subscription_plans FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "subscription_plans: admin delete" ON subscription_plans;
CREATE POLICY "subscription_plans: admin delete"
  ON subscription_plans FOR DELETE
  USING (public.is_admin(auth.uid()));
