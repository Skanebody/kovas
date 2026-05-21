-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — ademe_kpi_snapshots
--
-- Snapshots journaliers/hebdo/mensuels des KPIs ADEME du cabinet :
-- distribution étiquettes (A→G), volumes, anomalies, taux d'erreur, etc.
-- Alimente le Cockpit ADEME (vue agrégée Phase 2 préparation).
--
-- Multi-tenant : agrégation au niveau organization (un cabinet de 3 diags
-- partage les KPIs). Le numéro de certificat RGE reste lié au diagnostiqueur
-- (user_id) car chacun a son propre certificat.
-- ============================================

CREATE TABLE IF NOT EXISTS ademe_kpi_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  certificat_number     text,                            -- numéro RGE diag (non unique : multi-diag/cabinet)
  snapshot_date         date NOT NULL,                   -- date d'agrégation (jour)
  period                text NOT NULL DEFAULT 'daily'    -- daily | weekly | monthly
                          CHECK (period IN ('daily','weekly','monthly')),

  -- Distribution étiquettes DPE (A→G)
  count_a               int NOT NULL DEFAULT 0,
  count_b               int NOT NULL DEFAULT 0,
  count_c               int NOT NULL DEFAULT 0,
  count_d               int NOT NULL DEFAULT 0,
  count_e               int NOT NULL DEFAULT 0,
  count_f               int NOT NULL DEFAULT 0,
  count_g               int NOT NULL DEFAULT 0,

  -- Distribution étiquettes GES (A→G)
  ges_count_a           int NOT NULL DEFAULT 0,
  ges_count_b           int NOT NULL DEFAULT 0,
  ges_count_c           int NOT NULL DEFAULT 0,
  ges_count_d           int NOT NULL DEFAULT 0,
  ges_count_e           int NOT NULL DEFAULT 0,
  ges_count_f           int NOT NULL DEFAULT 0,
  ges_count_g           int NOT NULL DEFAULT 0,

  -- Volume & anomalies
  total_dpe             int NOT NULL DEFAULT 0,
  total_published       int NOT NULL DEFAULT 0,
  total_anomalies       int NOT NULL DEFAULT 0,
  total_corrections     int NOT NULL DEFAULT 0,
  error_rate            numeric(6,4) NOT NULL DEFAULT 0, -- 0-1 float (convention KOVAS)

  -- Mesures dérivées (KPIs cockpit)
  avg_surface_m2        numeric(8,2),
  avg_energy_value      numeric(8,2),                    -- kWh/m².an
  avg_ges_value         numeric(8,2),                    -- kgCO2/m².an

  -- Métadonnées audit
  computed_at           timestamptz NOT NULL DEFAULT now(),
  source                text NOT NULL DEFAULT 'internal',-- internal | ademe_api | hybrid
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, snapshot_date, period, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ademe_kpi_org_date
  ON ademe_kpi_snapshots (organization_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ademe_kpi_user
  ON ademe_kpi_snapshots (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_kpi_certificat
  ON ademe_kpi_snapshots (certificat_number) WHERE certificat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ademe_kpi_period
  ON ademe_kpi_snapshots (organization_id, period, snapshot_date DESC);

COMMENT ON TABLE ademe_kpi_snapshots IS
  'Snapshots agrégés (journaliers/hebdo/mensuels) des KPIs ADEME du cabinet : distribution étiquettes DPE/GES, volumes, taux anomalies. Alimente le Cockpit ADEME Phase 2.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ademe_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ademe_kpi_snapshots"
  ON ademe_kpi_snapshots FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert ademe_kpi_snapshots"
  ON ademe_kpi_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update ademe_kpi_snapshots"
  ON ademe_kpi_snapshots FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete ademe_kpi_snapshots"
  ON ademe_kpi_snapshots FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
