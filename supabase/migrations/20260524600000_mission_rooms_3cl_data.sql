-- ============================================
-- KOVAS — Pipeline sync background mission (MISSION-D)
-- ============================================
-- Authority : CLAUDE.md §3 feature 1 (saisie vocale terrain), §10 (offline complet).
--
-- Crée :
--   - table mission_rooms_3cl_data : pièces 3CL structurées (post-IA + post-validation user)
--   - colonnes mission_sessions : payload_processed, last_sync_attempt, sync_status, sync_error
--   - INDEX retry-cron compatibles
--
-- Zero destructive — ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

-- ----------------------------------------------------------------------------
-- A. mission_rooms_3cl_data : 30-40 champs 3CL structurés par pièce
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_rooms_3cl_data (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_session_id   uuid NOT NULL REFERENCES mission_sessions(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_name            text NOT NULL,
  room_type            text NOT NULL,
  surface_sqm          numeric(8,2),
  ceiling_height_m     numeric(4,2),
  orientation          text,
  -- Bloc principal 3CL — contient les 30-40 champs structurés
  -- (windows[], walls{}, floor{}, heating_emitters[], lighting{}, ventilation{}, etc.)
  data_3cl             jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_confidence_score  numeric(4,3),
  source               text NOT NULL DEFAULT 'ai_extracted'
    CHECK (source IN ('ai_extracted', 'user_validated', 'user_corrected')),
  validated_by_user    boolean NOT NULL DEFAULT false,
  validated_at         timestamptz,
  validated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mr3d_session
  ON mission_rooms_3cl_data (mission_session_id);
CREATE INDEX IF NOT EXISTS idx_mr3d_validation
  ON mission_rooms_3cl_data (validated_by_user, mission_session_id);
CREATE INDEX IF NOT EXISTS idx_mr3d_org
  ON mission_rooms_3cl_data (organization_id, created_at DESC);

COMMENT ON TABLE mission_rooms_3cl_data IS
  'Pipeline sync mission : pièces 3CL structurées par Claude tool use + validation user. Cf. CLAUDE.md §3 feature 1.';

ALTER TABLE mission_rooms_3cl_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mr3d_all ON mission_rooms_3cl_data;
CREATE POLICY mr3d_all ON mission_rooms_3cl_data
  FOR ALL
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_mission_rooms_3cl_data()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_mr3d ON mission_rooms_3cl_data;
CREATE TRIGGER trg_touch_mr3d
  BEFORE UPDATE ON mission_rooms_3cl_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_mission_rooms_3cl_data();

-- ----------------------------------------------------------------------------
-- B. mission_sessions : colonnes pipeline sync background
-- ----------------------------------------------------------------------------
ALTER TABLE mission_sessions
  ADD COLUMN IF NOT EXISTS payload_processed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_attempt timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'queued', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_attempts_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN mission_sessions.payload_processed IS
  'Pipeline sync : true quand Edge Function process-mission-payload a fini avec succès.';
COMMENT ON COLUMN mission_sessions.last_sync_attempt IS
  'Pipeline sync : timestamp dernière tentative (utilisé par cron retry).';
COMMENT ON COLUMN mission_sessions.sync_status IS
  'Pipeline sync : idle / queued / processing / completed / failed.';

-- Index pour cron retry-sync : trouver les sessions ratées il y a > 1h
CREATE INDEX IF NOT EXISTS idx_mission_sessions_sync_retry
  ON mission_sessions (sync_status, last_sync_attempt)
  WHERE payload_processed = false AND sync_status IN ('failed', 'queued');

-- ----------------------------------------------------------------------------
-- C. Cache Claude Vision : éviter re-analyse de la même photo
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vision_analysis_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perceptual_hash     text NOT NULL UNIQUE,
  analysis_result     jsonb NOT NULL,
  model_used          text NOT NULL,
  tokens_in           int,
  tokens_out          int,
  created_at          timestamptz NOT NULL DEFAULT now(),
  reused_count        int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vision_cache_phash ON vision_analysis_cache (perceptual_hash);

COMMENT ON TABLE vision_analysis_cache IS
  'Cache Claude Vision indexé sur perceptual_hash photo : évite re-payer analyse identique. Cf. CLAUDE.md §7bis.';

ALTER TABLE vision_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Pas d'accès direct utilisateur : seulement service_role via Edge Function.
DROP POLICY IF EXISTS vac_service_only ON vision_analysis_cache;
CREATE POLICY vac_service_only ON vision_analysis_cache
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- D. Realtime — dossier page peut suivre la progression
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_rooms_3cl_data';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
