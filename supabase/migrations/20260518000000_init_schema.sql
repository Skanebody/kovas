-- ============================================
-- KOVAS App — Schéma initial Supabase
-- Date : 2026-05-18
-- Région : eu-west-3 (Paris)
-- Cf. research/supabase-architecture.md §3
-- ============================================

-- ============================================
-- 0. Extensions PostgreSQL
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- BAN/cadastre PostGIS
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- search clients/properties
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector RAG KB Phase 2+ + auto-apprentissage

-- ============================================
-- 1. Helper SECURITY DEFINER (PERFORMANCE CRITIQUE)
-- Cf. research/supabase-architecture.md §2 — #1 production gotcha
-- ============================================
CREATE OR REPLACE FUNCTION auth.is_member_of(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;

-- ============================================
-- 2. Organizations + Profiles + Memberships (multi-tenant from day 1)
-- ============================================

CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  siret           text UNIQUE,
  vat_number      text,
  address         text,
  city            text,
  postal_code     text,
  country         text NOT NULL DEFAULT 'FR',
  certification_n text, -- COFRAC certification number
  stripe_customer_id text UNIQUE,
  plan            text NOT NULL DEFAULT 'decouverte', -- decouverte | standard | volume | founder
  plan_status     text NOT NULL DEFAULT 'trialing',
  trial_ends_at   timestamptz,
  current_period_end timestamptz,
  -- Modification 18 : préférences export (paramétrage logiciel principal + mode)
  default_logiciel text DEFAULT 'liciel', -- liciel | analysimmo | obbc | oris | autre
  default_export_mode text DEFAULT 'gdrive', -- email | gdrive | dropbox | download
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX idx_orgs_stripe ON organizations (stripe_customer_id);

CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  phone           text, -- E.164 format
  avatar_url      text,
  default_org_id  uuid REFERENCES organizations(id),
  locale          text NOT NULL DEFAULT 'fr',
  timezone        text NOT NULL DEFAULT 'Europe/Paris',
  notification_prefs jsonb DEFAULT '{}'::jsonb,
  -- Profil linguistique (auto-apprentissage personnalisation, cf. ai-autonomy-strategy.md §9)
  linguistic_profile jsonb DEFAULT '{}'::jsonb,
  last_active_at  timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner','admin','diag','assistant')),
  invited_email   text,
  invited_by      uuid REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'active',  -- pending | active | revoked
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_memberships_user ON memberships (user_id);
CREATE INDEX idx_memberships_org ON memberships (organization_id);

-- ============================================
-- 3. Clients
-- ============================================
CREATE TYPE client_type AS ENUM (
  'particulier','agence','notaire','syndic','entreprise','collectivite'
);

CREATE TABLE clients (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            client_type NOT NULL DEFAULT 'particulier',
  display_name    text NOT NULL,
  first_name      text,
  last_name       text,
  company_name    text,
  email           text,
  phone           text, -- E.164
  address         text,
  city            text,
  postal_code     text,
  country         text DEFAULT 'FR',
  siret           text,
  notes           text,
  tags            text[] DEFAULT '{}',
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX idx_clients_org ON clients (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_search ON clients USING gin (
  (display_name || ' ' || COALESCE(email,'') || ' ' || COALESCE(phone,'')) gin_trgm_ops
);

-- ============================================
-- 4. Properties (PostGIS + BAN + cadastre)
-- ============================================
CREATE TYPE property_type_enum AS ENUM (
  'maison','appartement','immeuble','local_commercial','bureau','autre'
);

CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  ban_id          text,
  address         text NOT NULL,
  city            text,
  postal_code     text,
  insee_code      text,
  location        geography(Point, 4326),
  cadastre_section text,
  cadastre_number  text,
  cadastre_prefix  text,
  property_type   property_type_enum,
  year_built      int,
  surface_carrez  numeric(8,2),
  surface_boutin  numeric(8,2),
  surface_total   numeric(8,2),
  floors          int,
  rooms_count     int,
  heating_type    text,
  energy_class    text CHECK (energy_class IN ('A','B','C','D','E','F','G') OR energy_class IS NULL),
  ges_class       text CHECK (ges_class IN ('A','B','C','D','E','F','G') OR ges_class IS NULL),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX idx_properties_org ON properties (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_client ON properties (client_id);
CREATE INDEX idx_properties_loc ON properties USING gist (location);
CREATE INDEX idx_properties_cadastre ON properties (cadastre_section, cadastre_number);

-- ============================================
-- 5. Missions (Modification 18 : 8 diagnostics standards uniquement)
-- ============================================
CREATE TYPE mission_type AS ENUM (
  'dpe_vente','dpe_location','copropriete',
  'amiante_vente','amiante_avant_travaux',
  'plomb_crep',
  'gaz',
  'electricite',
  'termites',
  'carrez_boutin',
  'erp'
  -- EXCLUS DÉFINITIVEMENT : audit_energetique, dtg
);

CREATE TYPE mission_status AS ENUM (
  'draft','scheduled','in_progress','to_review','done','exported','archived','cancelled'
);

CREATE TABLE missions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     uuid NOT NULL REFERENCES properties(id),
  client_id       uuid REFERENCES clients(id),
  assigned_to     uuid REFERENCES auth.users(id),
  created_by      uuid REFERENCES auth.users(id),
  reference       text NOT NULL, -- MIS-2026-00042 (per-org seq)
  type            mission_type NOT NULL,
  status          mission_status NOT NULL DEFAULT 'draft',
  priority        int DEFAULT 0,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  exported_at     timestamptz,
  liciel_export_path text,
  liciel_export_hash text,
  -- Modification 18 : Upload doc propriétaire feature #6
  client_upload_token text UNIQUE, -- token pour lien public client uploade docs avant visite
  client_upload_expires_at timestamptz,
  dpe_letter      text CHECK (dpe_letter IN ('A','B','C','D','E','F','G') OR dpe_letter IS NULL),
  ges_letter      text CHECK (ges_letter IN ('A','B','C','D','E','F','G') OR ges_letter IS NULL),
  energy_value    numeric(8,2),
  ges_value       numeric(8,2),
  voice_seconds_total int DEFAULT 0,
  photos_count    int DEFAULT 0,
  equipment_findings_count int DEFAULT 0,
  ai_cost_eur     numeric(10,4) DEFAULT 0,
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (organization_id, reference)
);
CREATE INDEX idx_missions_org_status ON missions (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_missions_org_scheduled ON missions (organization_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_missions_property ON missions (property_id);
CREATE INDEX idx_missions_assigned ON missions (assigned_to);
CREATE INDEX idx_missions_upload_token ON missions (client_upload_token) WHERE client_upload_token IS NOT NULL;

-- ============================================
-- 6. Mission rooms (templates pré-remplis Modification 18 #4)
-- ============================================
CREATE TABLE mission_rooms (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  room_type       text,
  position        int DEFAULT 0,
  surface_m2      numeric(6,2),
  ceiling_height_m numeric(4,2),
  has_heating     boolean DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rooms_mission ON mission_rooms (mission_id, position);

-- ============================================
-- 7. Equipment findings (préparation Vision IA V2)
-- ============================================
CREATE TYPE equipment_kind AS ENUM (
  'chaudiere','chauffe_eau','radiateur','pac','climatisation',
  'fenetre','isolation','ventilation','tableau_elec','autre'
);

CREATE TABLE equipment_findings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  photo_id        uuid, -- FK ajoutée plus bas (forward declaration)
  kind            equipment_kind NOT NULL,
  brand           text,
  model           text,
  energy_class    text,
  year_install    int,
  details         jsonb DEFAULT '{}'::jsonb,
  ai_provider     text DEFAULT 'manual', -- 'manual' V1, 'anthropic_vision' V2
  ai_model        text,
  ai_confidence   numeric(4,3),
  ai_cost_eur     numeric(10,4),
  reviewed        boolean DEFAULT false,
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_findings_mission ON equipment_findings (mission_id);
CREATE INDEX idx_findings_room ON equipment_findings (room_id);

-- ============================================
-- 8. Voice notes (Whisper + Claude hybride Modification 18)
-- ============================================
CREATE TABLE voice_notes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  recorded_by     uuid REFERENCES auth.users(id),
  storage_path    text NOT NULL,
  duration_seconds int,
  language        text DEFAULT 'fr',
  provider        text, -- 'openai_whisper' | 'deepgram_nova3' | 'ios_speech'
  transcript_raw  text,
  transcript_structured jsonb,
  -- Modification 18 : tracking parser custom vs Claude Haiku
  parser_used     text, -- 'custom_js' | 'claude_haiku' | 'hybrid'
  ai_cost_eur     numeric(10,4),
  ai_confidence   numeric(4,3),
  status          text NOT NULL DEFAULT 'pending', -- pending|uploading|transcribing|structuring|transcribed|failed
  created_at      timestamptz NOT NULL DEFAULT now(),
  transcribed_at  timestamptz
);
CREATE INDEX idx_voice_mission ON voice_notes (mission_id);
CREATE INDEX idx_voice_status ON voice_notes (organization_id, status)
  WHERE status IN ('pending','transcribing','transcribed');

-- ============================================
-- 9. Sketches (annotations photos V1 + croquis Pencil V2)
-- ============================================
CREATE TABLE sketches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  source          text NOT NULL, -- 'photo_annotation' V1, 'pencil_v2', 'lidar_v3'
  geometry        jsonb NOT NULL,
  preview_path    text,
  surface_carrez_m2 numeric(8,2),
  surface_boutin_m2 numeric(8,2),
  ai_cost_eur     numeric(10,4),
  reviewed        boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sketches_mission ON sketches (mission_id);

-- ============================================
-- 10. Photos (high-volume, monthly partitions, WebP compression Modification 18)
-- ============================================
CREATE TABLE photos (
  id              uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  mission_id      uuid NOT NULL,
  room_id         uuid,
  storage_path    text NOT NULL,
  thumb_path      text,
  width           int,
  height          int,
  size_bytes      int,
  mime_type       text DEFAULT 'image/webp', -- WebP par défaut (PWA pivot Modification 17)
  taken_at        timestamptz,
  location        geography(Point, 4326),
  caption         text,
  ai_tags         text[] DEFAULT '{}', -- V2 Vision IA tags
  ai_cost_eur     numeric(10,4) DEFAULT 0,
  uploaded_by     uuid REFERENCES auth.users(id),
  sync_status     text DEFAULT 'pending', -- pending | syncing | synced
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partition mai 2026 (premières missions)
CREATE TABLE photos_2026_05 PARTITION OF photos
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE photos_2026_06 PARTITION OF photos
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE photos_2026_07 PARTITION OF photos
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE photos_2026_08 PARTITION OF photos
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE photos_2026_09 PARTITION OF photos
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
-- pg_partman recommandé pour partitions automatiques mensuelles ultérieures

CREATE INDEX idx_photos_mission ON photos (mission_id);
CREATE INDEX idx_photos_org_created ON photos (organization_id, created_at DESC);

-- FK forward declaration equipment_findings.photo_id
ALTER TABLE equipment_findings
  ADD CONSTRAINT fk_finding_photo FOREIGN KEY (photo_id, created_at) -- partition key
  REFERENCES photos(id, created_at) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ============================================
-- 11. Documents propriétaire (feature #6 Modification 18 — upload via lien public)
-- ============================================
CREATE TABLE owner_documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  storage_path    text NOT NULL,
  original_name   text,
  size_bytes      int,
  mime_type       text,
  doc_kind        text, -- 'facture_energie' | 'plan' | 'ancien_dpe' | 'titre_propriete' | 'autre'
  uploaded_at     timestamptz DEFAULT now(),
  reviewed_by_diag boolean DEFAULT false
);
CREATE INDEX idx_owner_docs_mission ON owner_documents (mission_id);

-- ============================================
-- 12. Quotes (devis)
-- ============================================
CREATE TABLE quotes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id),
  mission_id      uuid REFERENCES missions(id),
  reference       text NOT NULL, -- DEV-2026-00042
  status          text NOT NULL DEFAULT 'draft', -- draft|sent|accepted|refused|expired
  amount_ht       numeric(10,2) NOT NULL,
  amount_tva      numeric(10,2) NOT NULL,
  amount_ttc      numeric(10,2) NOT NULL,
  tva_rate        numeric(5,2) DEFAULT 20.0,
  line_items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_path        text,
  issued_at       date,
  expires_at      date,
  accepted_at     timestamptz,
  signature_provider text, -- 'docuseal' | 'yousign'
  signature_id    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);

-- ============================================
-- 13. Invoices (Factur-X, snapshot client pour rétention 10 ans Code Commerce)
-- ============================================
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL, -- SET NULL pour RGPD delete + snapshot retention
  mission_id      uuid REFERENCES missions(id),
  quote_id        uuid REFERENCES quotes(id),
  reference       text NOT NULL, -- FAC-2026-00042
  status          text NOT NULL DEFAULT 'draft', -- draft|issued|paid|partial|overdue|cancelled
  amount_ht       numeric(10,2) NOT NULL,
  amount_tva      numeric(10,2) NOT NULL,
  amount_ttc      numeric(10,2) NOT NULL,
  paid_amount     numeric(10,2) DEFAULT 0,
  tva_rate        numeric(5,2) DEFAULT 20.0,
  line_items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_path        text,
  facturx_xml     text,
  facturx_profile text DEFAULT 'EN16931',
  ppf_transmission_id text,
  ppf_status      text,
  stripe_payment_intent text,
  payment_method  text, -- sepa | card | virement
  due_date        date,
  paid_at         timestamptz,
  reminder_j7_sent_at  timestamptz,
  reminder_j15_sent_at timestamptz,
  reminder_j30_sent_at timestamptz,
  -- Snapshot client pour rétention 10 ans Code Commerce L123-22 (survie suppression RGPD)
  client_snapshot jsonb,
  issued_at       date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);
CREATE INDEX idx_invoices_org_status ON invoices (organization_id, status);
CREATE INDEX idx_invoices_overdue ON invoices (organization_id, due_date)
  WHERE status IN ('issued','partial','overdue');

-- ============================================
-- 14. Events (audit log, partitioned, append-only)
-- ============================================
CREATE TABLE events (
  id              uuid NOT NULL DEFAULT uuid_generate_v4(),
  organization_id uuid,
  user_id         uuid,
  actor_email     text,
  actor_ip        inet,
  user_agent      text,
  event_type      text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  payload         jsonb DEFAULT '{}'::jsonb,
  changes         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_05 PARTITION OF events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE events_2026_06 PARTITION OF events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_events_org_time ON events (organization_id, created_at DESC);
CREATE INDEX idx_events_entity ON events (entity_type, entity_id);
CREATE INDEX idx_events_user_time ON events (user_id, created_at DESC);

-- Mutation block on events (append-only)
CREATE OR REPLACE FUNCTION block_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_no_update
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION block_events_mutation();

-- ============================================
-- 15. AI usage ledger
-- ============================================
CREATE TABLE ai_usage (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  mission_id      uuid REFERENCES missions(id),
  provider        text NOT NULL, -- 'anthropic' | 'openai' | 'deepgram'
  model           text NOT NULL,
  operation       text NOT NULL, -- 'voice_transcribe' | 'voice_structure' | 'vision_equipment' | 'chat'
  input_tokens    int,
  output_tokens   int,
  cached_tokens   int,
  audio_seconds   int,
  cost_eur        numeric(10,6) NOT NULL,
  latency_ms      int,
  fallback_used   boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_org_time ON ai_usage (organization_id, created_at DESC);

-- ============================================
-- 16. Reference counters (numérotation continue per-org, Code Commerce L123-22)
-- ============================================
CREATE TABLE reference_counters (
  organization_id uuid NOT NULL,
  kind            text NOT NULL, -- 'invoice' | 'quote' | 'mission'
  year            int NOT NULL,
  last_value      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, kind, year)
);

CREATE OR REPLACE FUNCTION next_reference(p_org uuid, p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM now());
  v_next bigint;
  v_prefix text := CASE p_kind
    WHEN 'invoice' THEN 'FAC'
    WHEN 'quote' THEN 'DEV'
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
-- 17. Support tickets (ticketing custom Supabase + Resend, Modification 18 §14)
-- ============================================
CREATE TABLE support_tickets (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  subject         text NOT NULL,
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'open', -- open | in_progress | waiting_user | resolved | closed
  priority        text DEFAULT 'normal', -- low | normal | high | critical
  last_message_at timestamptz DEFAULT now(),
  ai_classification text, -- output Claude Haiku classification
  ai_suggested_response text,
  ai_confidence   numeric(4,3),
  escalated_to_human boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_org ON support_tickets (organization_id, status);

CREATE TABLE support_messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id       uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  from_role       text NOT NULL CHECK (from_role IN ('user', 'claude', 'founder')),
  body            text NOT NULL,
  attachments     jsonb DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_messages_ticket ON support_messages (ticket_id, created_at);

-- ============================================
-- 18. Status page incidents (Modification 18 §14 — custom status page)
-- ============================================
CREATE TABLE incidents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  active          boolean NOT NULL DEFAULT true,
  severity        text NOT NULL DEFAULT 'info', -- info | warning | critical
  message         text NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  root_cause      text,
  resolution_notes text
);
CREATE INDEX idx_incidents_active ON incidents (started_at DESC) WHERE active;

-- ============================================
-- 19. Vision corrections (auto-apprentissage V2+, cf. ai-autonomy-strategy.md §8)
-- ============================================
CREATE TABLE vision_corrections (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  mission_id      uuid NOT NULL,
  photo_id        uuid NOT NULL,
  ai_provider     text NOT NULL,
  ai_model        text NOT NULL,
  ai_brand        text,
  ai_model_eq     text,
  ai_confidence   numeric(4,3),
  user_brand      text,
  user_model_eq   text,
  user_notes      text,
  corrected_at    timestamptz NOT NULL DEFAULT now(),
  used_in_training boolean DEFAULT false,
  training_session_id uuid
);
CREATE INDEX idx_vision_corrections_pending ON vision_corrections (corrected_at)
  WHERE used_in_training = false;

-- ============================================
-- 20. Jobs queue (async tasks : exports lourds, re-training, etc.)
-- ============================================
CREATE TABLE jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL, -- 'liciel_export' | 'email_recap' | 'pdf_export' | etc.
  status          text NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  result          jsonb,
  error           text,
  attempts        int DEFAULT 0,
  max_attempts    int DEFAULT 3,
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_pickup ON jobs (status, scheduled_for)
  WHERE status IN ('queued','running');

-- ============================================
-- 21. AUTH TRIGGER : auto-création organization + membership owner au signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- 1. Profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name);

  -- 2. Default organization (Phase 1 = solo, Phase 2+ = invite-based for multi-user)
  INSERT INTO public.organizations (name)
  VALUES (v_full_name || ' — cabinet')
  RETURNING id INTO v_org_id;

  -- 3. Owner membership
  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (v_org_id, NEW.id, 'owner', 'active');

  -- 4. Set default_org_id on profile
  UPDATE public.profiles SET default_org_id = v_org_id WHERE id = NEW.id;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 22. AUDIT TRIGGER : capture changes sur business tables
-- ============================================
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org uuid;
  v_user uuid := auth.uid();
  v_changes jsonb;
BEGIN
  v_org := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.organization_id
    ELSE NEW.organization_id
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(key, jsonb_build_object('from', old_val, 'to', new_val))
    INTO v_changes
    FROM (
      SELECT key, value AS new_val, (to_jsonb(OLD) -> key) AS old_val
      FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(OLD) -> key IS DISTINCT FROM value
    ) t;
  END IF;

  INSERT INTO events (organization_id, user_id, event_type, entity_type, entity_id, payload, changes)
  VALUES (
    v_org,
    v_user,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
    v_changes
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Apply audit trigger to critical business tables
CREATE TRIGGER trg_audit_missions
  AFTER INSERT OR UPDATE OR DELETE ON missions
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_properties
  AFTER INSERT OR UPDATE OR DELETE ON properties
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_quotes
  AFTER INSERT OR UPDATE OR DELETE ON quotes
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

CREATE TRIGGER trg_audit_equipment_findings
  AFTER INSERT OR UPDATE OR DELETE ON equipment_findings
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- ============================================
-- 23. UPDATED_AT auto-update triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mission_rooms_updated BEFORE UPDATE ON mission_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sketches_updated BEFORE UPDATE ON sketches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 24. ENABLE RLS sur toutes les business tables
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sketches ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 25. RLS POLICIES (via auth.is_member_of() helper)
-- ============================================

-- Organizations : user can see orgs they belong to
CREATE POLICY "members read orgs" ON organizations FOR SELECT TO authenticated
  USING (auth.is_member_of(id));

-- Profiles : user reads own + members of same orgs
CREATE POLICY "user reads own profile" ON profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "user updates own profile" ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));

-- Memberships : members read their memberships
CREATE POLICY "members read own memberships" ON memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR auth.is_member_of(organization_id));

-- Clients : members CRUD within their org
CREATE POLICY "members read clients" ON clients FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));
CREATE POLICY "members write clients" ON clients FOR INSERT TO authenticated
  WITH CHECK (auth.is_member_of(organization_id));
