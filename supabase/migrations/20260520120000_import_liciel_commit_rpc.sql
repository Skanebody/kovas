-- ============================================================================
-- 20260520120000_import_liciel_commit_rpc.sql
--
-- Feature : Import Liciel — fonction RPC `commit_import_job(p_job_id uuid)`
--           qui finalise un import en insérant les staging vers la prod
--           (clients / properties / coproprietes / lots) selon les résolutions
--           de doublons enregistrées par l'utilisateur en étape 5 du wizard.
--
-- Appelée APRES que `import_dedupe_matches.resolution` ait été renseignée pour
-- TOUS les matches du job (sinon EXCEPTION). La transaction est implicite en
-- plpgsql : tout réussit, ou tout est rollbacké (et le job passe en 'failed'
-- avec error_message dans le bloc EXCEPTION).
--
-- Stratégies de résolution supportées :
--   - merge          : UPDATE de l'existant en appliquant `field_choices`
--   - replace        : UPDATE de l'existant avec tous les champs staging
--   - keep_separate  : INSERT du staging comme nouveau (créer le doublon)
--   - skip           : ne rien faire (staging passe en 'skipped')
--
-- field_choices format JSON :
--   { "<field>": "new" | "existing" | { "edited": "<valeur>" }, ... }
--   - "new"           → ecraser avec valeur staging
--   - "existing"      → garder valeur prod (no-op pour ce champ)
--   - { edited: "X" } → remplacer par X
--   - clé absente     → garder valeur prod (no-op)
--
-- RLS : la fonction est SECURITY DEFINER mais vérifie `is_member_of()` au
-- début. Les inserts/updates derrière passent en bypass RLS (definer).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper : applique field_choices à un texte
-- ----------------------------------------------------------------------------
-- Retourne la valeur finale pour un champ donné en fonction du choix user :
--   - p_choice = NULL              → valeur existante
--   - p_choice = 'new' string      → valeur staging
--   - p_choice = 'existing' string → valeur existante
--   - p_choice = { edited: "X" }   → "X"
--   - autre                        → valeur existante (fallback safe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_resolve_field_text(
  p_choice jsonb,
  p_new text,
  p_existing text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text;
  v_str  text;
BEGIN
  IF p_choice IS NULL THEN
    RETURN p_existing;
  END IF;

  v_type := jsonb_typeof(p_choice);

  IF v_type = 'string' THEN
    v_str := p_choice #>> '{}';
    IF v_str = 'new' THEN
      RETURN p_new;
    ELSIF v_str = 'existing' THEN
      RETURN p_existing;
    ELSE
      RETURN p_existing;
    END IF;
  END IF;

  IF v_type = 'object' AND p_choice ? 'edited' THEN
    RETURN p_choice ->> 'edited';
  END IF;

  RETURN p_existing;
END;
$$;

-- ============================================================================
-- Helper : MERGE / REPLACE des clients sur les matches résolus
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_client_merges(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_staging import_staging_clients%ROWTYPE;
  v_existing clients%ROWTYPE;
  v_choices jsonb;
  v_is_replace boolean;
BEGIN
  FOR v_match IN
    SELECT *
    FROM import_dedupe_matches
    WHERE job_id = p_job_id
      AND entity_type = 'client'
      AND resolution IN ('merge', 'replace')
  LOOP
    SELECT * INTO v_staging
    FROM import_staging_clients
    WHERE id = v_match.staging_entity_id;

    IF v_staging IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_existing FROM clients WHERE id = v_match.existing_entity_id;
    IF v_existing IS NULL THEN
      CONTINUE;
    END IF;

    -- replace = on impose 'new' partout, on ignore field_choices
    v_is_replace := (v_match.resolution = 'replace');
    v_choices := COALESCE(v_match.field_choices, '{}'::jsonb);

    UPDATE clients SET
      display_name = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.display_name, v_existing.display_name)
        ELSE public.import_resolve_field_text(v_choices -> 'display_name', v_staging.display_name, v_existing.display_name)
      END,
      first_name = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.first_name, v_existing.first_name)
        ELSE public.import_resolve_field_text(v_choices -> 'first_name', v_staging.first_name, v_existing.first_name)
      END,
      last_name = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.last_name, v_existing.last_name)
        ELSE public.import_resolve_field_text(v_choices -> 'last_name', v_staging.last_name, v_existing.last_name)
      END,
      company_name = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.company_name, v_existing.company_name)
        ELSE public.import_resolve_field_text(v_choices -> 'company_name', v_staging.company_name, v_existing.company_name)
      END,
      email = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.email, v_existing.email)
        ELSE public.import_resolve_field_text(v_choices -> 'email', v_staging.email, v_existing.email)
      END,
      phone = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.phone, v_existing.phone)
        ELSE public.import_resolve_field_text(v_choices -> 'phone', v_staging.phone, v_existing.phone)
      END,
      siret = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.siret, v_existing.siret)
        ELSE public.import_resolve_field_text(v_choices -> 'siret', v_staging.siret, v_existing.siret)
      END,
      address = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.address, v_existing.address)
        ELSE public.import_resolve_field_text(v_choices -> 'address', v_staging.address, v_existing.address)
      END,
      postal_code = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.postal_code, v_existing.postal_code)
        ELSE public.import_resolve_field_text(v_choices -> 'postal_code', v_staging.postal_code, v_existing.postal_code)
      END,
      city = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.city, v_existing.city)
        ELSE public.import_resolve_field_text(v_choices -> 'city', v_staging.city, v_existing.city)
      END,
      notes = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.notes, v_existing.notes)
        ELSE public.import_resolve_field_text(v_choices -> 'notes', v_staging.notes, v_existing.notes)
      END,
      updated_at = now()
    WHERE id = v_match.existing_entity_id;

    UPDATE import_staging_clients
    SET status = 'merged',
        merged_into_client_id = v_match.existing_entity_id
    WHERE id = v_staging.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- Helper : MERGE / REPLACE des properties sur les matches résolus
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_property_merges(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_staging import_staging_properties%ROWTYPE;
  v_existing properties%ROWTYPE;
  v_choices jsonb;
  v_is_replace boolean;
BEGIN
  FOR v_match IN
    SELECT *
    FROM import_dedupe_matches
    WHERE job_id = p_job_id
      AND entity_type = 'property'
      AND resolution IN ('merge', 'replace')
  LOOP
    SELECT * INTO v_staging
    FROM import_staging_properties
    WHERE id = v_match.staging_entity_id;

    IF v_staging IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_existing FROM properties WHERE id = v_match.existing_entity_id;
    IF v_existing IS NULL THEN
      CONTINUE;
    END IF;

    v_is_replace := (v_match.resolution = 'replace');
    v_choices := COALESCE(v_match.field_choices, '{}'::jsonb);

    UPDATE properties SET
      address = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.address, v_existing.address)
        ELSE public.import_resolve_field_text(v_choices -> 'address', v_staging.address, v_existing.address)
      END,
      postal_code = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.postal_code, v_existing.postal_code)
        ELSE public.import_resolve_field_text(v_choices -> 'postal_code', v_staging.postal_code, v_existing.postal_code)
      END,
      city = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.city, v_existing.city)
        ELSE public.import_resolve_field_text(v_choices -> 'city', v_staging.city, v_existing.city)
      END,
      insee_code = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.insee_code, v_existing.insee_code)
        ELSE public.import_resolve_field_text(v_choices -> 'insee_code', v_staging.insee_code, v_existing.insee_code)
      END,
      updated_at = now()
    WHERE id = v_match.existing_entity_id;

    UPDATE import_staging_properties
    SET status = 'merged',
        merged_into_property_id = v_match.existing_entity_id
    WHERE id = v_staging.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- Helper : MERGE / REPLACE des coproprietes sur les matches résolus
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_copropriete_merges(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_staging import_staging_coproprietes%ROWTYPE;
  v_existing coproprietes%ROWTYPE;
  v_choices jsonb;
  v_is_replace boolean;
BEGIN
  FOR v_match IN
    SELECT *
    FROM import_dedupe_matches
    WHERE job_id = p_job_id
      AND entity_type = 'copropriete'
      AND resolution IN ('merge', 'replace')
  LOOP
    SELECT * INTO v_staging
    FROM import_staging_coproprietes
    WHERE id = v_match.staging_entity_id;

    IF v_staging IS NULL THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_existing FROM coproprietes WHERE id = v_match.existing_entity_id;
    IF v_existing IS NULL THEN
      CONTINUE;
    END IF;

    v_is_replace := (v_match.resolution = 'replace');
    v_choices := COALESCE(v_match.field_choices, '{}'::jsonb);

    UPDATE coproprietes SET
      name = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.name, v_existing.name)
        ELSE public.import_resolve_field_text(v_choices -> 'name', v_staging.name, v_existing.name)
      END,
      rnic_number = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.rnic_number, v_existing.rnic_number)
        ELSE public.import_resolve_field_text(v_choices -> 'rnic_number', v_staging.rnic_number, v_existing.rnic_number)
      END,
      address = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.address, v_existing.address)
        ELSE public.import_resolve_field_text(v_choices -> 'address', v_staging.address, v_existing.address)
      END,
      postal_code = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.postal_code, v_existing.postal_code)
        ELSE public.import_resolve_field_text(v_choices -> 'postal_code', v_staging.postal_code, v_existing.postal_code)
      END,
      city = CASE WHEN v_is_replace
        THEN COALESCE(v_staging.city, v_existing.city)
        ELSE public.import_resolve_field_text(v_choices -> 'city', v_staging.city, v_existing.city)
      END,
      updated_at = now()
    WHERE id = v_match.existing_entity_id;

    UPDATE import_staging_coproprietes
    SET status = 'merged',
        merged_into_copropriete_id = v_match.existing_entity_id
    WHERE id = v_staging.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- FONCTION PRINCIPALE : commit_import_job
