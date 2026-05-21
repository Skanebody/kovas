-- ============================================
-- KOVAS — subscriptions.plan_code (V3 dual track)
-- Date : 2026-05-22
-- Cf. CLAUDE.md §4 (pricing dual track) + lib/upsell/load-access.ts
--
-- Ajoute la colonne `plan_code` à `subscriptions`, manquante sur les DBs
-- pre-Phase B. Le code applicatif (load-access.ts, track-access.ts) tente
-- d'abord `select('plan_code, tier')` ; si la colonne manque, postgrest
-- echoue toute la requete → planCode = null → sidebar tombe en mode 'free'
-- pour les comptes legacy.
--
-- Cette migration :
--   1. Ajoute la colonne plan_code (text, nullable initialement)
--   2. Backfill depuis `tier` avec le mapping legacy E2c → V3 pricing
--   3. Index partiel pour les lookups par plan_code
-- ============================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_code text;

-- Backfill : map les tiers legacy bruts vers les codes V3 actifs.
-- Mapping aligne avec lib/upsell/load-access.ts → LEGACY_TIER_TO_PLAN_CODE.
UPDATE public.subscriptions
SET plan_code = CASE tier
  -- Codes V3 / E2c directs (preservation 1:1)
  WHEN 'essential'              THEN 'essential'
  WHEN 'decouverte'             THEN 'decouverte'
  WHEN 'pro'                    THEN 'pro'
  WHEN 'all_inclusive'          THEN 'all_inclusive'
  WHEN 'cabinet'                THEN 'cabinet'
  -- Tiers grandfather bruts (avant suffixe _legacy)
  WHEN 'standard'               THEN 'pro'
  WHEN 'volume'                 THEN 'all_inclusive'
  WHEN 'founder'                THEN 'pro'
  -- Tiers grandfather suffixes
  WHEN 'essential_legacy'       THEN 'essential'
  WHEN 'decouverte_legacy'      THEN 'decouverte'
  WHEN 'pro_legacy'             THEN 'pro'
  WHEN 'standard_legacy'        THEN 'pro'
  WHEN 'volume_legacy'          THEN 'all_inclusive'
  WHEN 'founder_legacy'         THEN 'pro'
  WHEN 'all_inclusive_legacy'   THEN 'all_inclusive'
  WHEN 'cabinet_legacy'         THEN 'cabinet'
  -- Codes V3 logiciel/annuaire (deja format moderne)
  WHEN 'logiciel_free'          THEN 'logiciel_free'
  WHEN 'logiciel_starter'       THEN 'logiciel_starter'
  WHEN 'logiciel_active'        THEN 'logiciel_active'
  WHEN 'logiciel_cabinet'       THEN 'logiciel_cabinet'
  WHEN 'logiciel_enterprise'    THEN 'logiciel_enterprise'
  -- Fallback : on conserve la valeur brute (le code applicatif renverra null
  -- via normalizePlanCode pour les valeurs inconnues — pas de crash).
  ELSE tier
END
WHERE plan_code IS NULL;

-- Index partiel : recherches frequentes par plan_code (admin dashboards, billing).
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_code
  ON public.subscriptions (plan_code)
  WHERE plan_code IS NOT NULL;

COMMENT ON COLUMN public.subscriptions.plan_code IS
  'Code plan V3 actif (essential, decouverte, pro, all_inclusive, cabinet, logiciel_*). '
  'Source de verite preferee a `tier` (legacy E2c). Si NULL, le code applicatif '
  'retombe sur tier via le mapping LEGACY_TIER_TO_PLAN_CODE de load-access.ts.';
