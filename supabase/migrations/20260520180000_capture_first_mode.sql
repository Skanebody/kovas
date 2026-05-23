-- ============================================
-- KOVAS — Capture-First mode (V1.5 iteration 1, fondations)
-- ============================================
-- Pattern "Capture-First" : tap photo → fenêtre 3-4s pour ajouter note vocale/texte
-- → IA structure tout à la fin de mission.
--
-- Cette migration N'AJOUTE QUE des colonnes / tables. ZERO destructive.
-- Elle ETEND `photos` et `voice_notes` existantes (cf. CLAUDE.md "ne pas dupliquer").
-- Toutes les FK vers `photos` sont OMISES car table partitionnée (clef composite id+created_at)
-- → l'app vérifie l'intégrité référentielle côté code.
--
-- Authority: CLAUDE.md §3 (MVP V1 features 1-2-10) + iteration 1 refonte mode terrain.

-- ============================================
-- A. EXTEND photos (partitionnée mensuel)
-- ============================================
-- ALTER fonctionne sur la table mère depuis PG12 et propage aux partitions enfants.
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS perceptual_hash text,
  ADD COLUMN IF NOT EXISTS is_blurry boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_duplicate_of uuid,
  -- pas de FK is_duplicate_of -> photos.id (table partitionnée, clef composite)
  ADD COLUMN IF NOT EXISTS device_info jsonb,
  ADD COLUMN IF NOT EXISTS gps_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS gps_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS vision_status text DEFAULT 'pending'
    CHECK (vision_status IN (
      'pending', 'processing', 'analyzed', 'failed',
      'skipped_duplicate', 'skipped_blurry', 'skipped_irrelevant'
    )),
  ADD COLUMN IF NOT EXISTS vision_analysis jsonb,
  ADD COLUMN IF NOT EXISTS vision_confidence numeric(3, 2),
  ADD COLUMN IF NOT EXISTS vision_model text,
  ADD COLUMN IF NOT EXISTS vision_cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_photos_vision_status
  ON photos (vision_status)
  WHERE vision_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_photos_phash
  ON photos (substring(perceptual_hash, 1, 12))
  WHERE perceptual_hash IS NOT NULL;

-- ============================================
-- B. EXTEND voice_notes
-- ============================================
ALTER TABLE voice_notes
  ADD COLUMN IF NOT EXISTS transcription_status text DEFAULT 'pending'
    CHECK (transcription_status IN (
      'pending', 'processing', 'transcribed', 'failed', 'skipped'
    )),
  ADD COLUMN IF NOT EXISTS transcription_confidence numeric(3, 2),
  ADD COLUMN IF NOT EXISTS transcription_model text,
  ADD COLUMN IF NOT EXISTS transcription_cost_usd numeric(10, 6),
  ADD COLUMN IF NOT EXISTS edited_transcription text,
  ADD COLUMN IF NOT EXISTS transcribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attached_photo_id uuid;
  -- pas de FK -> photos (table partitionnée). L'app vérifie.

CREATE INDEX IF NOT EXISTS idx_voice_notes_attached_photo
  ON voice_notes (attached_photo_id)
  WHERE attached_photo_id IS NOT NULL;