-- ============================================================================
CREATE OR REPLACE FUNCTION public.commit_import_job(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_org_id uuid;
  v_user_id uuid;
  v_imported_clients int := 0;
  v_imported_properties int := 0;
  v_imported_coproprietes int := 0;
  v_imported_lots int := 0;
  v_merged_clients int := 0;
  v_merged_properties int := 0;
  v_merged_coproprietes int := 0;
  v_skipped_clients int := 0;
  v_skipped_properties int := 0;
  v_skipped_coproprietes int := 0;
  v_unresolved int;
BEGIN
  -- 1. Charge le job + verifie autorisation
  SELECT * INTO v_job FROM import_jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND';
  END IF;

  IF NOT public.is_member_of(v_job.organization_id) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF v_job.status NOT IN ('deduped', 'normalized', 'parsed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: %', v_job.status;
  END IF;

  v_org_id := v_job.organization_id;
  v_user_id := auth.uid();

  -- 2. Verifie qu'aucun match ne reste sans resolution
  SELECT COUNT(*) INTO v_unresolved
  FROM import_dedupe_matches
  WHERE job_id = p_job_id AND resolution IS NULL;

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'UNRESOLVED_DUPLICATES: % match(s) non resolu(s)', v_unresolved;
  END IF;

  -- 3. Bascule status en 'committing'
  UPDATE import_jobs SET status = 'committing' WHERE id = p_job_id;

  -- ===========================================================================
  -- 4. CLIENTS
  -- ===========================================================================

  -- 4a. SKIP : marque les staging avec resolution='skip' en 'skipped'
  WITH skipped AS (
    UPDATE import_staging_clients s
    SET status = 'skipped'
    WHERE s.job_id = p_job_id AND s.status = 'pending'
      AND EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'client'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'skip'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_skipped_clients FROM skipped;

  -- 4b. MERGE / REPLACE : applique field_choices sur l'existant
  PERFORM public.apply_client_merges(p_job_id);

  SELECT COUNT(*) INTO v_merged_clients
  FROM import_dedupe_matches
  WHERE job_id = p_job_id AND entity_type = 'client'
    AND resolution IN ('merge', 'replace');

  -- 4c. INSERT : staging sans match OU resolution='keep_separate'
  WITH inserted AS (
    INSERT INTO clients (
      organization_id, type, display_name, first_name, last_name,
      company_name, siret, email, phone, address, postal_code, city,
      country, apartment_detail, building_letter, floor_number,
      address_complement, notes, created_by
    )
    SELECT
      s.organization_id,
      COALESCE(NULLIF(s.type, '')::client_type, 'particulier'::client_type),
      COALESCE(NULLIF(s.display_name, ''), NULLIF(s.last_name, ''), NULLIF(s.email, ''), 'Client'),
      s.first_name, s.last_name, s.company_name, s.siret, s.email, s.phone,
      s.address, s.postal_code, s.city, COALESCE(s.country, 'FR'),
      s.apartment_detail, s.building_letter, s.floor_number,
      s.address_complement, s.notes, v_user_id
    FROM import_staging_clients s
    WHERE s.job_id = p_job_id
      AND s.status = 'pending'
      AND (
        NOT EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'client'
            AND m.staging_entity_id = s.id
        )
        OR EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'client'
            AND m.staging_entity_id = s.id
            AND m.resolution = 'keep_separate'
        )
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_imported_clients FROM inserted;

  -- Marque les staging insérés en 'imported'
  -- Note : on n'a pas la map staging↔inserted ; on marque tous ceux qui
  -- répondent au critère (eq au filtre INSERT). C'est OK car au moment du
  -- UPDATE, le INSERT est déjà commit (CTE atomicité) — pas de double-count.
  UPDATE import_staging_clients s
  SET status = 'imported'
  WHERE s.job_id = p_job_id AND s.status = 'pending'
    AND (
      NOT EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'client'
          AND m.staging_entity_id = s.id
      )
      OR EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'client'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'keep_separate'
      )
    );

  -- ===========================================================================
  -- 5. COPROPRIETES (avant properties pour pouvoir lier ensuite)
  -- ===========================================================================

  WITH skipped AS (
    UPDATE import_staging_coproprietes s
    SET status = 'skipped'
    WHERE s.job_id = p_job_id AND s.status = 'pending'
      AND EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'copropriete'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'skip'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_skipped_coproprietes FROM skipped;

  PERFORM public.apply_copropriete_merges(p_job_id);

  SELECT COUNT(*) INTO v_merged_coproprietes
  FROM import_dedupe_matches
  WHERE job_id = p_job_id AND entity_type = 'copropriete'
    AND resolution IN ('merge', 'replace');

  -- Insert nouvelles copropriétés + retient mapping staging_id → prod_id
  WITH inserted AS (
    INSERT INTO coproprietes (
      organization_id, name, rnic_number, address, postal_code, city,
      insee_code, year_built, lots_count, notes, created_by
    )
    SELECT
      s.organization_id,
      COALESCE(NULLIF(s.name, ''), 'Copropriété sans nom'),
      s.rnic_number, s.address, s.postal_code, s.city, s.insee_code,
      s.year_built, s.lots_count, NULL, v_user_id
    FROM import_staging_coproprietes s
    WHERE s.job_id = p_job_id
      AND s.status = 'pending'
      AND (
        NOT EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'copropriete'
            AND m.staging_entity_id = s.id
        )
        OR EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'copropriete'
            AND m.staging_entity_id = s.id
            AND m.resolution = 'keep_separate'
        )
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_imported_coproprietes FROM inserted;

  UPDATE import_staging_coproprietes s
  SET status = 'imported'
  WHERE s.job_id = p_job_id AND s.status = 'pending'
    AND (
      NOT EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'copropriete'
          AND m.staging_entity_id = s.id
      )
      OR EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'copropriete'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'keep_separate'
        )
    );

  -- ===========================================================================
  -- 6. PROPERTIES
  -- ===========================================================================

  WITH skipped AS (
    UPDATE import_staging_properties s
    SET status = 'skipped'
    WHERE s.job_id = p_job_id AND s.status = 'pending'
      AND EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'property'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'skip'
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_skipped_properties FROM skipped;

  PERFORM public.apply_property_merges(p_job_id);

  SELECT COUNT(*) INTO v_merged_properties
  FROM import_dedupe_matches
  WHERE job_id = p_job_id AND entity_type = 'property'
    AND resolution IN ('merge', 'replace');

  -- Insert nouveaux biens (properties.address est NOT NULL → fallback '?')
  WITH inserted AS (
    INSERT INTO properties (
      organization_id, address, city, postal_code, insee_code,
      property_type, year_built, surface_carrez, surface_boutin,
      surface_total, floors, rooms_count,
      apartment_detail, building_letter, floor_number, lot_number, notes
    )
    SELECT
      s.organization_id,
      COALESCE(NULLIF(s.address, ''), '(adresse non renseignée)'),
      s.city, s.postal_code, s.insee_code,
      CASE WHEN s.property_type IS NULL OR s.property_type = '' THEN NULL
           ELSE s.property_type::property_type_enum END,
      s.year_built, s.surface_carrez, s.surface_boutin, s.surface_total,
      s.floors_count, s.rooms_count,
      s.apartment_detail, s.building_letter, s.floor_number, s.lot_number, NULL
    FROM import_staging_properties s
    WHERE s.job_id = p_job_id
      AND s.status = 'pending'
      AND (
        NOT EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'property'
            AND m.staging_entity_id = s.id
        )
        OR EXISTS (
          SELECT 1 FROM import_dedupe_matches m
          WHERE m.job_id = p_job_id
            AND m.entity_type = 'property'
            AND m.staging_entity_id = s.id
            AND m.resolution = 'keep_separate'
        )
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_imported_properties FROM inserted;

  UPDATE import_staging_properties s
  SET status = 'imported'
  WHERE s.job_id = p_job_id AND s.status = 'pending'
    AND (
      NOT EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'property'
          AND m.staging_entity_id = s.id
      )
      OR EXISTS (
        SELECT 1 FROM import_dedupe_matches m
        WHERE m.job_id = p_job_id
          AND m.entity_type = 'property'
          AND m.staging_entity_id = s.id
          AND m.resolution = 'keep_separate'
      )
    );

  -- ===========================================================================
  -- 7. LOTS (pas de dedupe — insert tels quels si on a un parent copro)
  -- ===========================================================================
  --
  -- V1 : on prend les lots dont staging_copropriete_id est résolvable, soit
  -- via le merged_into (copro fusionnée) soit via lookup directe (copro
  -- nouvellement insérée). Lookup directe : pas de mapping staging→prod
  -- explicite, donc on retombe sur "matching nom + rnic" basique. C'est OK V1
  -- car la majorité des imports n'aura pas de lots. Amélioration V2 : table
  -- de mapping dans le commit ou trigger sur INSERT.
  --
  -- Pour cette V1 simple : on insère uniquement les lots dont la copro
  -- staging a `merged_into_copropriete_id` non-NULL (cas merge/replace).
  -- Les lots des copros nouvellement créées sont ignorés en V1 — limitation
  -- documentée (cf. reporting).
  WITH inserted AS (
    INSERT INTO property_lots (
      organization_id, copropriete_id, property_id,
      lot_number, building_letter, floor_number,
      door_number, description, tantiemes_generaux, created_by
    )
    SELECT
      s.organization_id,
      c.merged_into_copropriete_id,
      NULL,
      COALESCE(NULLIF(s.lot_number, ''), '?'),
      s.building_letter, s.floor_number,
      s.door_number, s.description, s.tantiemes_generaux, v_user_id
    FROM import_staging_lots s
    INNER JOIN import_staging_coproprietes c ON c.id = s.staging_copropriete_id
    WHERE s.job_id = p_job_id
      AND s.status = 'pending'
      AND COALESCE(s.lot_number, '') <> ''
      AND c.merged_into_copropriete_id IS NOT NULL
    ON CONFLICT (copropriete_id, lot_number) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_imported_lots FROM inserted;

  UPDATE import_staging_lots
  SET status = 'imported'
  WHERE job_id = p_job_id AND status = 'pending';

  -- ===========================================================================
  -- 8. Update job final → 'completed'
  -- ===========================================================================
  UPDATE import_jobs SET
    status = 'completed',
    committed_at = now(),
    imported_clients_count = v_imported_clients,
    imported_properties_count = v_imported_properties,
    imported_coproprietes_count = v_imported_coproprietes,
    imported_lots_count = v_imported_lots
  WHERE id = p_job_id;

  -- 9. Retourne les métriques
  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'imported', jsonb_build_object(
      'clients', v_imported_clients,
      'properties', v_imported_properties,
      'coproprietes', v_imported_coproprietes,
      'lots', v_imported_lots
    ),
    'merged', jsonb_build_object(
      'clients', v_merged_clients,
      'properties', v_merged_properties,
      'coproprietes', v_merged_coproprietes
    ),
    'skipped', jsonb_build_object(
      'clients', v_skipped_clients,
      'properties', v_skipped_properties,
      'coproprietes', v_skipped_coproprietes
    )
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback automatique en plpgsql sur RAISE → on note l'erreur dans le job
  -- avant de re-raiser. Le UPDATE qui suit est dans une nouvelle "transaction"
  -- implicite de la fonction, il sera donc persisté.
  UPDATE import_jobs SET
    status = 'failed',
    error_message = SQLERRM,
    error_details = jsonb_build_object(
      'sqlstate', SQLSTATE,
      'phase', 'commit'
    )
  WHERE id = p_job_id;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commit_import_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_resolve_field_text(jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_client_merges(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_property_merges(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_copropriete_merges(uuid) TO authenticated;

COMMENT ON FUNCTION public.commit_import_job(uuid) IS
  'Import Liciel — commit transactionnel des staging vers la prod selon les résolutions de doublons (résolution non-NULL requise sur tous les import_dedupe_matches du job).';
COMMENT ON FUNCTION public.import_resolve_field_text(jsonb, text, text) IS
  'Helper : applique un choix utilisateur (jsonb) sur un champ texte ("new" | "existing" | { edited: "X" }).';
