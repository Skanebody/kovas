-- ============================================
-- KOVAS — Type de vue par photo (convention nommage)
-- Cf. docs/file-naming-convention.md §3 + J18.5
-- ============================================

ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS view_type text;

COMMENT ON COLUMN photos.view_type IS
  'Type de vue prédéfini : vue_generale | fenetre_nord | radiateur | chaudiere | tableau_electrique | anomalie | etc. Cf. lib/photo-view-types.ts';

CREATE INDEX IF NOT EXISTS idx_photos_view_type ON photos (organization_id, view_type) WHERE view_type IS NOT NULL;