-- ============================================
-- C. mission_text_notes (annotations texte rapides post-capture)
-- ============================================
CREATE TABLE IF NOT EXISTS mission_text_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id        uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  attached_photo_id uuid,                                                   -- pas de FK partitioning
  room_id           uuid REFERENCES dossier_rooms(id) ON DELETE SET NULL,   -- table réelle = dossier_rooms
  text              text NOT NULL,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_text_notes_dossier
  ON mission_text_notes (dossier_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_text_notes_photo
  ON mission_text_notes (attached_photo_id)
  WHERE attached_photo_id IS NOT NULL;

-- ============================================
-- D. dossier_field_values (consolidation IA → champs structurés)
-- ============================================
CREATE TABLE IF NOT EXISTS dossier_field_values (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dossier_id          uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  diagnostic_type     text NOT NULL CHECK (diagnostic_type IN (
    'DPE', 'AMIANTE', 'PLOMB', 'GAZ', 'ELEC', 'TERMITES', 'CARREZ', 'ERP'
  )),
  field_path          text NOT NULL,                              -- ex: "enveloppe.isolation_combles.epaisseur_cm"
  value               jsonb NOT NULL,
  unit                text,
  source_type         text NOT NULL CHECK (source_type IN (
    'photo_vision', 'voice_extraction', 'text_extraction', 'document_ocr',
    'manual_entry', 'imported_liciel', 'inferred_ai', 'calculated'
  )),
  source_photo_id     uuid,                                       -- pas de FK partitioning
  source_voice_id     uuid REFERENCES voice_notes(id) ON DELETE SET NULL,
  source_text_id      uuid REFERENCES mission_text_notes(id) ON DELETE SET NULL,
  source_document_id  uuid REFERENCES owner_documents(id) ON DELETE SET NULL,
  confidence          numeric(3, 2),
  validated_by_user   boolean DEFAULT false,
  validated_at        timestamptz,
  manually_edited_at  timestamptz,
  has_conflict        boolean DEFAULT false,
  conflict_resolution text CHECK (conflict_resolution IS NULL OR conflict_resolution IN (
    'resolved_keep_this', 'resolved_keep_other', 'resolved_custom'
  )),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, diagnostic_type, field_path)
);

CREATE INDEX IF NOT EXISTS idx_field_values_dossier_diag
  ON dossier_field_values (dossier_id, diagnostic_type);

CREATE INDEX IF NOT EXISTS idx_field_values_conflicts
  ON dossier_field_values (dossier_id)
  WHERE has_conflict = true;

CREATE TABLE IF NOT EXISTS dossier_field_value_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_value_id  uuid NOT NULL REFERENCES dossier_field_values(id) ON DELETE CASCADE,
  previous_value  jsonb,
  new_value       jsonb,
  changed_by      uuid REFERENCES auth.users(id),
  changed_by_user boolean,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_history_field
  ON dossier_field_value_history (field_value_id);

-- ============================================
-- E. vision_cache (cross-user, anonymisé — pas de PII)
-- ============================================
CREATE TABLE IF NOT EXISTS vision_cache (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perceptual_hash_prefix text NOT NULL,                          -- 12 premiers chars du pHash
  full_hash              text NOT NULL,
  diagnostics_signature  text NOT NULL,                          -- hash trié des diag types
  analysis               jsonb NOT NULL,
  hit_count              int NOT NULL DEFAULT 0,
  cost_savings_usd       numeric(10, 6) DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL DEFAULT (now() + interval '180 days')
);

-- NB : pas de WHERE expires_at > now() — now() est STABLE, pas IMMUTABLE,
-- donc interdit en index predicate. L'index complet est suffisamment sélectif.
CREATE INDEX IF NOT EXISTS idx_vision_cache_lookup
  ON vision_cache (perceptual_hash_prefix, diagnostics_signature, expires_at);

-- ============================================
-- F. user_preferences (vérifie d'abord si n'existe pas)
-- ============================================
-- N'existe pas encore au 2026-05-20 dans les migrations versionnées, on la crée.
CREATE TABLE IF NOT EXISTS user_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  terrain_mode        text NOT NULL DEFAULT 'capture'
    CHECK (terrain_mode IN ('capture', 'classic')),
  whisper_mode        text NOT NULL DEFAULT 'auto'
    CHECK (whisper_mode IN ('local', 'api', 'auto')),
  vision_cache_opt_in boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- G. RLS policies
-- ============================================

-- mission_text_notes
ALTER TABLE mission_text_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_text_notes: org members read" ON mission_text_notes;
CREATE POLICY "mission_text_notes: org members read"
  ON mission_text_notes FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_text_notes: org members write" ON mission_text_notes;
