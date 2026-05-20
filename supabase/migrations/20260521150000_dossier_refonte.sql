-- ============================================
-- KOVAS — Refonte page dossier (V1.5 iteration)
-- ============================================
-- Authority : CLAUDE.md §3 (MVP V1) + refonte UI dossier (état visuel + exports + pièces suggérées).
--
-- Cette migration AJOUTE UNIQUEMENT (zero destructive) :
--   - table mission_sessions  : tracking pause/resume des missions sur un dossier
--   - table dossier_exports   : historique des exports (5 destinations)
--   - colonnes dossiers       : mission_started_at, validated_at, exported_count, property_rooms
--
-- IMPORTANT (anti-doublon, cf. CLAUDE.md tables existantes) :
--   - dossier_rooms          existe (renommé depuis mission_rooms) — on RÉFÉRENCE
--   - photos                 existe (partitionnée, FK omises côté code) — on ne touche pas
--   - voice_notes            existe — on ne touche pas
--   - dossier_field_values   existe (migration 20260520180000) — on ne touche pas
--   - dossiers/missions      existent — on EXTEND avec ADD COLUMN IF NOT EXISTS
--   - public.is_member_of    existe — utilisé pour RLS multi-tenant

-- ============================================
-- A. mission_sessions — pause/resume tracking
-- ============================================
CREATE TABLE IF NOT EXISTS mission_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id       uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  paused_at        timestamptz,
  current_room_id  uuid REFERENCES dossier_rooms(id) ON DELETE SET NULL,
  duration_seconds int,
  device_info      jsonb,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_sessions_dossier
  ON mission_sessions (dossier_id, started_at DESC);

COMMENT ON TABLE mission_sessions IS
  'Refonte dossier : tracking pause/resume des missions terrain (1 dossier = N sessions). Cf. CLAUDE.md.';

-- ============================================
-- B. dossier_exports — historique exports
-- ============================================
CREATE TABLE IF NOT EXISTS dossier_exports (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id               uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  destination              text NOT NULL CHECK (destination IN (
    'liciel_zip', 'pdf_reports', 'client_email', 'archive', 'raw_json_csv'
  )),
  was_complete             boolean NOT NULL,
  missing_fields_count     int NOT NULL DEFAULT 0,
  missing_fields_snapshot  jsonb,
  recipient                text,
  storage_path             text,
  download_token           text,
  expires_at               timestamptz,
  downloaded_at            timestamptz,
  download_count           int NOT NULL DEFAULT 0,
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dossier_exports_dossier
  ON dossier_exports (dossier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dossier_exports_token
  ON dossier_exports (download_token)
  WHERE download_token IS NOT NULL;

COMMENT ON TABLE dossier_exports IS
  'Refonte dossier : historique des exports (5 destinations Liciel/PDF/Email/Archive/Raw). Cf. CLAUDE.md §3 feature 8-9.';

-- ============================================
-- C. dossiers — colonnes additionnelles
-- ============================================
ALTER TABLE dossiers
  ADD COLUMN IF NOT EXISTS mission_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_at       timestamptz,
  ADD COLUMN IF NOT EXISTS exported_count     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS property_rooms     jsonb;

COMMENT ON COLUMN dossiers.mission_started_at IS
  'Refonte dossier : 1er démarrage de mission terrain (résolveur d''état visuel).';
COMMENT ON COLUMN dossiers.validated_at IS
  'Refonte dossier : timestamp de validation manuelle avant export (résolveur d''état visuel).';
COMMENT ON COLUMN dossiers.exported_count IS
  'Refonte dossier : compteur d''exports (synchronisé via trigger sur dossier_exports).';
COMMENT ON COLUMN dossiers.property_rooms IS
  'Refonte dossier : snapshot des pièces du bien — [{ id, name, type, floor? }] — pour suggérer les pièces non visitées.';

-- ============================================
-- D. Trigger : incrémente dossiers.exported_count à chaque insert dans dossier_exports
-- ============================================
CREATE OR REPLACE FUNCTION public.bump_dossier_exported_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE dossiers
     SET exported_count = exported_count + 1
   WHERE id = NEW.dossier_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dossier_exports_bump_count ON dossier_exports;
CREATE TRIGGER trg_dossier_exports_bump_count
  AFTER INSERT ON dossier_exports
  FOR EACH ROW EXECUTE FUNCTION public.bump_dossier_exported_count();

-- ============================================
-- E. RLS — multi-tenant via public.is_member_of
-- ============================================
ALTER TABLE mission_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_sessions_all" ON mission_sessions;
CREATE POLICY "mission_sessions_all" ON mission_sessions
  FOR ALL
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

ALTER TABLE dossier_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_exports_all" ON dossier_exports;
CREATE POLICY "dossier_exports_all" ON dossier_exports
  FOR ALL
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ============================================
-- F. Realtime (utile pour live update timeline dossier)
-- ============================================
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_sessions';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dossier_exports';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
