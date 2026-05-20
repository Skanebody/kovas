-- ============================================
-- KOVAS — Scheduling backend (Phase A)
-- ============================================
-- Geocoding cache permanent (BAN) + routes cache (ORS / Haversine 1h TTL)
-- Historique durée mission (estimé vs réel) + coefficients personnels par user
-- Alertes quota DPE 1000/an + extension table dossiers (lat/lng, durée, params)
-- Authority : CLAUDE.md §3 features 1-2-10 + briefing scheduling 2026-05-20.
-- ============================================

-- ============================================
-- A. geocoding_cache (permanent : adresse ne change pas)
-- ============================================
CREATE TABLE IF NOT EXISTS geocoding_cache (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_normalized text NOT NULL UNIQUE,
  raw_address        text NOT NULL,
  geo_lat            numeric(10, 7) NOT NULL,
  geo_lng            numeric(10, 7) NOT NULL,
  city               text,
  postal_code        text,
  country            text DEFAULT 'FR',
  provider           text DEFAULT 'ban',
  confidence         numeric(3, 2),
  hit_count          int NOT NULL DEFAULT 1,
  last_used_at       timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocoding_normalized
  ON geocoding_cache(address_normalized);

-- ============================================
-- B. routes_cache (TTL 1h : trafic varie)
-- ============================================
CREATE TABLE IF NOT EXISTS routes_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key        text NOT NULL UNIQUE,
  distance_meters  numeric(10, 2) NOT NULL,
  duration_seconds int NOT NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_cache_key ON routes_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_routes_cache_expires ON routes_cache(expires_at);

-- ============================================
-- C. mission_duration_history (apprentissage estimé vs réel)
-- ============================================
CREATE TABLE IF NOT EXISTS mission_duration_history (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id               uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  estimated_duration_min   int NOT NULL,
  estimation_factors       jsonb,
  actual_duration_min      int,
  diff_min                 int GENERATED ALWAYS AS (actual_duration_min - estimated_duration_min) STORED,
  created_at               timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_duration_history_user
  ON mission_duration_history(user_id, completed_at);

-- ============================================
-- D. user_duration_coefficients (coef perso après 10+ missions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_duration_coefficients (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  global_coefficient  numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_dpe            numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_amiante        numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_plomb          numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_gaz            numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_elec           numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_termites       numeric(4, 3) NOT NULL DEFAULT 1.000,
  coef_carrez         numeric(4, 3) NOT NULL DEFAULT 1.000,
  sample_size_total   int NOT NULL DEFAULT 0,
  enabled             boolean NOT NULL DEFAULT false,
  last_calculated_at  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- E. dpe_quota_alerts (tracking alertes envoyées, dedup)
-- ============================================
CREATE TABLE IF NOT EXISTS dpe_quota_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dpe_count       int NOT NULL,
  percent_used    numeric(5, 2) NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  acknowledged_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpe_alerts_user
  ON dpe_quota_alerts(user_id, created_at DESC);

-- ============================================
-- F. Colonnes additionnelles dossiers (scheduling)
-- ============================================
ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS geo_lat                  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS geo_lng                  numeric(10, 7),
  ADD COLUMN IF NOT EXISTS estimated_duration_min   int,
  ADD COLUMN IF NOT EXISTS forced_duration_min      int,
  ADD COLUMN IF NOT EXISTS actual_duration_min      int,
  ADD COLUMN IF NOT EXISTS property_type_scheduling text,
  ADD COLUMN IF NOT EXISTS ownership                text,
  ADD COLUMN IF NOT EXISTS has_garage               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_sous_sol             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_combles_amenagees    boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dossiers_geo
  ON dossiers(geo_lat, geo_lng) WHERE geo_lat IS NOT NULL;

-- ============================================
-- G. user_preferences : ajouter colonnes scheduling
-- ============================================
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS scheduling_buffer_minutes      int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS auto_clustering_suggestions    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS skip_weekends                  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS personal_coefficient_enabled   boolean NOT NULL DEFAULT false;

-- ============================================
-- H. RLS
-- ============================================
-- mission_duration_history : RLS multi-tenant via organization_id
ALTER TABLE mission_duration_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duration_history_org" ON mission_duration_history;
CREATE POLICY "duration_history_org" ON mission_duration_history
  FOR ALL
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- user_duration_coefficients : self-only
ALTER TABLE user_duration_coefficients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duration_coef_self" ON user_duration_coefficients;
CREATE POLICY "duration_coef_self" ON user_duration_coefficients
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- dpe_quota_alerts : lecture self-only
ALTER TABLE dpe_quota_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpe_alerts_self" ON dpe_quota_alerts;
CREATE POLICY "dpe_alerts_self" ON dpe_quota_alerts
  FOR SELECT
  USING (user_id = auth.uid());

-- geocoding_cache + routes_cache : pas de RLS user-scoped
-- (cache anonymisé, lecture/écriture par tout authentifié).
ALTER TABLE geocoding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geocoding_cache_read_auth" ON geocoding_cache;
CREATE POLICY "geocoding_cache_read_auth" ON geocoding_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "geocoding_cache_write_auth" ON geocoding_cache;
CREATE POLICY "geocoding_cache_write_auth" ON geocoding_cache
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "geocoding_cache_update_auth" ON geocoding_cache;
CREATE POLICY "geocoding_cache_update_auth" ON geocoding_cache
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "routes_cache_read_auth" ON routes_cache;
CREATE POLICY "routes_cache_read_auth" ON routes_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "routes_cache_write_auth" ON routes_cache;
CREATE POLICY "routes_cache_write_auth" ON routes_cache
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