CREATE POLICY "mission_text_notes: org members write"
  ON mission_text_notes FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_text_notes: org members update" ON mission_text_notes;
CREATE POLICY "mission_text_notes: org members update"
  ON mission_text_notes FOR UPDATE
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_text_notes: org members delete" ON mission_text_notes;
CREATE POLICY "mission_text_notes: org members delete"
  ON mission_text_notes FOR DELETE
  USING (public.is_member_of(organization_id));

-- dossier_field_values
ALTER TABLE dossier_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_field_values: org members read" ON dossier_field_values;
CREATE POLICY "dossier_field_values: org members read"
  ON dossier_field_values FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "dossier_field_values: org members write" ON dossier_field_values;
CREATE POLICY "dossier_field_values: org members write"
  ON dossier_field_values FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "dossier_field_values: org members update" ON dossier_field_values;
CREATE POLICY "dossier_field_values: org members update"
  ON dossier_field_values FOR UPDATE
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "dossier_field_values: org members delete" ON dossier_field_values;
CREATE POLICY "dossier_field_values: org members delete"
  ON dossier_field_values FOR DELETE
  USING (public.is_member_of(organization_id));

-- dossier_field_value_history (lecture via field_value rattaché → on contrôle via subquery)
ALTER TABLE dossier_field_value_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dossier_field_value_history: org members read" ON dossier_field_value_history;
CREATE POLICY "dossier_field_value_history: org members read"
  ON dossier_field_value_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dossier_field_values dfv
      WHERE dfv.id = dossier_field_value_history.field_value_id
        AND public.is_member_of(dfv.organization_id)
    )
  );

DROP POLICY IF EXISTS "dossier_field_value_history: org members write" ON dossier_field_value_history;
CREATE POLICY "dossier_field_value_history: org members write"
  ON dossier_field_value_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dossier_field_values dfv
      WHERE dfv.id = dossier_field_value_history.field_value_id
        AND public.is_member_of(dfv.organization_id)
    )
  );

-- user_preferences (RLS par user_id)
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences: self read" ON user_preferences;
CREATE POLICY "user_preferences: self read"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences: self insert" ON user_preferences;
CREATE POLICY "user_preferences: self insert"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_preferences: self update" ON user_preferences;
CREATE POLICY "user_preferences: self update"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- vision_cache (lecture publique authentifiée, contenu anonymisé)
ALTER TABLE vision_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vision_cache: authenticated read" ON vision_cache;
CREATE POLICY "vision_cache: authenticated read"
  ON vision_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated.
-- Seul le service-role (Edge Function vision-analyzer) écrit dans vision_cache.
-- service-role bypasse RLS par design Supabase.

-- ============================================
-- H. updated_at triggers (réutilise la convention du repo)
-- ============================================
DROP TRIGGER IF EXISTS set_updated_at_mission_text_notes ON mission_text_notes;
CREATE TRIGGER set_updated_at_mission_text_notes
  BEFORE UPDATE ON mission_text_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_dossier_field_values ON dossier_field_values;
CREATE TRIGGER set_updated_at_dossier_field_values
  BEFORE UPDATE ON dossier_field_values
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_user_preferences ON user_preferences;
CREATE TRIGGER set_updated_at_user_preferences
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE mission_text_notes IS
  'V1.5 Capture-First: notes texte rapides post-photo (3-4s window). Cf. CLAUDE.md.';
COMMENT ON TABLE dossier_field_values IS
  'V1.5 Capture-First: champs structurés consolidés par IA (photo Vision + voix + texte + docs).';
COMMENT ON TABLE vision_cache IS
  'V1.5 Capture-First: cache cross-user des analyses Vision (anonymisé par pHash, pas de PII).';
COMMENT ON TABLE user_preferences IS
  'V1.5 Capture-First: prefs utilisateur (terrain_mode capture/classic, whisper_mode, vision_cache opt-in).';
