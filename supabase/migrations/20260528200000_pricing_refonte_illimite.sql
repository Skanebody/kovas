-- ============================================
-- KOVAS — Refonte pricing P9 : All-you-can-eat + Fair-use + Grandfather
-- Date : 2026-05-28
-- Cf. CLAUDE.md §4 (refonte pricing illimité — 2026-05-28)
--
-- Refonte du modèle pricing : passage d'un système "quota + surplus à l'usage"
-- vers "forfait fixe mensuel + missions illimitées sous fair-use cap".
--
-- 5 nouveaux tiers : Essential 9€ / Découverte 19€ / Pro 35€ / All Inclusive 49€
--                  / Cabinet 89€ (tous mensuel HT).
--
-- Users existants : grandfathered à vie sur leur ancien plan. Leur tier est
-- renommé en *_legacy pour distinction explicite. Leur abonnement Stripe
-- continue inchangé (pas de modification de prix).
--
-- Migration idempotente : peut être rejouée en safe.
-- ============================================

-- ============================================
-- Étape 1 — Colonnes fair-use sur subscriptions
-- ============================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_grandfathered      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fair_use_cap_missions int,
  ADD COLUMN IF NOT EXISTS hard_cap_whisper_seconds int,
  ADD COLUMN IF NOT EXISTS hard_cap_vision_calls    int,
  ADD COLUMN IF NOT EXISTS hard_cap_burst_per_day   int;

COMMENT ON COLUMN public.subscriptions.is_grandfathered IS
  'true = abonnement hérité de l''ancien modèle (quotas + surplus). Affichage et logique différents : pas de fair-use, l''ancien overage_price_cents reste utilisé.';
COMMENT ON COLUMN public.subscriptions.fair_use_cap_missions IS
  'Soft cap mensuel missions (visible UI). Au-delà : alerte upgrade après 3 mois consécutifs. NULL si grandfathered (logique surplus).';
COMMENT ON COLUMN public.subscriptions.hard_cap_whisper_seconds IS
  'Hard cap mensuel transcription Whisper (silencieux jusqu''au plafonnement). NULL si grandfathered.';
COMMENT ON COLUMN public.subscriptions.hard_cap_vision_calls IS
  'Hard cap mensuel appels Vision IA. NULL si grandfathered.';
COMMENT ON COLUMN public.subscriptions.hard_cap_burst_per_day IS
  'Anti-abus : rafale max missions / jour. NULL si grandfathered.';

-- ============================================
-- Étape 2 — Table tracking fair-use alerts mensuelles
-- ============================================

CREATE TABLE IF NOT EXISTS public.fair_use_alerts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month_iso                text NOT NULL,         -- '2026-05'
  missions_count           int NOT NULL,
  cap_threshold            int NOT NULL,
  email_sent_at            timestamptz,
  consecutive_months_over  int NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month_iso)
);

CREATE INDEX IF NOT EXISTS idx_fair_use_alerts_org
  ON public.fair_use_alerts (organization_id, month_iso DESC);

CREATE INDEX IF NOT EXISTS idx_fair_use_alerts_consec
  ON public.fair_use_alerts (consecutive_months_over)
  WHERE consecutive_months_over >= 3;

COMMENT ON TABLE public.fair_use_alerts IS
  'Historique des dépassements fair-use par org × mois. Sert au cron mensuel : 3 mois consécutifs > cap déclenche un email upgrade.';
COMMENT ON COLUMN public.fair_use_alerts.month_iso IS
  'Format YYYY-MM (ex 2026-05). Stocké en text car pas de DATE column needed.';
COMMENT ON COLUMN public.fair_use_alerts.consecutive_months_over IS
  'Compteur de mois consécutifs au-dessus du cap. Reset à 1 si le mois précédent était dans les clous.';

-- RLS : lecture pour les membres de l'org (transparence dashboard) + admin writes
ALTER TABLE public.fair_use_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fair_use_alerts: org members read" ON public.fair_use_alerts;
CREATE POLICY "fair_use_alerts: org members read"
  ON public.fair_use_alerts FOR SELECT
  USING (public.is_member_of(organization_id));

