-- ============================================
-- KOVAS — user_addons (modules souscrits par organisation)
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4
--
-- Table d'association org × module avec gestion du cycle de vie (trial / active /
-- past_due / canceled). Lien optionnel vers la subscription Stripe parente pour
-- faciliter la corrélation lors des webhooks.
-- ============================================

CREATE TABLE IF NOT EXISTS user_addons (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id                     uuid NOT NULL REFERENCES public.addon_modules(id) ON DELETE RESTRICT,
  subscription_id               uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,

  -- Cycle de vie
  activated_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                    timestamptz,  -- NULL si abonné actif, set si cancel à l'échéance

  status                        text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing','active','past_due','canceled')),

  stripe_subscription_item_id   text,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_addons_org
  ON user_addons (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_user_addons_expires
  ON user_addons (expires_at)
  WHERE status = 'canceled';

CREATE INDEX IF NOT EXISTS idx_user_addons_subscription
  ON user_addons (subscription_id)
  WHERE subscription_id IS NOT NULL;

COMMENT ON TABLE user_addons IS
  'Souscriptions add-on par organisation. UNIQUE(org,module) empêche le double-abonnement.';
COMMENT ON COLUMN user_addons.expires_at IS
  'NULL si l''add-on est encore actif (renouvellement auto). Set quand l''utilisateur annule en fin de période.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.user_addons_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_addons_set_updated_at_trg ON user_addons;
CREATE TRIGGER user_addons_set_updated_at_trg
  BEFORE UPDATE ON user_addons
  FOR EACH ROW EXECUTE FUNCTION public.user_addons_set_updated_at();

-- RLS : isolation par organisation (membres only en lecture)
ALTER TABLE user_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_addons: org members read" ON user_addons;
CREATE POLICY "user_addons: org members read"
  ON user_addons FOR SELECT
  USING (public.is_member_of(organization_id));

-- INSERT/UPDATE/DELETE via service_role (webhook Stripe) ou admin
DROP POLICY IF EXISTS "user_addons: admin write" ON user_addons;
CREATE POLICY "user_addons: admin write"
  ON user_addons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
