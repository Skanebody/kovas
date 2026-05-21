-- ============================================
-- KOVAS — A/B Testing infrastructure (mission C2)
-- Tables : ab_experiments / ab_assignments / ab_events
-- Vue agrégée : ab_experiment_results
-- Toutes les tables sont service_role only : la stratégie
-- d'assignation ne doit jamais être exposée côté client.
-- ============================================

-- ---------------------------------------------------------------
-- ab_experiments — définitions des tests
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key      text NOT NULL UNIQUE,
  description         text NOT NULL,
  hypothesis          text,
  -- Variants : tableau d'objets {name:string, weight:number}
  variants            jsonb NOT NULL,
  -- Split denormalisé pour query rapide : {control:0.5, variant_a:0.5}
  traffic_split       jsonb NOT NULL,
  -- Lifecycle
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'completed', 'aborted')),
  primary_metric      text,
  started_at          timestamptz,
  ended_at            timestamptz,
  winner_variant      text,
  -- Audit
  created_by_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_status
  ON public.ab_experiments (status);

-- ---------------------------------------------------------------
-- ab_assignments — variant retenu pour un user_identifier donné
-- (cookie session_id ou user_id authentifié)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ab_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       uuid NOT NULL REFERENCES public.ab_experiments(id) ON DELETE CASCADE,
  user_identifier     text NOT NULL,
  variant_assigned    text NOT NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, user_identifier)
);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_user
  ON public.ab_assignments (user_identifier);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_exp
  ON public.ab_assignments (experiment_id, variant_assigned);

-- ---------------------------------------------------------------
-- ab_events — exposures / conversions / clicks / submits
-- variant_assigned dénormalisé pour agrégats sans jointure
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ab_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       uuid NOT NULL REFERENCES public.ab_experiments(id) ON DELETE CASCADE,
  user_identifier     text NOT NULL,
  event_type          text NOT NULL
    CHECK (event_type IN ('exposure', 'conversion', 'click', 'submit')),
  event_value         numeric(10,2),
  event_data          jsonb,
  variant_assigned    text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_events_exp
  ON public.ab_events (experiment_id, event_type, variant_assigned);
CREATE INDEX IF NOT EXISTS idx_ab_events_user
  ON public.ab_events (user_identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_events_created
  ON public.ab_events (experiment_id, created_at DESC);

-- ---------------------------------------------------------------
-- Vue agrégée — exposures / conversions / taux par variant
-- (distinct user_identifier pour éviter double-comptage)
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW public.ab_experiment_results AS
SELECT
  e.experiment_id,
  e.variant_assigned,
  COUNT(DISTINCT CASE WHEN e.event_type = 'exposure'
                      THEN e.user_identifier END) AS exposures,
  COUNT(DISTINCT CASE WHEN e.event_type = 'conversion'
                      THEN e.user_identifier END) AS conversions,
  COUNT(DISTINCT CASE WHEN e.event_type = 'click'
                      THEN e.user_identifier END) AS clicks,
  COUNT(DISTINCT CASE WHEN e.event_type = 'submit'
                      THEN e.user_identifier END) AS submits,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN e.event_type = 'conversion'
                                THEN e.user_identifier END)
    / NULLIF(COUNT(DISTINCT CASE WHEN e.event_type = 'exposure'
                                  THEN e.user_identifier END), 0),
    2
  ) AS conversion_rate_pct
FROM public.ab_events e
GROUP BY e.experiment_id, e.variant_assigned;

-- ---------------------------------------------------------------
-- Trigger updated_at sur ab_experiments
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ab_experiments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ab_experiments_updated_at ON public.ab_experiments;
CREATE TRIGGER trg_ab_experiments_updated_at
  BEFORE UPDATE ON public.ab_experiments
  FOR EACH ROW EXECUTE FUNCTION public.ab_experiments_set_updated_at();

-- ---------------------------------------------------------------
-- RLS — service_role only (la stratégie reste serveur)
-- ---------------------------------------------------------------
ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_events      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_experiments: service role only" ON public.ab_experiments;
CREATE POLICY "ab_experiments: service role only"
  ON public.ab_experiments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ab_assignments: service role only" ON public.ab_assignments;
CREATE POLICY "ab_assignments: service role only"
  ON public.ab_assignments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ab_events: service role only" ON public.ab_events;
CREATE POLICY "ab_events: service role only"
  ON public.ab_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE  public.ab_experiments IS 'A/B testing — définitions des expériences (service_role only).';
COMMENT ON TABLE  public.ab_assignments IS 'A/B testing — variant assigné par user_identifier (cookie ou auth user).';
COMMENT ON TABLE  public.ab_events      IS 'A/B testing — exposures/conversions/clicks/submits.';
COMMENT ON VIEW   public.ab_experiment_results IS 'A/B testing — agrégat exposures/conversions/taux par variant.';