CREATE POLICY "members update clients" ON clients FOR UPDATE TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Properties (idem)
CREATE POLICY "members read properties" ON properties FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));
CREATE POLICY "members write properties" ON properties FOR INSERT TO authenticated
  WITH CHECK (auth.is_member_of(organization_id));
CREATE POLICY "members update properties" ON properties FOR UPDATE TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Missions
CREATE POLICY "members read missions" ON missions FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));
CREATE POLICY "members write missions" ON missions FOR INSERT TO authenticated
  WITH CHECK (auth.is_member_of(organization_id));
CREATE POLICY "members update missions" ON missions FOR UPDATE TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Mission rooms
CREATE POLICY "members crud mission_rooms" ON mission_rooms FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Equipment findings
CREATE POLICY "members crud findings" ON equipment_findings FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Voice notes
CREATE POLICY "members crud voice_notes" ON voice_notes FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Sketches
CREATE POLICY "members crud sketches" ON sketches FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Photos
CREATE POLICY "members crud photos" ON photos FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Owner documents (members CRUD + public via client_upload_token handled in Edge Function)
CREATE POLICY "members read owner_docs" ON owner_documents FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));
CREATE POLICY "members write owner_docs" ON owner_documents FOR INSERT TO authenticated
  WITH CHECK (auth.is_member_of(organization_id));

