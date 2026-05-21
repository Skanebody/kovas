-- ============================================
-- KOVAS — Annuaire freemium 3 niveaux + pay-to-unlock leads (G1)
-- Cf. CLAUDE.md §4 (4 tiers) — l'architecture suppose les tables
-- diagnosticians (worktree A1), quote_requests (worktree B2)
-- et subscriptions.plan_code (worktree E2c).
--
-- Cette migration est défensive : on crée des stubs `IF NOT EXISTS`
-- pour que la migration tourne dans n'importe quel ordre de merge.
-- Toutes les colonnes ajoutées le sont aussi en `IF NOT EXISTS`.
-- ============================================

-- ────────────────────────────────────────────
-- 1. Stubs défensifs (si A1/B2/E2c pas encore mergés)
-- ────────────────────────────────────────────

-- Stub diagnosticians (sera étendu par A1)
CREATE TABLE IF NOT EXISTS diagnosticians (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                text UNIQUE,
  claim_status        text NOT NULL DEFAULT 'unclaimed', -- unclaimed | pending_review | claimed
  claimed_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published        boolean NOT NULL DEFAULT true,
  withdrawal_requested boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Stub quote_requests (sera étendu par B2)
CREATE TABLE IF NOT EXISTS quote_requests (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnostician_id    uuid REFERENCES diagnosticians(id) ON DELETE CASCADE,
  requester_first_name text,
  requester_last_name text,
  requester_email     text,
  requester_phone     text,
  property_address    text,
  property_postal_code text,
  property_city       text,
  property_type       text,
  property_surface_m2 numeric(10,2),
  diagnostics_requested text[] NOT NULL DEFAULT ARRAY[]::text[],
  message             text,
  status              text NOT NULL DEFAULT 'pending', -- pending | contacted | converted | dismissed
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Stub colonne plan_code sur subscriptions (sera utilisée par E2c)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_code text;
-- Stub colonne user_id sur subscriptions (E2c orienté user, alors que V1 = org-scoped)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────
-- 2. Vue v_diagnostician_listing_level
-- ────────────────────────────────────────────

CREATE OR REPLACE VIEW v_diagnostician_listing_level AS
SELECT
  d.id,
  d.slug,
  d.claim_status,
  d.claimed_by_user_id,
  CASE
    WHEN d.claim_status = 'unclaimed' OR d.claimed_by_user_id IS NULL THEN 'basic'
    WHEN s.plan_code IN ('pro', 'all_inclusive', 'cabinet')
         AND s.status IN ('active', 'trialing') THEN 'premium'
    WHEN s.plan_code IN ('essential', 'decouverte')
         AND s.status IN ('active', 'trialing') THEN 'verified'
    -- Compat tiers V1 actuels (cf. stripe-config.ts) :
    WHEN s.tier IN ('volume')
         AND s.status IN ('active', 'trialing') THEN 'premium'
    WHEN s.tier IN ('discovery', 'standard')
         AND s.status IN ('active', 'trialing') THEN 'verified'
    ELSE 'basic'
  END AS listing_level,
  s.plan_code,
  s.tier,
  s.status AS subscription_status
FROM diagnosticians d
LEFT JOIN subscriptions s
  ON s.user_id = d.claimed_by_user_id
WHERE d.is_published = true
  AND d.withdrawal_requested = false;

COMMENT ON VIEW v_diagnostician_listing_level IS
  'Niveau de fiche annuaire calculé dynamiquement (basic/verified/premium).
   Basic = non-réclamée (DHUP), Verified = claimed + tier d''entrée (essential/decouverte ou
   compat discovery/standard), Premium = tier supérieur (pro/all_inclusive/cabinet ou compat volume).';

-- Index pour requêtes annuaire (tri par niveau implicite)
CREATE INDEX IF NOT EXISTS idx_diag_listing_level
  ON diagnosticians (claim_status, claimed_by_user_id)
  WHERE is_published = true;

-- ────────────────────────────────────────────
-- 3. Table quote_request_unlocks (audit pay-to-unlock)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quote_request_unlocks (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_request_id    uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  diagnostician_id    uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id     uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  unlocked_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_request_id, diagnostician_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_unlocks_diag
  ON quote_request_unlocks(diagnostician_id, unlocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_unlocks_user_month
  ON quote_request_unlocks(user_id, unlocked_at DESC);

-- RLS service-role uniquement (toutes les unlock check passent par
-- routes API server-side qui vérifient quota + abonnement)
ALTER TABLE quote_request_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_request_unlocks: service role only" ON quote_request_unlocks;
CREATE POLICY "quote_request_unlocks: service role only"
  ON quote_request_unlocks FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "quote_request_unlocks: diag owner read" ON quote_request_unlocks;
CREATE POLICY "quote_request_unlocks: diag owner read"
  ON quote_request_unlocks FOR SELECT
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────
-- 4. Stats annuaire sur diagnosticians
-- ────────────────────────────────────────────

ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS leads_received_count int NOT NULL DEFAULT 0;
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS leads_unlocked_count int NOT NULL DEFAULT 0;
ALTER TABLE diagnosticians
  ADD COLUMN IF NOT EXISTS last_lead_received_at timestamptz;

-- Trigger : à chaque insertion quote_requests, incrémenter leads_received_count
CREATE OR REPLACE FUNCTION public.increment_diag_leads_received()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.diagnostician_id IS NOT NULL THEN
    UPDATE diagnosticians
       SET leads_received_count = leads_received_count + 1,
           last_lead_received_at = NEW.created_at
     WHERE id = NEW.diagnostician_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quote_requests_inc_leads_trg ON quote_requests;
CREATE TRIGGER quote_requests_inc_leads_trg
  AFTER INSERT ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.increment_diag_leads_received();

-- Trigger : à chaque unlock, incrémenter leads_unlocked_count
CREATE OR REPLACE FUNCTION public.increment_diag_leads_unlocked()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE diagnosticians
     SET leads_unlocked_count = leads_unlocked_count + 1
   WHERE id = NEW.diagnostician_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quote_unlocks_inc_trg ON quote_request_unlocks;
CREATE TRIGGER quote_unlocks_inc_trg
  AFTER INSERT ON quote_request_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.increment_diag_leads_unlocked();

-- ────────────────────────────────────────────
-- 5. Préparation Phase 2 (V1.5) : slots premium par ville
-- Schéma en place mais `enabled=false` par défaut (inactif V1)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS city_premium_slots (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_slug                   text NOT NULL,
  department_code             text NOT NULL,
  max_slots                   int NOT NULL DEFAULT 3,
  current_slot_price_eur_monthly int NOT NULL DEFAULT 89,
  enabled                     boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_slug, department_code)
);

CREATE TABLE IF NOT EXISTS diagnostician_premium_bookings (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnostician_id            uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  slot_id                     uuid NOT NULL REFERENCES city_premium_slots(id) ON DELETE CASCADE,
  position                    int NOT NULL CHECK (position IN (1, 2, 3)),
  active_from                 timestamptz NOT NULL DEFAULT now(),
  active_until                timestamptz,
  monthly_price_paid_eur      int NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostician_premium_bookings_slot_position_uniq
    UNIQUE (slot_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_premium_bookings_diag
  ON diagnostician_premium_bookings(diagnostician_id);

ALTER TABLE city_premium_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostician_premium_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "city_premium_slots: public read" ON city_premium_slots;
CREATE POLICY "city_premium_slots: public read"
  ON city_premium_slots FOR SELECT
  USING (enabled = true);

DROP POLICY IF EXISTS "premium_bookings: public read" ON diagnostician_premium_bookings;
CREATE POLICY "premium_bookings: public read"
  ON diagnostician_premium_bookings FOR SELECT
  USING (active_until IS NULL OR active_until > now());
