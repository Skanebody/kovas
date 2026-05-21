-- ============================================
-- KOVAS — Launch offer subscriptions (30 premiers users -30%)
-- ============================================
-- Offre de lancement : -30% à vie pour les 30 premiers payants (positions
-- numérotées 1 à 30). Engagement annuel obligatoire pour bénéficier de l'offre.
--
-- La vue publique `launch_offer_status` est accessible sans auth (anon role)
-- pour alimenter le compteur landing "12 places restantes / 30".
--
-- RLS : SELECT public (via vue) ; INSERT/UPDATE = service_role only (workflow signup)
-- ============================================

CREATE TABLE IF NOT EXISTS public.launch_offer_subscriptions (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id                         uuid NOT NULL REFERENCES auth.users(id),
  subscription_id                 uuid NOT NULL REFERENCES public.subscriptions(id),

  position_number                 int NOT NULL UNIQUE CHECK (position_number BETWEEN 1 AND 30),

  discount_percentage             int NOT NULL DEFAULT 30,
  discount_starts_at              date NOT NULL,
  discount_ends_at                date NOT NULL,  -- 12 mois après starts_at typiquement

  original_monthly_price_cents    int NOT NULL,
  discounted_monthly_price_cents  int NOT NULL,

  -- Engagement annuel obligatoire pour cette offre
  annual_commitment               boolean NOT NULL DEFAULT true,
  stripe_coupon_id                text NOT NULL DEFAULT 'LAUNCH_30_FIRST30',

  created_at                      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.launch_offer_subscriptions IS
  'Offre de lancement -30% à vie pour les 30 premiers payants (positions 1..30). Engagement annuel obligatoire (annual_commitment=true). Stripe coupon LAUNCH_30_FIRST30 appliqué sur le checkout.';

CREATE INDEX IF NOT EXISTS idx_launch_position
  ON public.launch_offer_subscriptions (position_number);

CREATE INDEX IF NOT EXISTS idx_launch_user
  ON public.launch_offer_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_launch_subscription
  ON public.launch_offer_subscriptions (subscription_id);

-- ============================================
-- Vue publique : compteur places restantes (anon + authenticated)
-- ============================================
CREATE OR REPLACE VIEW public.launch_offer_status
WITH (security_invoker = true)
AS
SELECT
  COUNT(*)::int                                    AS positions_taken,
  GREATEST(0, 30 - COUNT(*)::int)                  AS positions_remaining,
  CASE WHEN COUNT(*) >= 30 THEN false ELSE true END AS is_available
FROM public.launch_offer_subscriptions;

COMMENT ON VIEW public.launch_offer_status IS
  'Vue agrégée publique : nombre de places prises / restantes sur l''offre de lancement -30%. Accessible anon pour le compteur landing.';

GRANT SELECT ON public.launch_offer_status TO anon, authenticated;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.launch_offer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "launch_offer: org members read own" ON public.launch_offer_subscriptions;
CREATE POLICY "launch_offer: org members read own"
  ON public.launch_offer_subscriptions FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "launch_offer: admin read all" ON public.launch_offer_subscriptions;
CREATE POLICY "launch_offer: admin read all"
  ON public.launch_offer_subscriptions FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- INSERT/UPDATE/DELETE = service_role only (workflow signup vérifie position dispo
-- via SELECT count + INSERT en transaction sérialisée).
