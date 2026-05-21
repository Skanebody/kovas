-- ============================================
-- KOVAS — Storage tracking & quota enforcement par organisation
-- Cf. CLAUDE.md §4 (3 tiers + 20/50/100 Go) + §5 (UX anti-friction transparence).
--
-- Sans tracking, un utilisateur Volume saturé après ~3 ans serait surpris,
-- et l'équipe KOVAS n'a aucune visibilité. Cette migration :
--   1. Ajoute storage_used_bytes + storage_quota_bytes à organizations
--   2. Ajoute file_size_bytes à voice_notes (manquait — photos.size_bytes + owner_documents.size_bytes existent déjà)
--   3. Crée la fonction update_storage_usage(org_id, delta_bytes) (delta peut être négatif)
--   4. Trigger AFTER INSERT/DELETE sur documents/photos/voice_notes/owner_documents
--      qui appelle update_storage_usage avec la taille (réelle si dispo, sinon estimation)
--
-- Estimations conservatives (utilisées si file_size NULL au moment du trigger) :
--   - photos       : 250 KB (WebP 1920px q=80)
--   - voice_notes  : 200 KB (Opus 60s)
--
-- Quotas par défaut :
--   - Découverte = 20 Go = 21 474 836 480 octets (default colonne)
--   - Standard   = 50 Go
--   - Volume     = 100 Go
-- (le mapping tier → quota se fait côté app via lib/storage/quota.ts à chaque
--  changement d'abonnement Stripe — la valeur en base est la source de vérité)
-- ============================================

-- ============================================
-- 1. Colonnes organizations
-- ============================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS storage_used_bytes  bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint NOT NULL DEFAULT 21474836480; -- 20 Go (tier Découverte)

-- Garde-fou : pas de valeurs négatives (delta négatif sur DELETE peut amener < 0 en cas
-- de désync ; on clamp à 0 dans la fonction)
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_storage_used_bytes_nonneg;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_storage_used_bytes_nonneg
  CHECK (storage_used_bytes >= 0);

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_storage_quota_bytes_positive;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_storage_quota_bytes_positive
  CHECK (storage_quota_bytes > 0);

-- Index pour le tri admin (organisations approchant ou dépassant leur quota)
CREATE INDEX IF NOT EXISTS idx_orgs_storage_used
  ON organizations (storage_used_bytes DESC);

-- ============================================
-- 2. Colonne taille manquante sur voice_notes
--    (photos.size_bytes + owner_documents.size_bytes + documents.file_size_bytes existent déjà)
-- ============================================
ALTER TABLE voice_notes
  ADD COLUMN IF NOT EXISTS file_size_bytes int;

COMMENT ON COLUMN voice_notes.file_size_bytes IS
  'Taille du fichier audio Opus en octets. Renseigné à l''upload. NULL = estimation 200 KB utilisée par le trigger.';

-- ============================================
-- 3. Fonction update_storage_usage(org_id, delta_bytes)
--    SECURITY DEFINER pour bypasser RLS depuis les triggers (cohérent avec is_member_of).
--    Clamp à 0 si delta négatif amènerait sous zéro (robustesse anti-désync).
-- ============================================
CREATE OR REPLACE FUNCTION public.update_storage_usage(
  p_org_id     uuid,
  p_delta_bytes bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NULL OR p_delta_bytes = 0 THEN
    RETURN;
  END IF;

  UPDATE organizations
     SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_delta_bytes)
   WHERE id = p_org_id;
END;
$$;

COMMENT ON FUNCTION public.update_storage_usage(uuid, bigint) IS
  'Incrémente (delta > 0) ou décrémente (delta < 0) storage_used_bytes pour une organisation. Clamp à 0.';

-- ============================================
-- 4. Triggers AFTER INSERT/DELETE par table
--    Estimations utilisées si colonne taille NULL :
--      photos       → 250 KB (256 000)
--      voice_notes  → 200 KB (204 800)
--    documents (file_size_bytes) et owner_documents (size_bytes) tombent à 0 si NULL.
-- ============================================

-- 4a. documents (Document Intelligence)
CREATE OR REPLACE FUNCTION public.trg_documents_storage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_size := COALESCE(NEW.file_size_bytes, 0);
    PERFORM public.update_storage_usage(NEW.organization_id, v_size);
  ELSIF TG_OP = 'DELETE' THEN
    v_size := COALESCE(OLD.file_size_bytes, 0);
    PERFORM public.update_storage_usage(OLD.organization_id, -v_size);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_storage_ins ON documents;
CREATE TRIGGER trg_documents_storage_ins
  AFTER INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_documents_storage_delta();

DROP TRIGGER IF EXISTS trg_documents_storage_del ON documents;
CREATE TRIGGER trg_documents_storage_del
  AFTER DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_documents_storage_delta();

-- 4b. photos (table partitionnée par created_at — le trigger sur la table parent
--     se propage automatiquement aux partitions filles depuis PG 11+)
CREATE OR REPLACE FUNCTION public.trg_photos_storage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Estimation 250 KB si size_bytes pas encore renseigné
    v_size := COALESCE(NEW.size_bytes, 256000);
    PERFORM public.update_storage_usage(NEW.organization_id, v_size);
  ELSIF TG_OP = 'DELETE' THEN
    v_size := COALESCE(OLD.size_bytes, 256000);
    PERFORM public.update_storage_usage(OLD.organization_id, -v_size);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_photos_storage_ins ON photos;
CREATE TRIGGER trg_photos_storage_ins
  AFTER INSERT ON photos
  FOR EACH ROW EXECUTE FUNCTION public.trg_photos_storage_delta();

DROP TRIGGER IF EXISTS trg_photos_storage_del ON photos;
CREATE TRIGGER trg_photos_storage_del
  AFTER DELETE ON photos
  FOR EACH ROW EXECUTE FUNCTION public.trg_photos_storage_delta();

-- 4c. voice_notes (estimation 200 KB)
CREATE OR REPLACE FUNCTION public.trg_voice_notes_storage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_size := COALESCE(NEW.file_size_bytes, 204800);
    PERFORM public.update_storage_usage(NEW.organization_id, v_size);
  ELSIF TG_OP = 'DELETE' THEN
    v_size := COALESCE(OLD.file_size_bytes, 204800);
    PERFORM public.update_storage_usage(OLD.organization_id, -v_size);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_notes_storage_ins ON voice_notes;
CREATE TRIGGER trg_voice_notes_storage_ins
  AFTER INSERT ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_voice_notes_storage_delta();

DROP TRIGGER IF EXISTS trg_voice_notes_storage_del ON voice_notes;
CREATE TRIGGER trg_voice_notes_storage_del
  AFTER DELETE ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_voice_notes_storage_delta();

-- 4d. owner_documents (size_bytes existe déjà)
CREATE OR REPLACE FUNCTION public.trg_owner_docs_storage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_size := COALESCE(NEW.size_bytes, 0);
    PERFORM public.update_storage_usage(NEW.organization_id, v_size);
  ELSIF TG_OP = 'DELETE' THEN
    v_size := COALESCE(OLD.size_bytes, 0);
    PERFORM public.update_storage_usage(OLD.organization_id, -v_size);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_owner_docs_storage_ins ON owner_documents;
CREATE TRIGGER trg_owner_docs_storage_ins
  AFTER INSERT ON owner_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_owner_docs_storage_delta();

DROP TRIGGER IF EXISTS trg_owner_docs_storage_del ON owner_documents;
CREATE TRIGGER trg_owner_docs_storage_del
  AFTER DELETE ON owner_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_owner_docs_storage_delta();

-- ============================================
-- 5. RLS — colonnes storage_*_bytes lisibles par les membres de l'org
--    La policy "organizations: members read" existe déjà via is_member_of(id).
--    Aucune nouvelle policy nécessaire : les nouvelles colonnes sont protégées
--    par la policy SELECT existante sur la table.
-- ============================================
