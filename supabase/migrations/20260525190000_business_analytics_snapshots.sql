-- ============================================
-- KOVAS App — Module 9 : Analytics business — snapshots
-- Date : 2026-05-25
-- Calcul périodique (worker) d'indicateurs cabinet : volume, marge, mix diagnostics,
-- saisonnalité, vélocité, churn risk. Source de la page /performance.
-- ============================================

CREATE TABLE business_analytics_snapshots (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Période normalisée.
  snapshot_period           date NOT NULL,         -- ex : 2026-05-01 pour mai 2026
  period_type               text NOT NULL
    CHECK (period_type IN ('day','week','month','quarter','year')),
  -- Volume.
  missions_total            int NOT NULL DEFAULT 0,
  missions_completed        int NOT NULL DEFAULT 0,
  missions_exported         int NOT NULL DEFAULT 0,
  missions_cancelled        int NOT NULL DEFAULT 0,
  -- Mix diagnostics (clés : mission_type, valeurs : count).
  diagnostic_mix            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Chiffre d'affaires (centimes integer pour éviter les float).
  revenue_ht_cents          bigint NOT NULL DEFAULT 0,
  revenue_ttc_cents         bigint NOT NULL DEFAULT 0,
  avg_mission_value_cents   bigint NOT NULL DEFAULT 0,
  -- Marge (coûts variables : IA, transcriptions, exports lourds).
  ai_cost_cents             bigint NOT NULL DEFAULT 0,
  variable_cost_cents       bigint NOT NULL DEFAULT 0,
  gross_margin_cents        bigint NOT NULL DEFAULT 0,
  gross_margin_ratio        numeric(5,4),
  -- Vélocité opérationnelle.
  avg_time_to_export_seconds int,
  avg_voice_seconds_per_mission int,
  avg_photos_per_mission    numeric(6,2),
  -- Saisonnalité / jour type.
  by_day_of_week            jsonb DEFAULT '{}'::jsonb, -- ex : {"mon":12,"tue":18,...}
  by_hour_of_day            jsonb DEFAULT '{}'::jsonb,
  -- Clients / récurrence.
  unique_clients            int NOT NULL DEFAULT 0,
  recurring_clients         int NOT NULL DEFAULT 0,
  top_client_share_pct      numeric(5,2),
  -- Géographie (départements top 5).
  top_departments           jsonb DEFAULT '[]'::jsonb,
  -- Time saved (Gain Tracker — agrégat).
  estimated_time_saved_seconds bigint NOT NULL DEFAULT 0,
  -- Métadonnées.
  computed_by               text NOT NULL DEFAULT 'worker_analytics_v1',
  metadata                  jsonb DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, snapshot_period, period_type)
);

CREATE INDEX idx_analytics_snapshots_org_period
  ON business_analytics_snapshots (organization_id, period_type, snapshot_period DESC);
CREATE INDEX idx_analytics_snapshots_period
  ON business_analytics_snapshots (period_type, snapshot_period DESC);

COMMENT ON TABLE business_analytics_snapshots IS
  'Snapshots analytics business par cabinet et par période. Calculé par worker, lecture membre org.';

CREATE TRIGGER trg_analytics_snapshots_updated BEFORE UPDATE ON business_analytics_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE business_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- SELECT : membres de l'org uniquement.
CREATE POLICY "analytics_snapshots_member_read"
  ON business_analytics_snapshots FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

-- INSERT/UPDATE : worker (service_role) ou admin. Pas d'écriture user.
CREATE POLICY "analytics_snapshots_admin_insert"
  ON business_analytics_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "analytics_snapshots_admin_update"
  ON business_analytics_snapshots FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION business_analytics_snapshots
-- ============================================
