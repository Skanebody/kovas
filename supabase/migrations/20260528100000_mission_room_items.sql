-- ============================================================================
-- KOVAS — Items de pièce (équipements / observations / mesures) mode mission
-- ============================================================================
--
-- CONTEXTE (Phase 2 mode mission — "tous les éléments") :
--
-- Jusqu'ici les captures `equipment` / `observation` / `measurement` émises
-- par l'IA ne faisaient qu'incrémenter un compteur de complétude `filledFields`
-- côté state client : RIEN n'était stocké, ni affiché, ni supprimable. Le
-- diagnostiqueur ne pouvait pas relire ni corriger un équipement dicté par
-- erreur.
--
-- Cette migration crée la table `mission_room_items` qui matérialise chaque
-- élément comme une row distincte rattachée à une pièce (`dossier_rooms`), avec
-- soft-delete + idempotence offline (calque sur `dossier_rooms` / `mission_photos`).
--
-- CHOIX table dédiée (vs JSONB sur dossier_rooms) :
--   - Chaque item a son cycle de vie propre (création voix/manuel, soft-delete
--     unitaire) → first-class entity, pas un sous-champ.
--   - JSONB sur dossier_rooms imposerait un read-modify-write de la row pièce
--     pour chaque ajout/suppression d'item → races entre captures vocales
--     concurrentes et éditions manuelles.
--   - On réutilise tels quels les patterns RLS org + index partiels + RPC
--     idempotente déjà éprouvés (cohérence + revue facilitée).
--
-- IMPORTANT : migration NON appliquée par l'agent — Benjamin l'applique en prod.
-- 100% idempotente (CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS).
--
-- Authority : CLAUDE.md §3 features 1 + §10 RLS multi-tenant strict.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table mission_room_items
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mission_room_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Rattachement à la pièce réelle (table = dossier_rooms). ON DELETE CASCADE :
  -- si la pièce est physiquement supprimée, ses items partent avec. Le soft-delete
  -- d'une pièce (deleted_at) ne touche pas les items — c'est volontaire (historique).
  dossier_room_id   uuid NOT NULL REFERENCES dossier_rooms(id) ON DELETE CASCADE,
  -- Nature de l'élément (parité avec les capture_type IA).
  kind              text NOT NULL CHECK (kind IN ('equipment', 'observation', 'measurement')),
  -- Résumé lisible dérivé de la capture, affiché tel quel dans la sidebar.
  label             text NOT NULL,
  -- Données structurées brutes de la capture (kind, brand, severity, value, unit…).
  data              jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Id local client (crypto.randomUUID côté browser) — idempotence offline :
  -- N tentatives d'insert du même item ne créent qu'une row (UNIQUE partiel).
  client_local_id   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mission_room_items_room
  ON mission_room_items (dossier_room_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mission_room_items_deleted_at
  ON mission_room_items (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Idempotence offline : un même client_local_id ne peut être inséré qu'une fois
-- par pièce (parmi les rows actives). Le partial WHERE deleted_at IS NULL permet
-- de ré-utiliser un client_local_id après soft-delete (cas rare mais propre).
CREATE UNIQUE INDEX IF NOT EXISTS mission_room_items_unique_local_id
  ON mission_room_items (dossier_room_id, client_local_id)
  WHERE client_local_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE mission_room_items IS
  'Mode mission : éléments d''une pièce (équipements / observations / mesures) capturés à la voix ou manuellement. Affichés + supprimables dans la sidebar pièces. Cf. CLAUDE.md §3 feature 1 + Phase 2 "tous les éléments".';

COMMENT ON COLUMN mission_room_items.kind IS
  'equipment | observation | measurement — parité avec les capture_type IA du tchat mission.';

COMMENT ON COLUMN mission_room_items.label IS
  'Résumé lisible dérivé de la capture (ex : "Chaudière gaz · Saunier Duval", "Humidité (moyenne)", "Surface Carrez : 22,5 m²").';

COMMENT ON COLUMN mission_room_items.client_local_id IS
  'crypto.randomUUID côté client — idempotence offline (UNIQUE partiel dossier_room_id, client_local_id WHERE deleted_at IS NULL).';

-- ----------------------------------------------------------------------------
-- 2. RLS — multi-tenant via public.is_member_of(organization_id)
-- ----------------------------------------------------------------------------

ALTER TABLE mission_room_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_room_items: org members read" ON mission_room_items;
CREATE POLICY "mission_room_items: org members read"
  ON mission_room_items FOR SELECT
  USING (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_room_items: org members write" ON mission_room_items;
CREATE POLICY "mission_room_items: org members write"
  ON mission_room_items FOR INSERT
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_room_items: org members update" ON mission_room_items;
CREATE POLICY "mission_room_items: org members update"
  ON mission_room_items FOR UPDATE
  USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

DROP POLICY IF EXISTS "mission_room_items: org members delete" ON mission_room_items;
CREATE POLICY "mission_room_items: org members delete"
  ON mission_room_items FOR DELETE
  USING (public.is_member_of(organization_id));

-- ----------------------------------------------------------------------------
-- 3. RPC atomique : create_or_get_mission_room_item (idempotence offline)
-- ----------------------------------------------------------------------------
-- Calque sur create_or_get_dossier_room. SECURITY DEFINER + check is_member_of.
-- En cas de collision UNIQUE (même client_local_id), retourne la row existante.

CREATE OR REPLACE FUNCTION public.create_or_get_mission_room_item(
  p_org_id          uuid,
  p_dossier_room_id uuid,
  p_kind            text,
  p_label           text,
  p_data            jsonb,
  p_client_local_id text DEFAULT NULL
)
RETURNS TABLE (id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  -- 1. Ownership : l'appelant doit appartenir à l'org.
  IF NOT public.is_member_of(p_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. La pièce doit appartenir à cette org (defense in depth).
  IF NOT EXISTS (
    SELECT 1 FROM dossier_rooms dr
    WHERE dr.id = p_dossier_room_id
      AND dr.organization_id = p_org_id
      AND dr.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'room_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Idempotence : item déjà présent pour ce client_local_id ?
  IF p_client_local_id IS NOT NULL THEN
    SELECT mri.id INTO v_existing_id
      FROM mission_room_items mri
      WHERE mri.dossier_room_id = p_dossier_room_id
        AND mri.client_local_id = p_client_local_id
        AND mri.deleted_at IS NULL
      LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      id := v_existing_id;
      created := FALSE;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 4. INSERT (le UNIQUE index partiel gère la race concurrente).
  BEGIN
    INSERT INTO mission_room_items
      (organization_id, dossier_room_id, kind, label, data, client_local_id)
    VALUES
      (p_org_id, p_dossier_room_id, p_kind, p_label, COALESCE(p_data, '{}'::jsonb), p_client_local_id)
    RETURNING mission_room_items.id INTO v_new_id;

    id := v_new_id;
    created := TRUE;
    RETURN NEXT;
  EXCEPTION WHEN unique_violation THEN
    -- Race : un autre client a inséré le même client_local_id entre temps.
    SELECT mri.id INTO v_existing_id
      FROM mission_room_items mri
      WHERE mri.dossier_room_id = p_dossier_room_id
        AND mri.client_local_id = p_client_local_id
        AND mri.deleted_at IS NULL
      LIMIT 1;

    id := v_existing_id;
    created := FALSE;
    RETURN NEXT;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_mission_room_item(uuid, uuid, text, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_or_get_mission_room_item(uuid, uuid, text, text, jsonb, text)
  TO authenticated;

COMMENT ON FUNCTION public.create_or_get_mission_room_item IS
  'KOVAS — RPC atomique création item de pièce (équipement/observation/mesure) avec idempotence offline (UNIQUE dossier_room_id, client_local_id). Retourne la row gagnante en cas de race.';

COMMIT;
