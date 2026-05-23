-- ============================================================================
-- KOVAS — Mode mission tchat : photos rafale avec auto-association pièce
-- ============================================================================
-- Table dédiée au mode tchat IA (MISSION-B) — distincte du système legacy
-- `photos` (partitionné par mois, lié à `dossier_rooms.id` uuid). Ici, le
-- `room_id` est un texte libre car la sidebar pièces peut utiliser des slugs
-- temporaires côté client (ex: "salon", "cuisine") avant que les pièces
-- soient persistées en DB. C'est l'auto-association "lazy" — au fil de
-- l'eau dans le tchat, on n'a pas le temps de créer des dossier_rooms.
--
-- Authority : CLAUDE.md §3 features 2 (photos géolocalisées) + 10 (offline).
-- Friction terrain n°7 du brief Benjamin : photos orphelines → résolu via
-- room_id automatique depuis la sidebar active + GPS lat/lng + thumbnail
-- preview pour chat inline.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mission_photos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_session_id uuid NOT NULL REFERENCES mission_sessions(id) ON DELETE CASCADE,
  dossier_id         uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  -- Slug libre (sidebar pièce active) ou UUID dossier_rooms — résolu plus
  -- tard par le pipeline de consolidation. text plutôt qu'uuid pour la
  -- souplesse terrain.
  room_id            text,
  storage_path       text NOT NULL,
  storage_bucket     text NOT NULL DEFAULT 'mission-photos',
  -- Preview rapide sans hit Storage (data:image/jpeg;base64,...).
  -- Cap ~12KB par thumbnail 200×200 q=0.7 — soutenable pour la table.
  thumbnail_base64   text,
  -- Métadonnées capture (taken_at, latitude, longitude, accuracy_meters,
  -- device_orientation, etc.). Pattern jsonb pour évolutivité.
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Pipeline Claude Vision (V2 phase 2) — pour l'instant simple flag.
  ai_analyzed        boolean NOT NULL DEFAULT false,
  ai_extracted_data  jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_session
  ON mission_photos (mission_session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_mp_dossier
  ON mission_photos (dossier_id);

CREATE INDEX IF NOT EXISTS idx_mp_room
  ON mission_photos (mission_session_id, room_id)
  WHERE room_id IS NOT NULL;

COMMENT ON TABLE mission_photos IS
  'Mode mission tchat : photos rafale (terrain) avec auto-association pièce + GPS + thumbnail base64 pour preview chat inline. Cf. CLAUDE.md §3 feature 2 + MISSION-B.';

COMMENT ON COLUMN mission_photos.room_id IS
  'Slug pièce active (sidebar mission tchat) ou uuid dossier_rooms.id — text pour souplesse terrain (pièces pas toujours persistées en DB au moment capture).';

COMMENT ON COLUMN mission_photos.thumbnail_base64 IS
  'Preview 200×200 base64 ~12KB pour rendu chat sans hit Storage. Le blob original est en storage_path.';

COMMENT ON COLUMN mission_photos.metadata IS
  '{taken_at, latitude, longitude, accuracy_meters, device_orientation, perceptual_hash?, is_blurry?}';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

ALTER TABLE mission_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mp_own ON mission_photos;
CREATE POLICY mp_own ON mission_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_photos.mission_session_id
        AND public.is_member_of(ms.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mission_sessions ms
      WHERE ms.id = mission_photos.mission_session_id
        AND public.is_member_of(ms.organization_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Vue helper (debug / admin only — pas exposée client)
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public, anon;
