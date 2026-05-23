-- KOVAS — Sidebar preferences per user (refonte Linear-style 2026-05-23).
--
-- Stocke pour chaque user :
--  - main_items   : ordre + visibilité des items principaux (Zone 2/3)
--  - more_items   : ordre + visibilité des items du menu "Plus" (Zone 4)
--  - profile_preset : preset appliqué (solo_terrain / solo_admin / manager_cabinet) ou NULL si custom
--  - notification_style : 'count' (badge numérique) ou 'dot' (point chartreuse)
--  - sidebar_collapsed : sidebar en mode 64px icon-only (true) ou 240px étendue (false)
--
-- Format JSONB main_items / more_items :
--   [
--     { "id": "home",       "position": 0, "visible": true },
--     { "id": "dossiers",   "position": 1, "visible": true },
--     { "id": "messages",   "position": 2, "visible": false },
--     ...
--   ]
--
-- Le rendu lit `main_items` ordonnés par `position` puis `more_items`. Les items
-- sans préférence en base utilisent les valeurs par défaut hard-codées dans
-- apps/web/src/lib/sidebar/sidebar-items.ts.
--
-- RLS : un user ne peut lire/écrire QUE sa propre ligne.

CREATE TABLE IF NOT EXISTS sidebar_preferences (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  main_items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  more_items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_preset       text CHECK (profile_preset IN ('solo_terrain', 'solo_admin', 'manager_cabinet')),
  notification_style   text NOT NULL DEFAULT 'count' CHECK (notification_style IN ('count', 'dot')),
  sidebar_collapsed    boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sidebar_preferences_user_id_idx
  ON sidebar_preferences(user_id);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION sidebar_preferences_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sidebar_preferences_updated_at ON sidebar_preferences;
CREATE TRIGGER sidebar_preferences_updated_at
  BEFORE UPDATE ON sidebar_preferences
  FOR EACH ROW
  EXECUTE FUNCTION sidebar_preferences_touch_updated_at();

ALTER TABLE sidebar_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sidebar_preferences_own_select ON sidebar_preferences;
CREATE POLICY sidebar_preferences_own_select
  ON sidebar_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sidebar_preferences_own_insert ON sidebar_preferences;
CREATE POLICY sidebar_preferences_own_insert
  ON sidebar_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sidebar_preferences_own_update ON sidebar_preferences;
CREATE POLICY sidebar_preferences_own_update
  ON sidebar_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sidebar_preferences_own_delete ON sidebar_preferences;
CREATE POLICY sidebar_preferences_own_delete
  ON sidebar_preferences FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE sidebar_preferences IS
  'Préférences sidebar par user (refonte Linear-style 2026-05-23) : ordre items, profil preset, mode collapsed, style notifications.';
