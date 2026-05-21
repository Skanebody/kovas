-- ============================================
-- KOVAS — Pricing finale validée fondateur (E2c remplace E2)
-- Date : 2026-06-02
-- Cf. CLAUDE.md §4 — nouvelle grille 5 tiers + 9 add-ons + 3 packs
--
-- Grille TIERS finale :
--   essential       19€ — 1h Whisper · 30 missions · 5 Go · 0 Vision · 1 user
--   decouverte      29€ — 5h Whisper · 60 missions · 12 Go · 0 Vision · 1 user
--   pro             39€ — 10h Whisper · 150 missions · 25 Go · 100 Vision · 1 user  [POPULAIRE]
--   all_inclusive   99€ — 25h Whisper · 250 missions · 80 Go · 200 Vision · 1 user
--   cabinet        149€ — 40h Whisper · 400 missions · 100 Go · 600 Vision · 3 users
--
-- Migration idempotente : robustesse via ALTER TABLE … ADD COLUMN IF NOT EXISTS
-- pour les colonnes que E2 aurait créées (plan_code, fair_use_cap_missions, etc.).
-- Si E2 a déjà tourné, ces colonnes existent ; sinon on les crée.
-- ============================================

-- 1) Garantir présence des colonnes attendues sur subscriptions
--    (cf. E2 audit caps — colonnes créées par cette branche)

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_code                 text,
  ADD COLUMN IF NOT EXISTS is_grandfathered          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fair_use_cap_missions     int,
  ADD COLUMN IF NOT EXISTS hard_cap_whisper_seconds  int,
  ADD COLUMN IF NOT EXISTS hard_cap_vision_calls     int,
  ADD COLUMN IF NOT EXISTS hard_cap_storage_gb       int;

-- 2) Update caps pour les abonnés non grandfathered, selon nouvelle grille

UPDATE subscriptions SET
  fair_use_cap_missions = CASE plan_code
    WHEN 'essential'     THEN 30
    WHEN 'decouverte'    THEN 60
    WHEN 'pro'           THEN 150
    WHEN 'all_inclusive' THEN 250
    WHEN 'cabinet'       THEN 400
    ELSE fair_use_cap_missions
  END,
  hard_cap_whisper_seconds = CASE plan_code
    WHEN 'essential'     THEN 3600    -- 1h
    WHEN 'decouverte'    THEN 18000   -- 5h
    WHEN 'pro'           THEN 36000   -- 10h
    WHEN 'all_inclusive' THEN 90000   -- 25h
    WHEN 'cabinet'       THEN 144000  -- 40h
    ELSE hard_cap_whisper_seconds
  END,
  hard_cap_vision_calls = CASE plan_code
    WHEN 'essential'     THEN 0
    WHEN 'decouverte'    THEN 0
    WHEN 'pro'           THEN 100
    WHEN 'all_inclusive' THEN 200
    WHEN 'cabinet'       THEN 600
    ELSE hard_cap_vision_calls
  END,
  hard_cap_storage_gb = CASE plan_code
    WHEN 'essential'     THEN 5
    WHEN 'decouverte'    THEN 12
    WHEN 'pro'           THEN 25
    WHEN 'all_inclusive' THEN 80
    WHEN 'cabinet'       THEN 100
    ELSE hard_cap_storage_gb
  END
WHERE is_grandfathered = false
  AND plan_code IS NOT NULL;

-- 3) Audit log (idempotent — n'écrit que si table existe)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_log') THEN
    INSERT INTO audit_log (kind, payload, created_at)
    VALUES (
      'pricing_update_premium',
      '{"version":"2026-06-02","author":"Benjamin Bel","tiers":{"essential":19,"decouverte":29,"pro":39,"all_inclusive":99,"cabinet":149},"note":"E2c remplace E2"}'::jsonb,
      now()
    );
  END IF;
END $$;

-- 4) Table addon_packs (nouvelle) — 3 packs thématiques

CREATE TABLE IF NOT EXISTS addon_packs (
  code               text PRIMARY KEY,
  name               text NOT NULL,
  monthly_price      int NOT NULL,                       -- centimes HT
  annual_price       int,                                -- centimes HT (10×)
  description        text,
  included_addons    text[] NOT NULL DEFAULT '{}',       -- codes add-ons inclus
  bundle_limits      jsonb NOT NULL DEFAULT '{}'::jsonb, -- { signatures_eidas: 3, ... }
  created_at         timestamptz NOT NULL DEFAULT now()
);

INSERT INTO addon_packs (code, name, monthly_price, annual_price, description, included_addons, bundle_limits)
VALUES
  (
    'pack_growth',
    'Pack Croissance',
    2900,
    29000,
    'Veille IA hebdo + Cockpit ADEME Mode 2 + Communauté Pro',
    ARRAY['regulatory_watch', 'cockpit_ademe_m2', 'community_pro'],
    '{}'::jsonb
  ),
  (
    'pack_cabinet',
    'Pack Cabinet',
    4900,
    49000,
    'Analytics avancés + Synchronisation Pennylane + Facturation Factur-X PPF (100 factures/mo)',
    ARRAY['analytics_advanced', 'pennylane_sync', 'facturx_ppf'],
    '{"facturx_ppf":100}'::jsonb
  ),
  (
    'pack_international',
    'Pack International',
    2500,
    25000,
    '3 signatures eIDAS Yousign + 3 rapports bilingues FR/EN inclus chaque mois',
    ARRAY['signatures_eidas', 'bilingual_reports'],
    '{"signatures_eidas":3,"bilingual_reports":3}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  monthly_price   = EXCLUDED.monthly_price,
  annual_price    = EXCLUDED.annual_price,
  description     = EXCLUDED.description,
  included_addons = EXCLUDED.included_addons,
  bundle_limits   = EXCLUDED.bundle_limits;

-- RLS : packs lisibles par tous les utilisateurs authentifiés (catalogue public)
ALTER TABLE addon_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addon_packs: authenticated read" ON addon_packs;
CREATE POLICY "addon_packs: authenticated read"
  ON addon_packs FOR SELECT
  TO authenticated
  USING (true);
