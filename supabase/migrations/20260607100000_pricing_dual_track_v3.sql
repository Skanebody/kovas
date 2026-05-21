-- ============================================
-- KOVAS — Pricing V3 dual track (Annuaire + Logiciel 360) + Bundles + Sponsored slots
-- Date : 2026-06-07
-- Spec : docs/pricing/v3-dual-track-spec.md
-- ============================================
--
-- Contenu de cette migration :
--   A. Ajoute colonne subscriptions.plan_code + CHECK étendu (V3 + legacy + grandfather)
--   B. Table catalogue `bundles` + seed 5 lignes (cf. spec §4)
--   C. Table `bundle_subscriptions` (rattachement utilisateur ↔ bundle Stripe)
--   D. Table catalogue `sponsored_slots` + seed 30 lignes démo (5 villes × 6 catégories)
--   E. Table `sponsored_slot_subscriptions` + table `diagnosticians` (skeleton) requise par FK
--   F. Vue `v_sponsored_slot_availability` (slots disponibles par slot catalogue)
--   G. Table `subscription_history` (audit trail migrations / changements plan)
--   H. Table `migration_runs` (idempotence Edge Functions one-shot)
--   I. Table `email_queue` (file d'envoi async — utilisée par Edge migrate-legacy-plans-v3)
--
-- Note : `diagnosticians` est créée ici en version skeleton minimale (claimed_by_user_id +
-- organization_id) pour permettre la FK sponsored_slot_subscriptions.diagnostician_id.
-- La table sera enrichie dans une migration ultérieure (Phase B Annuaire complet).

-- ============================================
-- A. subscriptions.plan_code + CHECK étendu
-- ============================================
-- Détection initiale du schéma : la table subscriptions (migration 20260518140000)
-- a une colonne `tier text` (sans CHECK ni enum). On ajoute `plan_code` à plat avec
-- DEFAULT pour les lignes existantes, puis on contraint avec un CHECK.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_code text;

-- Mapping souple des anciennes valeurs `tier` (3 tiers historiques) vers plan_code legacy.
UPDATE subscriptions
SET plan_code = CASE
  WHEN tier = 'discovery' THEN 'decouverte'
  WHEN tier = 'standard'  THEN 'pro'
  WHEN tier = 'volume'    THEN 'all_inclusive'
  ELSE plan_code
END
WHERE plan_code IS NULL AND tier IS NOT NULL;

-- CHECK contraint plan_code (V3 dual track + legacy E2c + grandfather).
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_code_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_code_check
  CHECK (
    plan_code IS NULL OR plan_code IN (
      -- Annuaire (4 tiers V3)
      'annuaire_free',
      'annuaire_pro',
      'annuaire_visibility',
      'annuaire_sponsored',
      -- Logiciel KOVAS 360 (5 tiers V3)
      'logiciel_free',
      'logiciel_starter',
      'logiciel_active',
      'logiciel_cabinet',
      'logiciel_enterprise',
      -- Legacy E2c (5 tiers historiques, 2026-06-02)
      'essential',
      'decouverte',
      'pro',
      'all_inclusive',
      'cabinet',
      -- Grandfather (post-migration V3, prix figé à vie)
      'essential_legacy',
      'decouverte_legacy',
      'pro_legacy',
      'all_inclusive_legacy',
      'cabinet_legacy'
    )
  );

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_code ON subscriptions (plan_code);

-- ============================================
-- B. Catalogue `bundles` (Annuaire + Logiciel combo)
-- ============================================
CREATE TABLE IF NOT EXISTS bundles (
  code               text PRIMARY KEY CHECK (code IN (
    'bundle_starter_visibility',
    'bundle_active_pro',
    'bundle_active_visibility',
    'bundle_cabinet_pro',
    'bundle_cabinet_visibility'
  )),
  name               text NOT NULL,
  annuaire_component text NOT NULL, -- code plan annuaire inclus
  logiciel_component text NOT NULL, -- code plan logiciel inclus
  monthly_price_cents int NOT NULL CHECK (monthly_price_cents >= 0),
  annual_price_cents  int NOT NULL CHECK (annual_price_cents >= 0),
  savings_cents       int NOT NULL CHECK (savings_cents >= 0), -- économie mensuelle vs pricing individuel
  featured            boolean NOT NULL DEFAULT false,
  display_order       int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Bundles publics en lecture pour tous (catalogue pricing).
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bundles: public read" ON bundles;
CREATE POLICY "bundles: public read"
  ON bundles FOR SELECT
  USING (true);
-- Mutations : service_role uniquement.

-- Seed 5 bundles (cf. spec §4 — prix en centimes HT).
INSERT INTO bundles (code, name, annuaire_component, logiciel_component, monthly_price_cents, annual_price_cents, savings_cents, featured, display_order)
VALUES
  ('bundle_starter_visibility', 'Bundle Starter + Visibilité',  'annuaire_pro',        'logiciel_starter',  3900,  39000,  900, false, 1),
  ('bundle_active_pro',         'Bundle Active + Pro',          'annuaire_pro',        'logiciel_active',   6900,  69000,  900, true,  2),
  ('bundle_active_visibility',  'Bundle Active + Visibilité',   'annuaire_visibility', 'logiciel_active',   8900,  89000,  900, false, 3),
  ('bundle_cabinet_pro',        'Bundle Cabinet + Pro',         'annuaire_pro',        'logiciel_cabinet', 14900, 149000, 1900, false, 4),
  ('bundle_cabinet_visibility', 'Bundle Cabinet + Visibilité',  'annuaire_visibility', 'logiciel_cabinet', 16900, 169000, 1900, false, 5)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- C. bundle_subscriptions (instances Stripe)
-- ============================================
CREATE TABLE IF NOT EXISTS bundle_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bundle_code            text NOT NULL REFERENCES bundles(code),
  stripe_subscription_id text UNIQUE,
  status                 text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','past_due','cancelled','expired')),
  started_at             timestamptz NOT NULL DEFAULT now(),
  current_period_end     timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_subs_org_status ON bundle_subscriptions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_bundle_subs_stripe ON bundle_subscriptions (stripe_subscription_id);

ALTER TABLE bundle_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bundle_subs: org members read" ON bundle_subscriptions;
CREATE POLICY "bundle_subs: org members read"
  ON bundle_subscriptions FOR SELECT
  USING (public.is_member_of(organization_id));
-- INSERT/UPDATE/DELETE : service_role uniquement (webhook Stripe).

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.bundle_subscriptions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bundle_subscriptions_set_updated_at_trg ON bundle_subscriptions;
CREATE TRIGGER bundle_subscriptions_set_updated_at_trg
  BEFORE UPDATE ON bundle_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.bundle_subscriptions_set_updated_at();

-- ============================================
-- D. Catalogue sponsored_slots
-- ============================================
CREATE TABLE IF NOT EXISTS sponsored_slots (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_code          text NOT NULL CHECK (slot_code IN (
    'slot_metropole',
    'slot_grande_ville',
    'slot_ville_moyenne',
    'slot_petite_ville',
    'slot_commune',
    'slot_rural'
  )),
  city_inseecode     text NOT NULL, -- code INSEE 5 caractères
  city_label         text NOT NULL,
  department_code    text NOT NULL, -- code département FR (75, 13, etc.)
  population         int  NOT NULL CHECK (population >= 0),
  monthly_price_cents int NOT NULL CHECK (monthly_price_cents >= 0),
  annual_price_cents  int NOT NULL CHECK (annual_price_cents  >= 0),
  slot_capacity      int  NOT NULL DEFAULT 1 CHECK (slot_capacity >= 1),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_inseecode, slot_code)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_slots_dept_cat
  ON sponsored_slots (department_code, slot_code, monthly_price_cents);

-- Catalogue public en lecture.
ALTER TABLE sponsored_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sponsored_slots: public read" ON sponsored_slots;
CREATE POLICY "sponsored_slots: public read"
  ON sponsored_slots FOR SELECT
  USING (true);

-- Seed 30 slots démo (5 villes × 6 catégories = 30 lignes plausibles).
-- Prix HT en centimes (cf. spec §2 — surcoût mensuel sponsored).
INSERT INTO sponsored_slots
  (slot_code, city_inseecode, city_label, department_code, population, monthly_price_cents, annual_price_cents, slot_capacity)
VALUES
  -- slot_metropole +199€/mo, +1990€/an, capacity 3
  ('slot_metropole', '75056', 'Paris',               '75', 2161000, 19900, 199000, 3),
  ('slot_metropole', '69123', 'Lyon',                '69',  522000, 19900, 199000, 3),
  ('slot_metropole', '13055', 'Marseille',           '13',  870000, 19900, 199000, 3),
  ('slot_metropole', '31555', 'Toulouse',            '31',  493000, 19900, 199000, 2),
  ('slot_metropole', '06088', 'Nice',                '06',  342000, 19900, 199000, 2),
  -- slot_grande_ville +119€/mo, +1190€/an, capacity 2
  ('slot_grande_ville', '33063', 'Bordeaux',         '33',  259000, 11900, 119000, 2),
  ('slot_grande_ville', '59350', 'Lille',            '59',  234000, 11900, 119000, 2),
  ('slot_grande_ville', '44109', 'Nantes',           '44',  321000, 11900, 119000, 2),
  ('slot_grande_ville', '35238', 'Rennes',           '35',  217000, 11900, 119000, 2),
  ('slot_grande_ville', '67482', 'Strasbourg',       '67',  287000, 11900, 119000, 2),
  -- slot_ville_moyenne +79€/mo, +790€/an, capacity 2
  ('slot_ville_moyenne', '87085', 'Limoges',         '87',  132000,  7900,  79000, 2),
  ('slot_ville_moyenne', '74010', 'Annecy',          '74',  130000,  7900,  79000, 2),
  ('slot_ville_moyenne', '51454', 'Reims',           '51',  182000,  7900,  79000, 2),
  ('slot_ville_moyenne', '37261', 'Tours',           '37',  136000,  7900,  79000, 2),
  ('slot_ville_moyenne', '21231', 'Dijon',           '21',  157000,  7900,  79000, 2),
  -- slot_petite_ville +39€/mo, +390€/an, capacity 1
  ('slot_petite_ville', '76217', 'Dieppe',           '76',   28000,  3900,  39000, 1),
  ('slot_petite_ville', '03310', 'Vichy',            '03',   25000,  3900,  39000, 1),
  ('slot_petite_ville', '60057', 'Beauvais',         '60',   55000,  3900,  39000, 1),
  ('slot_petite_ville', '50129', 'Cherbourg',        '50',   38000,  3900,  39000, 1),
  ('slot_petite_ville', '85191', 'La Roche-sur-Yon', '85',   53000,  3900,  39000, 1),
  -- slot_commune +19€/mo, +190€/an, capacity 1
  ('slot_commune', '76540', 'Saint-Valery-en-Caux',  '76',    4200,  1900,  19000, 1),
  ('slot_commune', '76601', 'Tôtes',                 '76',    1100,  1900,  19000, 1),
  ('slot_commune', '14118', 'Bayeux',                '14',   13500,  1900,  19000, 1),
  ('slot_commune', '27375', 'Louviers',              '27',   18500,  1900,  19000, 1),
  ('slot_commune', '76452', 'Lillebonne',            '76',    9100,  1900,  19000, 1),
  -- slot_rural +9€/mo, +90€/an, capacity 1
  ('slot_rural', '76475', 'Mesnières-en-Bray',       '76',     900,   900,   9000, 1),
  ('slot_rural', '76011', 'Anneville-sur-Scie',      '76',     400,   900,   9000, 1),
  ('slot_rural', '76264', 'Foucarmont',              '76',    1100,   900,   9000, 1),
  ('slot_rural', '14276', 'Évrecy',                  '14',    2100,   900,   9000, 1),
  ('slot_rural', '27130', 'Bourg-Beaudouin',         '27',     600,   900,   9000, 1)
ON CONFLICT (city_inseecode, slot_code) DO NOTHING;

-- ============================================
-- E. diagnosticians (skeleton) + sponsored_slot_subscriptions
-- ============================================
-- Table `diagnosticians` créée en version minimale ici pour permettre la FK depuis
-- sponsored_slot_subscriptions. Sera enrichie dans une migration ultérieure (Annuaire).
CREATE TABLE IF NOT EXISTS diagnosticians (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      uuid REFERENCES organizations(id) ON DELETE CASCADE,
  claimed_by_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  siret                text UNIQUE,
  display_name         text NOT NULL,
  city                 text,
  department_code      text,
  activity_score       int NOT NULL DEFAULT 0 CHECK (activity_score >= 0 AND activity_score <= 100),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticians_user    ON diagnosticians (claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_diagnosticians_org     ON diagnosticians (organization_id);
CREATE INDEX IF NOT EXISTS idx_diagnosticians_dept    ON diagnosticians (department_code);

ALTER TABLE diagnosticians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "diagnosticians: public read" ON diagnosticians;
CREATE POLICY "diagnosticians: public read"
  ON diagnosticians FOR SELECT
  USING (true); -- annuaire public en lecture libre
DROP POLICY IF EXISTS "diagnosticians: owner update" ON diagnosticians;
CREATE POLICY "diagnosticians: owner update"
  ON diagnosticians FOR UPDATE
  USING (claimed_by_user_id = (SELECT auth.uid()))
  WITH CHECK (claimed_by_user_id = (SELECT auth.uid()));

-- Souscriptions à un slot sponsorisé (1 actif par diag x slot).
CREATE TABLE IF NOT EXISTS sponsored_slot_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnostician_id       uuid NOT NULL REFERENCES diagnosticians(id) ON DELETE CASCADE,
  organization_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sponsored_slot_id      uuid NOT NULL REFERENCES sponsored_slots(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  status                 text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','past_due','cancelled','expired')),
  started_at             timestamptz NOT NULL DEFAULT now(),
  current_period_end     timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Un seul abonnement actif par couple (diag, slot).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sponsored_slot_subs_active
  ON sponsored_slot_subscriptions (diagnostician_id, sponsored_slot_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sponsored_slot_subs_slot_status
  ON sponsored_slot_subscriptions (sponsored_slot_id, status);
CREATE INDEX IF NOT EXISTS idx_sponsored_slot_subs_diag_status
  ON sponsored_slot_subscriptions (diagnostician_id, status);

ALTER TABLE sponsored_slot_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sponsored_slot_subs: owner read" ON sponsored_slot_subscriptions;
CREATE POLICY "sponsored_slot_subs: owner read"
  ON sponsored_slot_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM diagnosticians d
      WHERE d.id = diagnostician_id
        AND d.claimed_by_user_id = (SELECT auth.uid())
    )
    OR public.is_member_of(organization_id)
  );
-- INSERT/UPDATE/DELETE : service_role uniquement (webhook Stripe).

CREATE OR REPLACE FUNCTION public.sponsored_slot_subs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sponsored_slot_subs_set_updated_at_trg ON sponsored_slot_subscriptions;
CREATE TRIGGER sponsored_slot_subs_set_updated_at_trg
  BEFORE UPDATE ON sponsored_slot_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sponsored_slot_subs_set_updated_at();

-- ============================================
-- F. Vue v_sponsored_slot_availability (slots restants par slot)
-- ============================================
CREATE OR REPLACE VIEW v_sponsored_slot_availability AS
SELECT
  s.id                            AS sponsored_slot_id,
  s.slot_code,
  s.city_inseecode,
  s.city_label,
  s.department_code,
  s.population,
  s.monthly_price_cents,
  s.annual_price_cents,
  s.slot_capacity,
  COALESCE(active_count.cnt, 0)::int                       AS active_subscriptions,
  (s.slot_capacity - COALESCE(active_count.cnt, 0))::int   AS slots_remaining
FROM sponsored_slots s
LEFT JOIN (
  SELECT sponsored_slot_id, COUNT(*)::int AS cnt
  FROM sponsored_slot_subscriptions
  WHERE status = 'active'
  GROUP BY sponsored_slot_id
) AS active_count ON active_count.sponsored_slot_id = s.id;

-- ============================================
-- G. subscription_history (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_history (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  action          text NOT NULL, -- ex: 'created' | 'upgraded' | 'grandfather_migration_v3' | 'cancelled'
  old_plan_code   text,
  new_plan_code   text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_sub_created
  ON subscription_history (subscription_id, created_at DESC);

ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_history: org members read" ON subscription_history;
CREATE POLICY "subscription_history: org members read"
  ON subscription_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = subscription_id
        AND public.is_member_of(s.organization_id)
    )
  );
-- Mutations : service_role uniquement.

-- ============================================
-- H. migration_runs (idempotence Edge Functions one-shot)
-- ============================================
CREATE TABLE IF NOT EXISTS migration_runs (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text UNIQUE NOT NULL,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  affected_rows int,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);
-- Pas de RLS : accessible service_role uniquement par défaut (table technique).

-- ============================================
-- I. email_queue (file d'envoi async — Brevo / Resend)
-- ============================================
CREATE TABLE IF NOT EXISTS email_queue (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template    text NOT NULL,
  to_email    text NOT NULL,
  subject     text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at     timestamptz,
  error       text,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_created
  ON email_queue (status, created_at);
-- Pas de RLS : worker service_role uniquement.
