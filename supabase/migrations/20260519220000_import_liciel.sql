-- ============================================================================
-- 20260519220000_import_liciel.sql
--
-- Feature : Import Liciel — récupération de la base existante d'un
-- diagnostiqueur depuis son logiciel Liciel vers KOVAS (clients + biens +
-- copropriétés + lots + historique diagnostics).
--
-- Cadre légal : art. 20 RGPD (droit à la portabilité) — l'utilisateur
-- exporte lui-même depuis Liciel et upload dans KOVAS. Aucun scraping,
-- aucun accès direct aux serveurs Liciel (cf. CLAUDE.md §13 stratégie
-- défensive Liciel).
--
-- Cette migration crée :
--  A. Tables PROD manquantes : coproprietes, property_lots
--     (le commit final de l'import a besoin de ces cibles)
--     + colonne properties.copropriete_id (FK nullable)
--  B. Tables STAGING : import_staging_clients, import_staging_properties,
--     import_staging_coproprietes, import_staging_lots
--  C. Table TRANSVERSE : import_jobs (suivi job) + import_dedupe_matches
--     (doublons détectés avec scoring)
--  D. RLS via public.is_member_of(organization_id)
--
-- Multi-tenant : tout passe par organization_id + helper is_member_of()
-- (cf. init_schema.sql §1). Les FK auth.users sont via created_by.
-- ============================================================================

-- ============================================================================
-- A. TABLES PRODUCTION — coproprietes + property_lots
-- ============================================================================

-- ----------------------------------------------------------------------------
-- coproprietes — copropriété immobilière (RNIC = registre national)
-- ----------------------------------------------------------------------------
CREATE TABLE coproprietes (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Identité copro
  name                     text NOT NULL,                                -- nom syndicat copro
  rnic_number              text,                                          -- n° immatriculation RNIC (format SIRET-like)
  -- Adresse
  address                  text,
  postal_code              text,
  city                     text,
  insee_code               text,
  location                 geography(POINT, 4326),                        -- PostGIS lat/lng
  -- Métadonnées
  year_built               int,
  lots_count               int,                                           -- nb total de lots (déclaré)
  -- Liens
  syndic_id                uuid REFERENCES clients(id) ON DELETE SET NULL,
  -- Tracking
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_coproprietes_org             ON coproprietes(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coproprietes_rnic            ON coproprietes(rnic_number)     WHERE rnic_number IS NOT NULL;
CREATE INDEX idx_coproprietes_syndic          ON coproprietes(syndic_id)       WHERE syndic_id IS NOT NULL;
CREATE INDEX idx_coproprietes_location_gist   ON coproprietes USING GIST(location);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_coproprietes
  BEFORE UPDATE ON coproprietes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- property_lots — lot de copropriété (1 lot = 1 ligne au règlement de copro)
-- Un lot peut être rattaché à un property concret (le bien diagnostiqué) ou
-- exister "à blanc" (juste référencé dans le règlement, pas encore visité).
-- ----------------------------------------------------------------------------
CREATE TABLE property_lots (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  copropriete_id           uuid NOT NULL REFERENCES coproprietes(id)  ON DELETE CASCADE,
  property_id              uuid REFERENCES properties(id) ON DELETE SET NULL, -- nullable
  -- Identité lot
  lot_number               text NOT NULL,                                -- "n°24", "lot 7"
  building_letter          text,                                          -- bât. A
  floor_number             int,                                           -- -5 à 60
  door_number              text,                                          -- "porte droite", "12B"
  description              text,                                          -- "studio cave"
  tantiemes_generaux       int,                                           -- millièmes
  -- Tracking
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (copropriete_id, lot_number)
);

CREATE INDEX idx_property_lots_org      ON property_lots(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_property_lots_copro    ON property_lots(copropriete_id);
CREATE INDEX idx_property_lots_property ON property_lots(property_id)     WHERE property_id IS NOT NULL;

CREATE TRIGGER set_updated_at_property_lots
  BEFORE UPDATE ON property_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- Ajout colonne properties.copropriete_id pour rattacher un bien à une copro
-- (un appartement dans un immeuble en copro pointe vers sa copro)
-- ----------------------------------------------------------------------------
ALTER TABLE properties
  ADD COLUMN copropriete_id uuid REFERENCES coproprietes(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_copropriete
  ON properties(copropriete_id) WHERE copropriete_id IS NOT NULL;

-- ============================================================================
-- B. TABLES STAGING — pendant l'import, avant commit final
-- ============================================================================

-- ----------------------------------------------------------------------------
-- import_jobs — un job par import (1 fichier uploadé)
-- ----------------------------------------------------------------------------
CREATE TABLE import_jobs (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by               uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,

  -- Statut du job (state machine)
  status                   text NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',      -- fichier reçu, pas encore parsé
    'parsing',       -- parsing en cours
    'parsed',        -- parsing terminé, données en staging
    'normalizing',   -- normalisation en cours
    'normalized',    -- normalisation terminée
    'deduping',      -- détection doublons en cours
    'deduped',       -- doublons détectés, attend validation user
    'committing',    -- import définitif en cours
    'completed',     -- import terminé avec succès
    'failed',        -- échec
    'cancelled'      -- annulé par l'utilisateur
  )),

  -- Source : fichier Liciel uploadé
  source_filename          text NOT NULL,
  source_filesize_bytes    bigint NOT NULL,
  source_storage_path      text NOT NULL,            -- bucket import-liciel-staging
  source_mime_type         text NOT NULL,
  source_format            text,                     -- 'csv' | 'xlsx' | 'xml' | 'zip-pdfs'

  -- Métriques d'extraction (rempli après parsing)
  detected_clients_count       int NOT NULL DEFAULT 0,
  detected_properties_count    int NOT NULL DEFAULT 0,
  detected_lots_count          int NOT NULL DEFAULT 0,
  detected_coproprietes_count  int NOT NULL DEFAULT 0,
  detected_diagnostics_count   int NOT NULL DEFAULT 0,

  -- Métriques de dédoublonnage (rempli après dedupe)
  duplicates_clients_count       int NOT NULL DEFAULT 0,
  duplicates_properties_count    int NOT NULL DEFAULT 0,
  duplicates_coproprietes_count  int NOT NULL DEFAULT 0,

  -- Métriques d'import final (rempli après commit)
  imported_clients_count       int NOT NULL DEFAULT 0,
  imported_properties_count    int NOT NULL DEFAULT 0,
  imported_lots_count          int NOT NULL DEFAULT 0,
  imported_coproprietes_count  int NOT NULL DEFAULT 0,

  -- Erreurs et logs
  error_message            text,
  error_details            jsonb,
  processing_log           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at               timestamptz NOT NULL DEFAULT now(),
  parsing_started_at       timestamptz,
  parsing_completed_at     timestamptz,
  dedupe_completed_at      timestamptz,
  committed_at             timestamptz,
  -- TTL : purge au-delà de 7 jours (cron à venir V1.5 via pg_cron)
  expires_at               timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_import_jobs_org_status ON import_jobs(organization_id, status);
CREATE INDEX idx_import_jobs_creator    ON import_jobs(created_by);
CREATE INDEX idx_import_jobs_expires    ON import_jobs(expires_at);

-- ----------------------------------------------------------------------------
-- import_staging_clients — clients en attente de validation
-- ----------------------------------------------------------------------------
CREATE TABLE import_staging_clients (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                   uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- duplique pour RLS perf

  -- Données brutes telles que dans Liciel (avant normalisation)
  raw_data                 jsonb NOT NULL,

  -- Données normalisées (alignées sur schéma clients prod)
  type                     text,                     -- particulier | agence | notaire | syndic | entreprise | collectivite
  display_name             text,
  first_name               text,
  last_name                text,
  company_name             text,
  siret                    text,
  email                    text,
  phone                    text,                     -- E.164 normalisé
  phone_mobile             text,
  address                  text,
  postal_code              text,
  city                     text,
  country                  text DEFAULT 'FR',
  apartment_detail         text,
  building_letter          text,
  floor_number             int,
  address_complement       text,
  notes                    text,

  -- Enrichissement
  insee_data               jsonb,                    -- API Sirene si SIRET vérifié
  geocoded_lat             numeric(10, 7),
  geocoded_lng             numeric(10, 7),
  ban_id                   text,                     -- ID Base Adresse Nationale

  -- Résolution
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'imported', 'merged', 'skipped'
  )),
  merged_into_client_id    uuid REFERENCES clients(id) ON DELETE SET NULL,

  -- Qualité
  normalization_warnings   jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score         numeric(3, 2),            -- 0.00 à 1.00

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_clients_job    ON import_staging_clients(job_id);
CREATE INDEX idx_staging_clients_org    ON import_staging_clients(organization_id);
CREATE INDEX idx_staging_clients_status ON import_staging_clients(status);
CREATE INDEX idx_staging_clients_email  ON import_staging_clients(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_staging_clients_siret  ON import_staging_clients(siret)        WHERE siret IS NOT NULL;

-- ----------------------------------------------------------------------------
-- import_staging_properties — biens en attente de validation
-- ----------------------------------------------------------------------------
CREATE TABLE import_staging_properties (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                   uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  raw_data                 jsonb NOT NULL,

  -- Données normalisées (alignées sur schéma properties prod)
  property_type            text,                     -- maison | appartement | immeuble | local_commercial | bureau | autre
  address                  text,
  postal_code              text,
  city                     text,
  insee_code               text,
  country                  text DEFAULT 'FR',
  -- Compléments adresse (étage / bât / apt / lot)
  apartment_detail         text,
  building_letter          text,
  floor_number             int,
  lot_number               text,
  -- Caractéristiques
  surface_total            numeric(8, 2),
  surface_carrez           numeric(8, 2),
  surface_boutin           numeric(8, 2),
  rooms_count              int,
  floors_count             int,
  year_built               int,

  -- Liens vers staging (résolus avant commit) ou prod directe
  staging_copropriete_id   uuid,                     -- FK ajoutée plus bas après création table
  staging_owner_client_id  uuid REFERENCES import_staging_clients(id) ON DELETE SET NULL,

  -- Géo
  geocoded_lat             numeric(10, 7),
  geocoded_lng             numeric(10, 7),
  ban_id                   text,
  cadastre_section         text,
  cadastre_numero          text,

  -- Enrichissement
  bdnb_data                jsonb,                    -- Base nationale du bâtiment
  street_view_url          text,                     -- URL Google Street View (lazy fetch)

  -- Résolution
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'imported', 'merged', 'skipped'
  )),
  merged_into_property_id  uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- Qualité
  normalization_warnings   jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score         numeric(3, 2),

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_properties_job      ON import_staging_properties(job_id);
CREATE INDEX idx_staging_properties_org      ON import_staging_properties(organization_id);
CREATE INDEX idx_staging_properties_status   ON import_staging_properties(status);
CREATE INDEX idx_staging_properties_geocoded ON import_staging_properties(geocoded_lat, geocoded_lng)
  WHERE geocoded_lat IS NOT NULL;

-- ----------------------------------------------------------------------------
-- import_staging_coproprietes — copropriétés en attente
-- ----------------------------------------------------------------------------
CREATE TABLE import_staging_coproprietes (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                   uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  raw_data                 jsonb NOT NULL,

  name                     text,
  rnic_number              text,                     -- format RNIC, sera validé côté normalizer
  address                  text,
  postal_code              text,
  city                     text,
  insee_code               text,
  year_built               int,
  lots_count               int,

  staging_syndic_id        uuid REFERENCES import_staging_clients(id) ON DELETE SET NULL,

  geocoded_lat             numeric(10, 7),
  geocoded_lng             numeric(10, 7),
  ban_id                   text,

  -- Résolution
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'imported', 'merged', 'skipped'
  )),
  merged_into_copropriete_id uuid REFERENCES coproprietes(id) ON DELETE SET NULL,

  normalization_warnings   jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score         numeric(3, 2),

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_copros_job    ON import_staging_coproprietes(job_id);
CREATE INDEX idx_staging_copros_org    ON import_staging_coproprietes(organization_id);
CREATE INDEX idx_staging_copros_rnic   ON import_staging_coproprietes(rnic_number) WHERE rnic_number IS NOT NULL;
CREATE INDEX idx_staging_copros_status ON import_staging_coproprietes(status);

-- FK différée sur import_staging_properties.staging_copropriete_id
ALTER TABLE import_staging_properties
  ADD CONSTRAINT fk_staging_properties_copro
  FOREIGN KEY (staging_copropriete_id)
  REFERENCES import_staging_coproprietes(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- import_staging_lots — lots en attente
-- ----------------------------------------------------------------------------
CREATE TABLE import_staging_lots (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                   uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  raw_data                 jsonb NOT NULL,

  lot_number               text,
  building_letter          text,
  floor_number             int,
  door_number              text,
  description              text,
  tantiemes_generaux       int,

  staging_copropriete_id   uuid REFERENCES import_staging_coproprietes(id) ON DELETE CASCADE,
  staging_property_id      uuid REFERENCES import_staging_properties(id)   ON DELETE SET NULL,

  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'imported', 'skipped'
  )),
  merged_into_lot_id       uuid REFERENCES property_lots(id) ON DELETE SET NULL,

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staging_lots_job    ON import_staging_lots(job_id);
CREATE INDEX idx_staging_lots_org    ON import_staging_lots(organization_id);
CREATE INDEX idx_staging_lots_copro  ON import_staging_lots(staging_copropriete_id);
CREATE INDEX idx_staging_lots_status ON import_staging_lots(status);

-- ----------------------------------------------------------------------------
-- import_dedupe_matches — doublons détectés et résolution user
-- ----------------------------------------------------------------------------
CREATE TABLE import_dedupe_matches (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id                   uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  organization_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  entity_type              text NOT NULL CHECK (entity_type IN ('client', 'property', 'copropriete')),

  -- Référence côté STAGING (à importer)
  staging_entity_id        uuid NOT NULL,

  -- Référence côté PROD (existant)
  existing_entity_id       uuid NOT NULL,

  -- Scoring
  confidence_score         numeric(3, 2) NOT NULL,   -- 0.00 à 1.00
  match_reasons            jsonb NOT NULL,           -- ex: ["email_exact","phone_normalized","name_lev:0.95"]

  -- Résolution utilisateur
  resolution               text CHECK (resolution IS NULL OR resolution IN (
    'merge',          -- fusionner (combine champs selon field_choices)
    'keep_separate',  -- garder les deux (importer comme nouveau)
    'replace',        -- remplacer l'existant par le nouveau
    'skip'            -- ignorer le nouveau
  )),
  field_choices            jsonb,                    -- si merge : { "email":"new", "phone":"existing", ... }
  resolved_by              uuid REFERENCES auth.users(id),
  resolved_at              timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dedupe_job             ON import_dedupe_matches(job_id);
CREATE INDEX idx_dedupe_org             ON import_dedupe_matches(organization_id);
CREATE INDEX idx_dedupe_unresolved      ON import_dedupe_matches(job_id) WHERE resolution IS NULL;
CREATE INDEX idx_dedupe_staging_entity  ON import_dedupe_matches(entity_type, staging_entity_id);

-- ============================================================================
-- C. ROW LEVEL SECURITY — via public.is_member_of(organization_id)
-- ============================================================================

ALTER TABLE coproprietes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_lots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staging_clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staging_properties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staging_coproprietes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_staging_lots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_dedupe_matches        ENABLE ROW LEVEL SECURITY;

-- ─── coproprietes ──────────────────────────────────────────────────
CREATE POLICY "coproprietes_select" ON coproprietes
  FOR SELECT USING (public.is_member_of(organization_id) AND deleted_at IS NULL);
CREATE POLICY "coproprietes_insert" ON coproprietes
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "coproprietes_update" ON coproprietes
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "coproprietes_delete" ON coproprietes
  FOR DELETE USING (public.is_member_of(organization_id));

-- ─── property_lots ─────────────────────────────────────────────────
CREATE POLICY "property_lots_select" ON property_lots
  FOR SELECT USING (public.is_member_of(organization_id) AND deleted_at IS NULL);
CREATE POLICY "property_lots_insert" ON property_lots
  FOR INSERT WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "property_lots_update" ON property_lots
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "property_lots_delete" ON property_lots
  FOR DELETE USING (public.is_member_of(organization_id));

-- ─── import_jobs ───────────────────────────────────────────────────
CREATE POLICY "import_jobs_select" ON import_jobs
  FOR SELECT USING (public.is_member_of(organization_id));
CREATE POLICY "import_jobs_insert" ON import_jobs
  FOR INSERT WITH CHECK (public.is_member_of(organization_id) AND created_by = auth.uid());
CREATE POLICY "import_jobs_update" ON import_jobs
  FOR UPDATE USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "import_jobs_delete" ON import_jobs
  FOR DELETE USING (public.is_member_of(organization_id));

-- ─── import_staging_clients ────────────────────────────────────────
CREATE POLICY "staging_clients_all" ON import_staging_clients
  FOR ALL USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ─── import_staging_properties ─────────────────────────────────────
CREATE POLICY "staging_properties_all" ON import_staging_properties
  FOR ALL USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ─── import_staging_coproprietes ───────────────────────────────────
CREATE POLICY "staging_copros_all" ON import_staging_coproprietes
  FOR ALL USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ─── import_staging_lots ───────────────────────────────────────────
CREATE POLICY "staging_lots_all" ON import_staging_lots
  FOR ALL USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ─── import_dedupe_matches ─────────────────────────────────────────
CREATE POLICY "dedupe_matches_all" ON import_dedupe_matches
  FOR ALL USING (public.is_member_of(organization_id))
  WITH CHECK (public.is_member_of(organization_id));

-- ============================================================================
-- D. STORAGE BUCKET — import-liciel-staging
-- ============================================================================
-- Bucket privé : accès via signed URLs ou service_role uniquement.
-- TTL : les fichiers sont supprimés en cascade quand import_jobs est purgé.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'import-liciel-staging',
  'import-liciel-staging',
  false,
  104857600,                                          -- 100 Mo max
  ARRAY[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/xml',
    'text/xml',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS sur storage.objects : un user accède seulement aux fichiers de son org
-- Le chemin convention : <organization_id>/<job_id>.<ext>
CREATE POLICY "import_liciel_staging_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'import-liciel-staging'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "import_liciel_staging_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'import-liciel-staging'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "import_liciel_staging_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'import-liciel-staging'
    AND public.is_member_of((string_to_array(name, '/'))[1]::uuid)
  );

-- ============================================================================
-- E. COMMENTAIRES (auto-doc côté Supabase Studio)
-- ============================================================================
COMMENT ON TABLE  coproprietes                IS 'Copropriétés (RNIC) — entité prod, peut être créée via import Liciel ou à la main.';
COMMENT ON TABLE  property_lots               IS 'Lots de copropriété rattachés à 1 copro + éventuellement 1 property concret.';
COMMENT ON TABLE  import_jobs                 IS 'Jobs d''import Liciel — un par fichier uploadé. State machine : uploaded→parsing→…→completed.';
COMMENT ON TABLE  import_staging_clients      IS 'Clients en staging avant validation user (dédoublonnage, fusion).';
COMMENT ON TABLE  import_staging_properties   IS 'Biens en staging avant validation user.';
COMMENT ON TABLE  import_staging_coproprietes IS 'Copropriétés en staging avant validation user.';
COMMENT ON TABLE  import_staging_lots         IS 'Lots de copropriété en staging avant validation user.';
COMMENT ON TABLE  import_dedupe_matches       IS 'Doublons détectés entre staging et prod avec score de confiance + résolution user.';

COMMENT ON COLUMN import_jobs.status          IS 'State machine : uploaded → parsing → parsed → normalizing → normalized → deduping → deduped → committing → completed (ou failed/cancelled).';
COMMENT ON COLUMN import_dedupe_matches.match_reasons IS 'Array JSON des raisons du match : ["email_exact","phone_normalized","name_lev:0.95",...]';
COMMENT ON COLUMN import_dedupe_matches.field_choices IS 'Si resolution=merge : map champ → "new"|"existing"|"edited" + valeur si edited.';
