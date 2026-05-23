-- ============================================
-- KOVAS App — Chantier E : Audit trail dossier (timeline activité)
-- Date : 2026-05-24
--
-- Authority : CLAUDE.md §22 + FIX-KK §E.
--
-- Objectif :
--   Tracer tous les événements significatifs d'un dossier (création,
--   changements de statut, ajouts photos/notes vocales, docs historiques
--   uploadés, devis/factures créés, exports, changement client/proprio)
--   dans une timeline chronologique consultable depuis la page dossier.
--
-- Stratégie :
--   - Table append-only `dossier_activity_log` avec event_type + jsonb
--     event_data flexible (pas de schema rigide par type d'événement).
--   - Triggers Postgres `AFTER UPDATE OF status` sur dossiers, `AFTER
--     INSERT` sur photos + voice_notes + dossier_historical_documents +
--     quotes + invoices pour pousser les événements automatiquement.
--   - L'application peut aussi pousser des événements manuellement
--     (ex : `export_generated`, `client_changed`) via INSERT direct.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE pour fns,
-- DROP TRIGGER IF EXISTS avant CREATE TRIGGER).
-- ============================================

-- ============================================
-- 1. Table dossier_activity_log
-- ============================================
CREATE TABLE IF NOT EXISTS dossier_activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id      uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  event_data      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id   uuid REFERENCES auth.users(id),
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dal_dossier
  ON dossier_activity_log (dossier_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dal_org_time
  ON dossier_activity_log (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_dal_event_type
  ON dossier_activity_log (dossier_id, event_type);

COMMENT ON TABLE dossier_activity_log IS
  'Timeline append-only des événements liés à un dossier KOVAS (création, statut, photos, vocaux, docs, devis, factures, exports, change proprio) — FIX-KK §E.';
COMMENT ON COLUMN dossier_activity_log.event_type IS
  'Type d''événement : created | status_changed | photo_added | voice_note_added | historical_document_added | quote_created | invoice_created | export_generated | client_changed | owner_changed';

-- ============================================
-- 2. RLS — accès par organisation
-- ============================================
ALTER TABLE dossier_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dal_org_select ON dossier_activity_log;
DROP POLICY IF EXISTS dal_org_insert ON dossier_activity_log;

CREATE POLICY dal_org_select ON dossier_activity_log
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY dal_org_insert ON dossier_activity_log
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));

-- Pas d'UPDATE ni DELETE : table append-only (audit trail).

-- ============================================
-- 3. Helper interne pour pousser un événement
-- ============================================
CREATE OR REPLACE FUNCTION public.log_dossier_event(
  p_dossier_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id  uuid;
BEGIN
  SELECT organization_id INTO v_org FROM dossiers WHERE id = p_dossier_id;
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data, actor_user_id)
  VALUES (p_dossier_id, v_org, p_event_type, COALESCE(p_event_data, '{}'::jsonb), p_actor_user_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_dossier_event(uuid, text, jsonb, uuid) IS
  'Helper SECURITY DEFINER pour pousser un événement dans dossier_activity_log. Résout l''organization_id depuis le dossier.';

GRANT EXECUTE ON FUNCTION public.log_dossier_event(uuid, text, jsonb, uuid) TO authenticated;

-- ============================================
-- 4. Triggers automatiques
-- ============================================

-- 4.a — Création de dossier
CREATE OR REPLACE FUNCTION public.trg_dossier_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data, actor_user_id)
  VALUES (
    NEW.id,
    NEW.organization_id,
    'created',
    jsonb_build_object('reference', NEW.reference, 'status', NEW.status),
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossiers_log_created ON dossiers;
CREATE TRIGGER trg_dossiers_log_created
  AFTER INSERT ON dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_created();

-- 4.b — Changement de statut
CREATE OR REPLACE FUNCTION public.trg_dossier_status_changed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data)
    VALUES (
      NEW.id,
      NEW.organization_id,
      'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossiers_log_status_changed ON dossiers;
CREATE TRIGGER trg_dossiers_log_status_changed
  AFTER UPDATE OF status ON dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_status_changed();

-- 4.c — Photo ajoutée (compteur agrégé par minute pour éviter le bruit
--       si l'utilisateur prend 20 photos d'affilée — on ne log qu'au 1er
--       INSERT et on incrémente un compteur côté app si nécessaire).
--       V1 : on log chaque INSERT, le UI filtre / agrège côté lecture.
CREATE OR REPLACE FUNCTION public.trg_photo_added()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.dossier_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO v_org FROM dossiers WHERE id = NEW.dossier_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data)
  VALUES (
    NEW.dossier_id,
    v_org,
    'photo_added',
    jsonb_build_object('photo_id', NEW.id, 'room_id', NEW.room_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photos_log_added ON photos;
CREATE TRIGGER trg_photos_log_added
  AFTER INSERT ON photos
  FOR EACH ROW EXECUTE FUNCTION public.trg_photo_added();

-- 4.d — Note vocale ajoutée
CREATE OR REPLACE FUNCTION public.trg_voice_note_added()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.dossier_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO v_org FROM dossiers WHERE id = NEW.dossier_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data, actor_user_id)
  VALUES (
    NEW.dossier_id,
    v_org,
    'voice_note_added',
    jsonb_build_object('voice_note_id', NEW.id, 'duration_seconds', NEW.duration_seconds),
    NEW.recorded_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_notes_log_added ON voice_notes;
CREATE TRIGGER trg_voice_notes_log_added
  AFTER INSERT ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_voice_note_added();

-- 4.e — Document historique ajouté
CREATE OR REPLACE FUNCTION public.trg_historical_document_added()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data, actor_user_id)
  VALUES (
    NEW.dossier_id,
    NEW.organization_id,
    'historical_document_added',
    jsonb_build_object(
      'document_id', NEW.id,
      'category', NEW.category,
      'filename', NEW.original_filename
    ),
    NEW.uploaded_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dhd_log_added ON dossier_historical_documents;
CREATE TRIGGER trg_dhd_log_added
  AFTER INSERT ON dossier_historical_documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_historical_document_added();

-- 4.f — Devis créé (rattaché à un dossier)
CREATE OR REPLACE FUNCTION public.trg_quote_for_dossier_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dossier_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data)
  VALUES (
    NEW.dossier_id,
    NEW.organization_id,
    'quote_created',
    jsonb_build_object(
      'quote_id', NEW.id,
      'reference', NEW.reference,
      'amount_ttc', NEW.amount_ttc,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_log_for_dossier ON quotes;
CREATE TRIGGER trg_quotes_log_for_dossier
  AFTER INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_for_dossier_created();

-- 4.g — Facture créée (rattachée à un dossier)
CREATE OR REPLACE FUNCTION public.trg_invoice_for_dossier_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dossier_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO dossier_activity_log (dossier_id, organization_id, event_type, event_data)
  VALUES (
    NEW.dossier_id,
    NEW.organization_id,
    'invoice_created',
    jsonb_build_object(
      'invoice_id', NEW.id,
      'reference', NEW.reference,
      'amount_ttc', NEW.amount_ttc,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_log_for_dossier ON invoices;
CREATE TRIGGER trg_invoices_log_for_dossier
  AFTER INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_for_dossier_created();
