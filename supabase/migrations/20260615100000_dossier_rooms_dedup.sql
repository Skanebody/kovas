-- ============================================================
-- KOVAS — Dédoublonnage `dossier_rooms` + RPC atomique de création
-- ============================================================
--
-- CONTEXTE (audit mode mission P1-1 + P1-2) :
--
-- En mode terrain offline, deux clients (ou deux photos rafale) pouvaient
-- simultanément appeler createRoomAction ou uploadCapturePhotoAction avec
-- le même `roomName`. Le SELECT max(position) + INSERT n'étaient PAS
-- atomiques → deux rows créées avec la même position, et/ou deux rooms
-- "Salon" doublons dans le même dossier.
--
-- Cette migration :
--   1. Nettoie les doublons existants (collision (dossier_id, lower(name)))
--      en gardant le plus ancien et en migrant les photos/voice_notes vers lui.
--   2. Crée un index UNIQUE partiel sur (dossier_id, lower(name)) WHERE deleted_at
--      IS NULL pour empêcher tout doublon futur.
--   3. Expose une RPC `create_or_get_dossier_room(p_dossier_id, p_org_id, p_name)`
--      qui FAIT le upsert atomique côté DB (SECURITY DEFINER + check is_member_of).
--
-- Authority : CLAUDE.md §10 — RLS multi-tenant strict + idempotence offline.
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- 0. Ajout colonne deleted_at si absente (idempotent)
-- ----------------------------------------------------------------
-- Cohérent avec le pattern soft-delete déjà utilisé sur `dossiers`.
-- L'UNIQUE INDEX partial ci-dessous permet la réutilisation d'un nom
-- après soft-delete (UX : renommer/recréer une pièce).

ALTER TABLE dossier_rooms
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dossier_rooms_deleted_at
  ON dossier_rooms (deleted_at) WHERE deleted_at IS NOT NULL;

-- ----------------------------------------------------------------
-- 1. Cleanup doublons existants
-- ----------------------------------------------------------------

-- Identification des groupes (dossier_id, lower(name)) avec plus d'1 row.
-- On garde la row la plus ancienne et on rebascule les photos/voice_notes
-- + mission_rooms_3cl_data vers elle.

DO $$
DECLARE
  dup_record RECORD;
  keep_id UUID;
BEGIN
  FOR dup_record IN
    SELECT
      dossier_id,
      lower(name) AS normalized_name,
      array_agg(id ORDER BY created_at NULLS LAST, id) AS room_ids,
      count(*) AS dup_count
    FROM dossier_rooms
    WHERE deleted_at IS NULL
    GROUP BY dossier_id, lower(name)
    HAVING count(*) > 1
  LOOP
    keep_id := dup_record.room_ids[1];

    -- Reparente toutes les photos vers le keep
    UPDATE photos
    SET room_id = keep_id
    WHERE room_id = ANY(dup_record.room_ids[2:array_length(dup_record.room_ids, 1)]);

    -- Reparente les voice_notes (si la colonne room_id existe)
    BEGIN
      EXECUTE 'UPDATE voice_notes SET room_id = $1 WHERE room_id = ANY($2)'
        USING keep_id, dup_record.room_ids[2:array_length(dup_record.room_ids, 1)];
    EXCEPTION WHEN undefined_column THEN
      -- voice_notes.room_id n'existe pas → on ignore
      NULL;
    END;

    -- Reparente mission_text_notes si la table+colonne existent
    BEGIN
      EXECUTE 'UPDATE mission_text_notes SET room_id = $1 WHERE room_id = ANY($2)'
        USING keep_id, dup_record.room_ids[2:array_length(dup_record.room_ids, 1)];
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;

    -- Soft-delete les doublons (deleted_at = now())
    UPDATE dossier_rooms
    SET deleted_at = NOW()
    WHERE id = ANY(dup_record.room_ids[2:array_length(dup_record.room_ids, 1)]);

    RAISE NOTICE 'Dossier % : merged % dup rooms vers %', dup_record.dossier_id, dup_record.dup_count - 1, keep_id;
  END LOOP;
