-- ============================================
-- KOVAS — User usage quotas (tracking temps réel par org/mois)
-- ============================================
-- 1 ligne par (organization_id, period_month) avec compteurs pour chaque
-- ressource métriquable :
--   - missions (DPE+amiante+plomb+...)
--   - chatbot_messages (assistant IA)
--   - yousign_signatures (eIDAS ponctuel 2€/sig)
--   - geocoding_requests (BAN / IGN)
--   - storage_gb (Supabase Storage)
--
-- Pour chaque ressource : `used`, `quota`, `overflow_count`, `overflow_amount_cents`.
-- Le worker mensuel agrège puis crée un Stripe usage record (overage billing).
--
-- Fonctions utilitaires :
--   - increment_quota_usage()       : incrément atomique
--   - ensure_current_month_quota_row() : upsert la ligne du mois courant
--
-- RLS : SELECT par membres org ; UPDATE = service_role (workers)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_usage_quotas (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id                 uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_month                    date NOT NULL,  -- YYYY-MM-01 Europe/Paris

  -- Missions (DPE / amiante / etc.)
  missions_used                   int NOT NULL DEFAULT 0,
  missions_quota                  int NOT NULL,
  missions_overflow_count         int NOT NULL DEFAULT 0,
  missions_overflow_amount_cents  int NOT NULL DEFAULT 0,

  -- Chatbot messages (assistant IA conversationnel Phase 3)
  chatbot_messages_used               int NOT NULL DEFAULT 0,
  chatbot_messages_quota              int NOT NULL,
  chatbot_overflow_count              int NOT NULL DEFAULT 0,
  chatbot_overflow_amount_cents       int NOT NULL DEFAULT 0,

  -- Signatures eIDAS Yousign (option ponctuelle 2€/sig)
  yousign_signatures_used             int NOT NULL DEFAULT 0,
  yousign_signatures_quota            int NOT NULL,
  yousign_overflow_count              int NOT NULL DEFAULT 0,
  yousign_overflow_amount_cents       int NOT NULL DEFAULT 0,

  -- Geocoding requests (BAN + IGN)
  geocoding_requests_used             int NOT NULL DEFAULT 0,
  geocoding_requests_quota            int NOT NULL,
  geocoding_overflow_count            int NOT NULL DEFAULT 0,
  geocoding_overflow_amount_cents     int NOT NULL DEFAULT 0,

  -- Storage (Supabase Storage)
  storage_gb_used                     numeric(8,2) NOT NULL DEFAULT 0,
  storage_gb_quota                    numeric(8,2) NOT NULL,
  storage_overflow_gb                 numeric(8,2) NOT NULL DEFAULT 0,
  storage_overflow_amount_cents       int NOT NULL DEFAULT 0,

  -- Settings utilisateur (UX anti-friction paiement)
  auto_overflow_enabled               boolean NOT NULL DEFAULT true,
  alert_80pct_sent_at                 timestamptz,
  alert_100pct_sent_at                timestamptz,

  -- Billing intent
  stripe_usage_record_id              text,
  billed_at                           timestamptz,

  updated_at                          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, period_month)
);

COMMENT ON TABLE public.user_usage_quotas IS
  'Compteurs temps réel des ressources consommées (missions, chatbot, yousign, geocoding, storage) par organisation et par mois (date YYYY-MM-01 Europe/Paris). Une ligne par mois ; en fin de période un worker crée un Stripe usage record pour facturer les dépassements.';

CREATE INDEX IF NOT EXISTS idx_quotas_org_period
  ON public.user_usage_quotas (organization_id, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_quotas_unbilled
  ON public.user_usage_quotas (period_month, billed_at)
  WHERE billed_at IS NULL;

-- ============================================
-- Fonction : increment_quota_usage()
-- Incrément atomique d'un compteur d'usage (appelé Edge Functions / triggers)
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_quota_usage(
  p_organization_id uuid,
  p_period_month date,
  p_column text,
  p_delta int DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_value int;
  v_allowed_columns text[] := ARRAY[
    'missions_used','missions_overflow_count',
    'chatbot_messages_used','chatbot_overflow_count',
    'yousign_signatures_used','yousign_overflow_count',
    'geocoding_requests_used','geocoding_overflow_count'
  ];
BEGIN
  -- Guard : whitelist colonnes (anti-SQL injection via p_column)
  IF NOT (p_column = ANY(v_allowed_columns)) THEN
    RAISE EXCEPTION 'increment_quota_usage: column % not allowed', p_column;
  END IF;

  EXECUTE format(
    'UPDATE public.user_usage_quotas
       SET %I = %I + $1, updated_at = now()
       WHERE organization_id = $2 AND period_month = $3
       RETURNING %I',
    p_column, p_column, p_column
  )
    INTO v_new_value
    USING p_delta, p_organization_id, p_period_month;

  RETURN v_new_value;
END;
$$;

COMMENT ON FUNCTION public.increment_quota_usage(uuid, date, text, int) IS
  'Incrément atomique d''un compteur d''usage. p_column whitelisté pour empêcher SQL injection. SECURITY DEFINER : appelable depuis Edge Functions sans toucher RLS.';

-- ============================================
-- Fonction : ensure_current_month_quota_row()
-- Provisionne la ligne du mois courant si absente (appelé signup / changement plan)
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_current_month_quota_row(
  p_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id              uuid;
  v_period              date;
  v_missions_quota      int := 60;   -- défaut Standard ; remplacé par worker selon plan
  v_chatbot_quota       int := 100;
  v_yousign_quota       int := 0;    -- ponctuel 2€/sig, pas de quota inclus
  v_geocoding_quota     int := 500;
  v_storage_quota       numeric(8,2) := 50.00; -- Standard 50 Go
BEGIN
  -- 1er du mois Europe/Paris
  v_period := date_trunc('month', (now() AT TIME ZONE 'Europe/Paris'))::date;

  SELECT id INTO v_row_id
    FROM public.user_usage_quotas
    WHERE organization_id = p_organization_id
      AND period_month = v_period
    FOR UPDATE;

  IF v_row_id IS NOT NULL THEN
    RETURN v_row_id;
  END IF;

  INSERT INTO public.user_usage_quotas (
    organization_id, period_month,
    missions_quota, chatbot_messages_quota, yousign_signatures_quota,
    geocoding_requests_quota, storage_gb_quota
  ) VALUES (
    p_organization_id, v_period,
    v_missions_quota, v_chatbot_quota, v_yousign_quota,
    v_geocoding_quota, v_storage_quota
  )
  ON CONFLICT (organization_id, period_month) DO NOTHING
  RETURNING id INTO v_row_id;

  -- Si ON CONFLICT s'est déclenché (concurrence), re-fetch
  IF v_row_id IS NULL THEN
    SELECT id INTO v_row_id
      FROM public.user_usage_quotas
      WHERE organization_id = p_organization_id
        AND period_month = v_period;
  END IF;

  RETURN v_row_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_current_month_quota_row(uuid) IS
  'Upsert la ligne user_usage_quotas du mois courant (Europe/Paris) avec des quotas par défaut "Standard". Le worker plan-sync ajuste ensuite les quotas selon le plan réel de l''org.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.user_usage_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_usage_quotas: org members read" ON public.user_usage_quotas;
CREATE POLICY "user_usage_quotas: org members read"
  ON public.user_usage_quotas FOR SELECT
  USING (public.is_member_of(organization_id));

-- UPDATE/INSERT = service_role uniquement (workers). Pas de policy = bypass via
-- service_role + lock total pour les users (cf. RLS activée).
