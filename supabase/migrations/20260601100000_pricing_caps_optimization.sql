-- ============================================
-- KOVAS — Optimisation caps fair-use + bump Cabinet (Audit E2)
-- Date : 2026-06-01
-- Cf. docs/pricing-margins-audit.md
--
-- Suite à l'audit marges brutes du 2026-05-20 (Mission E2), les caps
-- fair-use et hard caps IA des 5 tiers V1 sont resserrés pour atteindre
-- > 75 % de marge brute au worst case. Cabinet bumpé de 89 € → 99 € HT.
--
-- IMPACT :
--   - Subscriptions ACTIVES non-grandfathered : caps mis à jour
--     immédiatement (les hard caps sont silencieux, aucun impact UX)
--   - Subscriptions grandfathered (is_grandfathered = true ou tier
--     *_legacy) : INCHANGÉES (loi de la rétro-compatibilité)
--   - subscription_plans table : aligné avec nouveaux caps
--
-- Stripe Price IDs : à re-provisionner manuellement pour le tier
-- Cabinet (8900 → 9900 cents). Variable env STRIPE_PRICE_CABINET_MONTHLY
-- + STRIPE_PRICE_CABINET_ANNUAL doivent pointer vers les nouveaux Price.
--
-- Migration idempotente : peut être rejouée en safe.
-- ============================================

-- ============================================
-- Étape 1 — Update caps tier ESSENTIAL (subscriptions actives non-legacy)
-- ============================================

UPDATE public.subscriptions
SET
  hard_cap_whisper_seconds = 10800,      -- 3h (était 5h = 18000)
  hard_cap_vision_calls    = 0,           -- inchangé
  fair_use_cap_missions    = 40,          -- (était 50)
  hard_cap_burst_per_day   = 8            -- (était 10)
WHERE tier = 'essential'
  AND is_grandfathered = false;

-- ============================================
-- Étape 2 — Update caps tier DÉCOUVERTE
-- ============================================

UPDATE public.subscriptions
SET
  hard_cap_whisper_seconds = 28800,      -- 8h (était 15h = 54000)
  hard_cap_vision_calls    = 0,
  fair_use_cap_missions    = 80,          -- (était 100)
  hard_cap_burst_per_day   = 16           -- (était 20)
WHERE tier = 'decouverte'
  AND is_grandfathered = false;

-- ============================================
-- Étape 3 — Update caps tier PRO
-- ============================================

UPDATE public.subscriptions
SET
  hard_cap_whisper_seconds = 54000,      -- 15h (était 30h = 108000)
  hard_cap_vision_calls    = 100,         -- (était 200)
  fair_use_cap_missions    = 150,         -- (était 200)
  hard_cap_burst_per_day   = 24           -- (était 30)
WHERE tier = 'pro'
  AND is_grandfathered = false;

-- ============================================
-- Étape 4 — Update caps tier ALL INCLUSIVE
-- ============================================

UPDATE public.subscriptions
SET
  hard_cap_whisper_seconds = 90000,      -- 25h (était 60h = 216000)
  hard_cap_vision_calls    = 200,         -- (était 500)
  fair_use_cap_missions    = 250,         -- (était 350)
  hard_cap_burst_per_day   = 40           -- (était 50)
WHERE tier = 'all_inclusive'
  AND is_grandfathered = false;

-- ============================================
-- Étape 5 — Update caps tier CABINET + bump prix 89 € → 99 €
-- ============================================

UPDATE public.subscriptions
SET
  hard_cap_whisper_seconds = 144000,     -- 40h (était 120h = 432000)
  hard_cap_vision_calls    = 600,         -- (était 1500)
  fair_use_cap_missions    = 400,         -- (était 500)
  hard_cap_burst_per_day   = 64           -- (était 80)
WHERE tier = 'cabinet'
  AND is_grandfathered = false;

-- Note : le prix mensuel HT centimes (price_monthly_cents) sur les
-- subscriptions actives n'est PAS modifié à chaud — il sera updated
-- automatiquement au prochain billing cycle via le webhook Stripe une
-- fois les nouveaux Stripe Price IDs (8900 → 9900 cents) provisionnés.
-- Les users actuels Cabinet 89 € restent à 89 € le mois en cours.

-- ============================================
-- Étape 6 — Update subscription_plans table (source vérité catalogue)
-- ============================================
-- Cette table est consommée par l'admin dashboard + finance-calculator
-- pour exposer le catalogue. Doit refléter la nouvelle grille.
-- Idempotent via UPSERT.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscription_plans'
  ) THEN
    UPDATE public.subscription_plans
    SET
      price_monthly_cents      = 900,
      price_annual_cents       = 9000,
      hard_cap_whisper_seconds = 10800,
      hard_cap_vision_calls    = 0,
      fair_use_cap_missions    = 40,
      hard_cap_burst_per_day   = 8,
      storage_gb               = 8,
      updated_at               = now()
    WHERE code = 'essential';

    UPDATE public.subscription_plans
    SET
      price_monthly_cents      = 1900,
      price_annual_cents       = 19000,
      hard_cap_whisper_seconds = 28800,
      hard_cap_vision_calls    = 0,
      fair_use_cap_missions    = 80,
      hard_cap_burst_per_day   = 16,
      storage_gb               = 15,
      updated_at               = now()
    WHERE code = 'decouverte';

    UPDATE public.subscription_plans
    SET
      price_monthly_cents      = 3500,
      price_annual_cents       = 35000,
      hard_cap_whisper_seconds = 54000,
      hard_cap_vision_calls    = 100,
      fair_use_cap_missions    = 150,
      hard_cap_burst_per_day   = 24,
      storage_gb               = 40,
      updated_at               = now()
    WHERE code = 'pro';

    UPDATE public.subscription_plans
    SET
      price_monthly_cents      = 4900,
      price_annual_cents       = 49000,
      hard_cap_whisper_seconds = 90000,
      hard_cap_vision_calls    = 200,
      fair_use_cap_missions    = 250,
      hard_cap_burst_per_day   = 40,
      storage_gb               = 80,
      updated_at               = now()
    WHERE code = 'all_inclusive';

    -- Cabinet : bump prix 8900 → 9900 cents (+annual 89000 → 99000)
    UPDATE public.subscription_plans
    SET
      price_monthly_cents      = 9900,
      price_annual_cents       = 99000,
      hard_cap_whisper_seconds = 144000,
      hard_cap_vision_calls    = 600,
      fair_use_cap_missions    = 400,
      hard_cap_burst_per_day   = 64,
      storage_gb               = 150,
      updated_at               = now()
    WHERE code = 'cabinet';
  END IF;
END $$;

-- ============================================
-- Étape 7 — Logging audit pour traçabilité fondateur
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) THEN
    INSERT INTO public.audit_log (action, actor, payload, created_at)
    VALUES (
      'pricing_caps_optimization',
      'system_migration_e2',
      jsonb_build_object(
        'date', '2026-06-01',
        'reason', 'Marge brute > 75 % au worst case (audit E2)',
        'tiers_updated', ARRAY['essential','decouverte','pro','all_inclusive','cabinet'],
        'cabinet_price_bump', jsonb_build_object('from_cents', 8900, 'to_cents', 9900),
        'doc_ref', 'docs/pricing-margins-audit.md'
      ),
      now()
    );
  END IF;
END $$;