-- Quotes
CREATE POLICY "members crud quotes" ON quotes FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Invoices
CREATE POLICY "members crud invoices" ON invoices FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Events (read-only client side, INSERTs via SECURITY DEFINER trigger)
CREATE POLICY "members read events" ON events FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));

-- AI usage
CREATE POLICY "members read ai_usage" ON ai_usage FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));

-- Support tickets : user reads own + members of same org
CREATE POLICY "user reads own tickets" ON support_tickets FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR auth.is_member_of(organization_id));
CREATE POLICY "user creates own tickets" ON support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND auth.is_member_of(organization_id));

CREATE POLICY "ticket owners read messages" ON support_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "ticket owners write messages" ON support_messages FOR INSERT TO authenticated
  WITH CHECK (ticket_id IN (SELECT id FROM support_tickets WHERE user_id = (SELECT auth.uid())));

-- Vision corrections (members add corrections within their org)
CREATE POLICY "members crud vision_corrections" ON vision_corrections FOR ALL TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- Jobs (members read their org's jobs)
CREATE POLICY "members read jobs" ON jobs FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));

-- ============================================
-- 26. REPLICA IDENTITY FULL (pour Supabase Realtime DELETE events complets)
-- ============================================
ALTER TABLE missions REPLICA IDENTITY FULL;
ALTER TABLE photos REPLICA IDENTITY FULL;
ALTER TABLE voice_notes REPLICA IDENTITY FULL;
ALTER TABLE equipment_findings REPLICA IDENTITY FULL;
ALTER TABLE sketches REPLICA IDENTITY FULL;

-- ============================================
-- 27. PUBLISH tables to Supabase Realtime (à activer via Studio ou ALTER PUBLICATION)
-- ============================================
-- NOTE: Run manually in Supabase Studio after migration push :
-- ALTER PUBLICATION supabase_realtime ADD TABLE missions, photos, voice_notes, equipment_findings, mission_rooms;

-- ============================================
-- FIN MIGRATION INITIALE
-- 20 tables principales + 7 partitions photos/events + 14 RLS policies + 3 helper functions + 8 triggers
-- ============================================