-- INSERT/UPDATE/DELETE : service_role only (Edge Functions cron)

-- ============================================
-- Étape 3 — Table tracking AI cost mensuel par org
-- ============================================

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month_iso            text NOT NULL,
  whisper_seconds      int NOT NULL DEFAULT 0,
  vision_calls         int NOT NULL DEFAULT 0,
  claude_tokens_input  bigint NOT NULL DEFAULT 0,
  claude_tokens_output bigint NOT NULL DEFAULT 0,
  cost_cents           int NOT NULL DEFAULT 0,
  degraded_mode_at     timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month_iso)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_org
  ON public.ai_usage_monthly (organization_id, month_iso DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_monthly_degraded
  ON public.ai_usage_monthly (organization_id)
  WHERE degraded_mode_at IS NOT NULL;

COMMENT ON TABLE public.ai_usage_monthly IS
  'Compteurs IA mensuels par org. Sert aux hard caps Whisper/Vision/Claude et au tracking coûts pour analytics éco-progressive (cf. CLAUDE.md §7bis).';
COMMENT ON COLUMN public.ai_usage_monthly.degraded_mode_at IS
  'Timestamp du basculement en mode dégradé (hard cap atteint). NULL = mode IA complet actif.';
COMMENT ON COLUMN public.ai_usage_monthly.cost_cents IS
  'Coût cumulé estimé du mois en centimes EUR (utile pour analytics marge brute par org).';

-- RLS : lecture org members (transparence dashboard widget)
ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_monthly: org members read" ON public.ai_usage_monthly;
CREATE POLICY "ai_usage_monthly: org members read"
  ON public.ai_usage_monthly FOR SELECT
  USING (public.is_member_of(organization_id));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.ai_usage_monthly_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ai_usage_monthly_updated_at_trg ON public.ai_usage_monthly;
CREATE TRIGGER ai_usage_monthly_updated_at_trg
  BEFORE UPDATE ON public.ai_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION public.ai_usage_monthly_set_updated_at();

-- ============================================
-- Étape 4 — Étendre le CHECK constraint sur subscriptions.tier pour
--           inclure le code 'cabinet_legacy' (présent dans le scope P9).
-- ============================================

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN (
    'essential','decouverte','pro','all_inclusive','cabinet',
    'decouverte_legacy','standard_legacy','volume_legacy',
    'founder_legacy','cabinet_legacy'
  ));

-- ============================================
-- Étape 5 — Marquage des users existants comme grandfathered
-- ============================================
-- Note : la migration 20260526103000 a déjà renommé les anciens codes
-- ('discovery','standard','volume','decouverte','founder') vers leurs
-- variantes *_legacy. On marque ici tous les abonnements concernés.
-- Idempotent : peut être rejouée sans dommage.

UPDATE public.subscriptions
SET is_grandfathered = true
WHERE tier IN (
  'decouverte_legacy', 'standard_legacy', 'volume_legacy',
  'founder_legacy', 'cabinet_legacy'
);

-- Sécurité supplémentaire pour les bases où une création antérieure au pivot
-- aurait gardé les codes natifs (cas test/dev) :
UPDATE public.subscriptions
SET tier = 'decouverte_legacy', is_grandfathered = true
WHERE tier = 'decouverte' AND created_at < '2026-05-28'::date;

UPDATE public.subscriptions
SET tier = 'cabinet_legacy', is_grandfathered = true
WHERE tier = 'cabinet'
  AND created_at < '2026-05-28'::date
  AND missions_included IS NOT NULL  -- ancien modèle avec quota défini
  AND missions_included > 0;

-- ============================================
-- Étape 6 — Helper SQL : month_iso à partir d'un timestamptz
-- ============================================

CREATE OR REPLACE FUNCTION public.month_iso(ts timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(ts AT TIME ZONE 'Europe/Paris', 'YYYY-MM');
$$;

COMMENT ON FUNCTION public.month_iso(timestamptz) IS
  'Convertit un timestamp en libellé YYYY-MM dans la timezone Paris (référence comptable KOVAS).';