END$$;

-- ----------------------------------------------------------------
-- 2. UNIQUE INDEX partial — empêche tout doublon futur
-- ----------------------------------------------------------------

-- Note : on indexe sur lower(name) pour matcher la résolution case-insensitive
-- côté serveur action (.ilike). Le partial WHERE deleted_at IS NULL permet
-- la réutilisation d'un nom si l'ancienne room a été soft-deleted.

CREATE UNIQUE INDEX IF NOT EXISTS dossier_rooms_unique_name_per_dossier
  ON dossier_rooms (dossier_id, lower(name))
  WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------
-- 3. RPC atomique : create_or_get_dossier_room
-- ----------------------------------------------------------------

-- Cette RPC remplace le pattern SELECT-max + INSERT côté server actions.
-- Elle est SECURITY DEFINER et fait le check is_member_of côté DB.
-- En cas de collision UNIQUE, elle retourne la row existante (idempotence
-- offline).

CREATE OR REPLACE FUNCTION public.create_or_get_dossier_room(
  p_dossier_id UUID,
  p_org_id UUID,
  p_name TEXT,
  p_room_type TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, position INTEGER, name TEXT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_existing_position INTEGER;
  v_existing_name TEXT;
  v_next_position INTEGER;
  v_new_id UUID;
  v_new_name TEXT;
BEGIN
  -- 1. Check ownership (l'user appelant doit appartenir à l'org)
  IF NOT public.is_member_of(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Vérifier que le dossier appartient bien à cette org (defense in depth)
  IF NOT EXISTS (
    SELECT 1 FROM dossiers
    WHERE id = p_dossier_id
      AND organization_id = p_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'dossier_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Tenter de récupérer une room existante (case-insensitive)
  SELECT dr.id, dr.position, dr.name
    INTO v_existing_id, v_existing_position, v_existing_name
    FROM dossier_rooms dr
    WHERE dr.dossier_id = p_dossier_id
      AND lower(dr.name) = lower(trim(p_name))
      AND dr.deleted_at IS NULL
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Idempotence : on renvoie la row existante
    id := v_existing_id;
    position := v_existing_position;
    name := v_existing_name;
    created := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 4. Pas de doublon → INSERT atomique (UNIQUE index gère la race)
  SELECT COALESCE(MAX(dr.position), -1) + 1
    INTO v_next_position
    FROM dossier_rooms dr
    WHERE dr.dossier_id = p_dossier_id;

  BEGIN
    INSERT INTO dossier_rooms (dossier_id, organization_id, name, position, room_type)
    VALUES (p_dossier_id, p_org_id, trim(p_name), v_next_position, p_room_type)
    RETURNING dossier_rooms.id, dossier_rooms.position, dossier_rooms.name
      INTO v_new_id, v_next_position, v_new_name;

    id := v_new_id;
    position := v_next_position;
    name := v_new_name;
    created := TRUE;
    RETURN NEXT;
  EXCEPTION WHEN unique_violation THEN
    -- Race : un autre client a inséré entre temps → on récupère sa row
    SELECT dr.id, dr.position, dr.name
      INTO v_existing_id, v_existing_position, v_existing_name
      FROM dossier_rooms dr
      WHERE dr.dossier_id = p_dossier_id
        AND lower(dr.name) = lower(trim(p_name))
        AND dr.deleted_at IS NULL
      LIMIT 1;

    id := v_existing_id;
    position := v_existing_position;
    name := v_existing_name;
    created := FALSE;
    RETURN NEXT;
  END;
END;
$$;

-- Restreindre l'exécution aux users authentifiés uniquement.
REVOKE ALL ON FUNCTION public.create_or_get_dossier_room(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_get_dossier_room(UUID, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_or_get_dossier_room IS
  'KOVAS audit P1-1/P1-2 — RPC atomique pour création de pièce avec idempotence offline.
   Garantit absence de doublons grâce à UNIQUE INDEX (dossier_id, lower(name)).
   En cas de race condition (2 inserts simultanés), retourne la row qui a gagné.';

COMMIT;
