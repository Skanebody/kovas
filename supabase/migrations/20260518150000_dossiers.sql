-- ============================================
-- KOVAS — Refonte : entité Dossier (visite)
-- Cf. CLAUDE.md §3 — 80% des visites = N diagnostics sur 1 propriété
-- ============================================
-- Cette migration est destructive sur les données de test (validée par user).
-- Production : à appliquer AVANT toute donnée réelle.

-- ============================================
-- 1. Wipe data legacy (test data)
-- ============================================
TRUNCATE TABLE ai_usage CASCADE;
TRUNCATE TABLE vision_corrections CASCADE;
TRUNCATE TABLE voice_notes CASCADE;
TRUNCATE TABLE equipment_findings CASCADE;
TRUNCATE TABLE photos CASCADE;
TRUNCATE TABLE owner_documents CASCADE;
TRUNCATE TABLE mission_rooms CASCADE;
TRUNCATE TABLE missions CASCADE;
DELETE FROM cabinet_trials;
DELETE FROM reference_counters;

-- ============================================
-- 2. next_reference accepte 'dossier' → DOS-YYYY-XXXXX
-- ============================================
CREATE OR REPLACE FUNCTION public.next_reference(p_org uuid, p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now());
  v_next bigint;
  v_prefix text := CASE p_kind
    WHEN 'invoice' THEN 'FAC'
    WHEN 'quote' THEN 'DEV'
    WHEN 'dossier' THEN 'DOS'
    ELSE 'MIS'
  END;
BEGIN
  INSERT INTO reference_counters (organization_id, kind, year, last_value)
  VALUES (p_org, p_kind, v_year, 1)
  ON CONFLICT (organization_id, kind, year)
  DO UPDATE SET last_value = reference_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN v_prefix || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
END $$;

-- ============================================
-- 3. Création table dossiers (entité parent)
-- ============================================
CREATE TABLE IF NOT EXISTS dossiers (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id              uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  client_id                uuid REFERENCES clients(id) ON DELETE SET NULL,
  reference                text NOT NULL UNIQUE,                       -- DOS-2026-00001
  -- Workflow dates
  scheduled_at             timestamptz,
  started_at               timestamptz,                                -- 1er passage en 'on_site'
  completed_at             timestamptz,                                -- tous diags terminés
  -- Statut global du dossier
  status                   text NOT NULL DEFAULT 'draft',
  CHECK (status IN ('draft', 'scheduled', 'on_site', 'back_office', 'done', 'archived', 'cancelled')),
  -- Lien upload client (anciennement sur missions)
  client_upload_token      text UNIQUE,
  client_upload_expires_at timestamptz,
  -- Workflow state (étapes du stepper, items cochés manuellement, etc.)
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                    text,
  -- Responsabilité
  assigned_to              uuid REFERENCES auth.users(id),
  created_by               uuid REFERENCES auth.users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dossiers_org ON dossiers (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dossiers_property ON dossiers (property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dossiers_client ON dossiers (client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dossiers_upload_token ON dossiers (client_upload_token) WHERE client_upload_token IS NOT NULL;

-- ============================================
-- 4. Refactor tables enfants : mission_id → dossier_id
-- ============================================

-- mission_rooms → dossier_rooms
ALTER TABLE mission_rooms RENAME TO dossier_rooms;
ALTER TABLE dossier_rooms DROP CONSTRAINT IF EXISTS mission_rooms_mission_id_fkey;
ALTER TABLE dossier_rooms RENAME COLUMN mission_id TO dossier_id;
ALTER TABLE dossier_rooms ADD CONSTRAINT dossier_rooms_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- photos
ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_mission_id_fkey;
ALTER TABLE photos RENAME COLUMN mission_id TO dossier_id;
ALTER TABLE photos ADD CONSTRAINT photos_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- voice_notes
ALTER TABLE voice_notes DROP CONSTRAINT IF EXISTS voice_notes_mission_id_fkey;
ALTER TABLE voice_notes RENAME COLUMN mission_id TO dossier_id;
ALTER TABLE voice_notes ADD CONSTRAINT voice_notes_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- owner_documents
ALTER TABLE owner_documents DROP CONSTRAINT IF EXISTS owner_documents_mission_id_fkey;
ALTER TABLE owner_documents RENAME COLUMN mission_id TO dossier_id;
ALTER TABLE owner_documents ADD CONSTRAINT owner_documents_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- equipment_findings
ALTER TABLE equipment_findings DROP CONSTRAINT IF EXISTS equipment_findings_mission_id_fkey;
ALTER TABLE equipment_findings RENAME COLUMN mission_id TO dossier_id;
ALTER TABLE equipment_findings ADD CONSTRAINT equipment_findings_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- ai_usage: mission_id stays (utile pour analyse par diag, peut être null)
-- Ne touche pas.

-- ============================================
-- 5. Refactor missions : devient une "facette" du dossier
-- ============================================
-- On enlève les colonnes qui vivent maintenant sur le dossier
ALTER TABLE missions ADD COLUMN dossier_id uuid;

-- Note : les missions sont vides (TRUNCATE plus haut), donc on peut faire NOT NULL direct
-- avec une FK fresh.
ALTER TABLE missions ADD CONSTRAINT missions_dossier_id_fkey
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE;

-- Drop les colonnes redondantes (vivent maintenant sur dossiers)
ALTER TABLE missions DROP COLUMN IF EXISTS property_id;
ALTER TABLE missions DROP COLUMN IF EXISTS client_id;
ALTER TABLE missions DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE missions DROP COLUMN IF EXISTS started_at;
ALTER TABLE missions DROP COLUMN IF EXISTS client_upload_token;
ALTER TABLE missions DROP COLUMN IF EXISTS client_upload_expires_at;

-- Maintenant dossier_id devient obligatoire
ALTER TABLE missions ALTER COLUMN dossier_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_missions_dossier ON missions (dossier_id);

-- ============================================
-- 6. RLS dossiers
-- ============================================
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossiers: org members read" ON dossiers;
CREATE POLICY "dossiers: org members read"
  ON dossiers FOR SELECT
  USING (public.is_member_of(organization_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "dossiers: org members create" ON dossiers;
CREATE POLICY "dossiers: org members create"
  ON dossiers FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "dossiers: org members update" ON dossiers;
CREATE POLICY "dossiers: org members update"
  ON dossiers FOR UPDATE
  USING (public.is_member_of(organization_id));

-- ============================================
-- 7. Trigger updated_at
-- ============================================
DROP TRIGGER IF EXISTS dossiers_set_updated_at ON dossiers;
CREATE TRIGGER dossiers_set_updated_at
  BEFORE UPDATE ON dossiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 8. Activer Realtime sur dossiers
-- ============================================
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dossiers';
EXCEPTION WHEN duplicate_object THEN
  -- already in publication
  NULL;
END $$;
