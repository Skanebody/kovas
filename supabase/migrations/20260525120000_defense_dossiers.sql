-- ============================================
-- KOVAS — Module 3 (Bouclier de défense) — defense_dossiers
--
-- Dossier de défense rattaché à une mission : preuves photographiques,
-- horodatage géolocalisé, transcriptions vocales, signatures, journal
-- d'événements, score de robustesse. Pivot d'une éventuelle contestation
-- (litige RCP, réclamation client, procédure judiciaire).
-- ============================================

CREATE TABLE IF NOT EXISTS defense_dossiers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mission_id            uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- diag responsable

  reference             text,                            -- ex: DEF-2026-00012 (per-org seq applicatif)
  status                text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','sealed','in_review','locked','archived')),

  -- Score robustesse (calculé applicatif)
  robustness_score      numeric(4,3),                    -- 0-1 float
  evidence_count        int NOT NULL DEFAULT 0,
  photos_geo_count      int NOT NULL DEFAULT 0,          -- photos avec geo
  voice_notes_count     int NOT NULL DEFAULT 0,
  signatures_count      int NOT NULL DEFAULT 0,

  -- Snapshot des éléments archivés (chemins Storage, hashes, dates)
  evidence_manifest     jsonb NOT NULL DEFAULT '[]'::jsonb,
                                                         -- [{ "kind": "photo", "id": "...", "hash": "...",
                                                         --    "captured_at": "...", "geo": {...} }, ...]

  -- Sealing (verrouillage horodaté du dossier)
  sealed_at             timestamptz,
  sealed_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sealed_hash           text,                            -- SHA-256 du manifest au scellement
  sealed_storage_path   text,                            -- archive ZIP scellée

  notes                 text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_defense_dossiers_org
  ON defense_dossiers (organization_id);
CREATE INDEX IF NOT EXISTS idx_defense_dossiers_mission
  ON defense_dossiers (mission_id);
CREATE INDEX IF NOT EXISTS idx_defense_dossiers_user
  ON defense_dossiers (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_defense_dossiers_status
  ON defense_dossiers (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_defense_dossiers_reference
  ON defense_dossiers (reference) WHERE reference IS NOT NULL;

COMMENT ON TABLE defense_dossiers IS
  'Dossier de défense par mission : preuves (photos géo, vocal, signatures), manifest scellé, score de robustesse. Pivot d''une contestation litige RCP / réclamation client.';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE defense_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read defense_dossiers"
  ON defense_dossiers FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));

CREATE POLICY "members insert defense_dossiers"
  ON defense_dossiers FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members update defense_dossiers"
  ON defense_dossiers FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

CREATE POLICY "members delete defense_dossiers"
  ON defense_dossiers FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id));
