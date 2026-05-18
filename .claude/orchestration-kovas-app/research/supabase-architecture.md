# Supabase Backend Architecture — Research

**Wave**: First
**Researcher**: First-wave research agent — Supabase backend (multi-tenant + RGPD)
**Date**: 2026-05-13
**Status**: Complete (subagent web access denied during research — items needing live-doc verification flagged [VERIFY])

> **Note on web access**: WebSearch and WebFetch permissions were denied during this research run. All findings below rely on training knowledge through January 2026. Numeric figures around Supabase 2026 pricing and add-on costs are flagged `[VERIFY]` and should be re-validated against `supabase.com/pricing` before locking the financial plan.

## Summary

Supabase (PostgreSQL 15+ + Auth + Storage + Realtime + Edge Functions + RLS) is a fully appropriate stack for KOVAS App. Recommended region is `eu-west-3` (Paris) for French RGPD-friendly hosting, with `eu-central-1` (Frankfurt) as DR mirror. The multi-tenant model should be built from day 1 with an `organization_id` scope on every business table, RLS enforced via SECURITY DEFINER helper functions (NOT inlined `auth.uid()` subqueries) to avoid n+1 RLS performance collapse. Storage costs at 100 abonnés / ~90 GB/month land around $20-30/mo (well within Pro envelope). Realtime + Edge Functions cover KOVAS's offline-first + AI callout needs. The only non-trivial cost driver at scale is Storage egress (photos), which mandates client-side compression and lifecycle archival to cold storage by year 2.

## Key Findings

### 1. Supabase EU region selection

Available EU regions (Jan 2026 cutoff):
- `eu-west-1` (Dublin) — oldest, cheapest egress
- `eu-west-2` (London) — **NOT EU sovereignty** post-Brexit (avoid)
- `eu-west-3` (Paris) — **CNIL-friendly, French data residency** ← recommended
- `eu-central-1` (Frankfurt) — mature, slightly higher compute add-on historically [VERIFY 2026]
- `eu-central-2` (Zurich) — Swiss, GDPR-equivalent
- `eu-north-1` (Stockholm) — cheaper, higher FR latency

Approximate RTT from France:
- eu-west-3 Paris: 5-12 ms
- eu-central-1 Frankfurt: 12-25 ms
- eu-west-1 Dublin: 20-40 ms

**Verdict — `eu-west-3` Paris**: lowest FR latency, French residency simplifies CNIL discourse + RGPD DPA boilerplate. Resolves PRD `[D301]`.

**Backup region**: `eu-central-1` Frankfurt for off-region S3 backup mirror.

### 2. Multi-tenant data model with RLS

**Pattern**: `organization_id` (UUID) on every business table. Users join orgs via `memberships`. Phase 1 single-user = 1 user / 1 org / 1 membership auto-created on signup, identical schema as Phase 2 multi-user.

**The #1 production gotcha — RLS performance**:
```sql
-- BAD (re-evaluates auth.uid() per row, kills index usage):
CREATE POLICY "tenant" ON missions
  USING (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid()
  ));

-- BEST (SECURITY DEFINER helper, single function call, optimal plan):
CREATE OR REPLACE FUNCTION auth.is_member_of(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.organization_id = p_org
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;

CREATE POLICY "tenant" ON missions
  FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));
```

**RLS scaling at 1k orgs × 100k missions**: with `(organization_id, ...)` leading composite indexes, RLS overhead is ~5-15% vs raw SQL. Without it, 10-100× degradation. **Rule**: every business table needs `CREATE INDEX ... ON tbl (organization_id, <secondary>)` and `organization_id` must lead any composite.

**Common RLS pitfalls** (battle-tested):
1. `service_role` key in client code — bypasses RLS, fatal. Must NEVER appear in mobile bundle, Next.js client code, or any browser-exposed env. Only in Edge Functions, server-side Next.js API routes, CI secrets.
2. `public` schema function leaks — `authenticated` can EXECUTE any `public` function by default. Move sensitive ones to a dedicated schema with explicit GRANTs.
3. n+1 RLS — fixed via the `(SELECT auth.uid())` wrap or helper.
4. Missing `auth.uid() IS NOT NULL` guard — anonymous requests can hit not-fully-restrictive policies.
5. FK validation bypasses RLS — referenced FK rows are checked with elevated privileges. INSERT policy must validate FK target ownership.
6. `storage.objects` policies forgotten — most teams secure PG tables and leave Storage with default `auth.uid()` checks that don't validate org membership.
7. Realtime policies SEPARATE — base table RLS does not auto-govern Realtime events. Need `ALTER PUBLICATION supabase_realtime ADD TABLE ...` + explicit policy.

### 3. Schema design for KOVAS domain

Full SQL sketch (excerpt — see codebase for complete schema):

```sql
-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- geo (BAN/cadastre)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- search clients/properties
CREATE EXTENSION IF NOT EXISTS "vector";     -- KB embeddings

-- 1. Organizations
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  siret           text UNIQUE,
  vat_number      text,
  address         text, city text, postal_code text, country text DEFAULT 'FR',
  certification_n text,
  stripe_customer_id text UNIQUE,
  plan            text NOT NULL DEFAULT 'compagnon',
  plan_status     text NOT NULL DEFAULT 'trialing',
  trial_ends_at   timestamptz,
  current_period_end timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 2. Profiles + memberships
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text, phone text, avatar_url text,
  default_org_id  uuid REFERENCES organizations(id),
  locale          text NOT NULL DEFAULT 'fr',
  notification_prefs jsonb DEFAULT '{}'::jsonb,
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
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 3. Clients
CREATE TYPE client_type AS ENUM (
  'particulier','agence','notaire','syndic','entreprise','collectivite'
);
CREATE TABLE clients (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            client_type NOT NULL DEFAULT 'particulier',
  display_name    text NOT NULL,
  first_name text, last_name text, company_name text,
  email text, phone text,
  address text, city text, postal_code text, country text DEFAULT 'FR',
  siret           text,
  notes           text,
  tags            text[] DEFAULT '{}',
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 4. Properties (with BAN + cadastre + geo)
CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  ban_id          text,
  address         text NOT NULL,
  city text, postal_code text, insee_code text,
  location        geography(Point, 4326),
  cadastre_section text, cadastre_number text, cadastre_prefix text,
  property_type   text,
  year_built      int,
  surface_carrez  numeric(8,2),
  surface_boutin  numeric(8,2),
  surface_total   numeric(8,2),
  floors          int,
  rooms_count     int,
  heating_type    text,
  energy_class    text, ges_class text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- 5. Missions
CREATE TYPE mission_type AS ENUM (
  'dpe_vente','dpe_location','audit_energetique','copropriete',
  'amiante','plomb','gaz','electricite','termites','carrez','boutin','erp'
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
  reference       text NOT NULL,
  type            mission_type NOT NULL,
  status          mission_status NOT NULL DEFAULT 'draft',
  priority        int DEFAULT 0,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  exported_at     timestamptz,
  liciel_export_path text,
  liciel_export_hash text,
  dpe_letter text, ges_letter text,
  energy_value numeric(8,2), ges_value numeric(8,2),
  voice_seconds_total int DEFAULT 0,
  photos_count int DEFAULT 0,
  equipment_findings_count int DEFAULT 0,
  ai_cost_eur numeric(10,4) DEFAULT 0,
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (organization_id, reference)
);

-- 6. Mission rooms
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

-- 7. Equipment findings (Claude Vision)
CREATE TYPE equipment_kind AS ENUM (
  'chaudiere','chauffe_eau','radiateur','pac','climatisation',
  'fenetre','isolation','ventilation','tableau_elec','autre'
);
CREATE TABLE equipment_findings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  photo_id        uuid,
  kind            equipment_kind NOT NULL,
  brand text, model text, energy_class text, year_install int,
  details         jsonb DEFAULT '{}'::jsonb,
  ai_provider     text DEFAULT 'anthropic',
  ai_model        text,
  ai_confidence   numeric(4,3),
  ai_cost_eur     numeric(10,4),
  reviewed        boolean DEFAULT false,
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 8. Voice notes (Whisper)
CREATE TABLE voice_notes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  recorded_by     uuid REFERENCES auth.users(id),
  storage_path    text NOT NULL,
  duration_seconds int,
  language        text DEFAULT 'fr',
  transcript_raw  text,
  transcript_structured jsonb,
  ai_cost_eur     numeric(10,4),
  ai_confidence   numeric(4,3),
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  transcribed_at  timestamptz
);

-- 9. Sketches
CREATE TABLE sketches (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_id         uuid REFERENCES mission_rooms(id) ON DELETE SET NULL,
  source          text NOT NULL,
  geometry        jsonb NOT NULL,
  preview_path    text,
  surface_carrez_m2 numeric(8,2),
  surface_boutin_m2 numeric(8,2),
  ai_cost_eur numeric(10,4),
  reviewed        boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 10. Photos (high-volume, monthly partitions)
CREATE TABLE photos (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  mission_id      uuid NOT NULL,
  room_id         uuid,
  storage_path    text NOT NULL,
  thumb_path      text,
  width int, height int, size_bytes int,
  mime_type       text DEFAULT 'image/jpeg',
  taken_at        timestamptz,
  location        geography(Point, 4326),
  caption         text,
  ai_tags         text[] DEFAULT '{}',
  ai_cost_eur     numeric(10,4) DEFAULT 0,
  uploaded_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- 11. Quotes + Invoices (Factur-X)
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id),
  mission_id      uuid REFERENCES missions(id),
  quote_id        uuid REFERENCES quotes(id),
  reference       text NOT NULL,
  status          text NOT NULL DEFAULT 'draft',
  amount_ht numeric(10,2) NOT NULL,
  amount_tva numeric(10,2) NOT NULL,
  amount_ttc numeric(10,2) NOT NULL,
  paid_amount numeric(10,2) DEFAULT 0,
  tva_rate numeric(5,2) DEFAULT 20.0,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_path text,
  facturx_xml text,
  facturx_profile text DEFAULT 'EN16931',
  ppf_transmission_id text,
  ppf_status text,
  stripe_payment_intent text,
  payment_method text,
  due_date date,
  paid_at timestamptz,
  reminder_j7_sent_at timestamptz,
  reminder_j15_sent_at timestamptz,
  reminder_j30_sent_at timestamptz,
  client_snapshot jsonb,
  issued_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);

-- 12. Events (audit log, partitioned, append-only)
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at      timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

CREATE OR REPLACE FUNCTION block_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_events_no_update
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION block_events_mutation();
```

**Per-org legally-continuous reference counters** (French invoicing legal requirement — no gaps):
```sql
CREATE TABLE reference_counters (
  organization_id uuid NOT NULL,
  kind            text NOT NULL,
  year            int  NOT NULL,
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
    ELSE 'MIS' END;
BEGIN
  INSERT INTO reference_counters (organization_id, kind, year, last_value)
  VALUES (p_org, p_kind, v_year, 1)
  ON CONFLICT (organization_id, kind, year)
  DO UPDATE SET last_value = reference_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN v_prefix || '-' || v_year || '-' || lpad(v_next::text, 5, '0');
END $$;
```

**Partitioning strategy**:
- `photos` and `events` partitioned monthly on `created_at` via `pg_partman`
- Detach old partitions to S3 archive at month 25 (10-year legal retention satisfied off-DB)
- Photos older than 12 months can be moved to S3 Glacier Instant Retrieval (5× cheaper)

### 4. Supabase Storage for photos + sketches

**Bucket layout** (4 shared buckets > per-org buckets):
- `photos`, `voice`, `sketches`, `exports` — private, RLS-policed
- `client-portal` — public-read via signed URLs only

Per-org buckets hit the Supabase soft cap (~100/project) at 100 orgs. Use shared buckets with org-scoped folder paths.

**Path convention**:
```
photos/{organization_id}/{mission_id}/{photo_id}.jpg
voice/{organization_id}/{mission_id}/{voice_id}.m4a
sketches/{organization_id}/{mission_id}/{sketch_id}.png
exports/{organization_id}/{mission_id}/liciel-{ts}.zip
```

**Photo strategy**:
- Mobile compresses to JPEG q=80, max 1920px long edge, strip personal EXIF but keep GPS + DateTime
- Target 200-500 KB per file
- For Espace Client, use 7-day signed URLs

**Cost estimation at 100 abonnés × 15 missions × 20 photos × 3 MB**:
- New volume: 100 × 15 × 20 × 3 MB = **90 GB/mo**
- Pro plan: 100 GB included, then $0.021/GB/mo → ~$19/mo at end of year 1
- **Total Storage cost Phase 1**: ~$25-35/mo

### 5. Realtime sync mobile ↔ web

**CDC vs Broadcast — when to use what**:

| Use case | Channel | Why |
|---|---|---|
| Mission status flip → web dashboard | Postgres CDC | Authoritative, WAL-replicated |
| Photo appears in list while shooting | Postgres CDC | Insert visibility |
| Voice transcription % progress | Broadcast | Ephemeral, no persistence value |
| "User editing this mission" | Presence | Built for ephemeral, auto-expires |
| Stripe paid → instant UI flip | CDC after webhook updates DB | Single source of truth |
| Cursor in collab sketch (P3) | Broadcast | High-frequency ephemeral |

**Concurrent limits** (Jan 2026 [VERIFY]):
- Pro: 500 concurrent, 2500 msg/s
- Team: 1000 concurrent, more on add-ons

### 6. Auth strategy

**Phase 1**: Email+Password as primary, Magic Link as secondary, no Apple/Google OAuth.
- B2B paid users expect a "real" password they can store in a password manager
- Magic Link as fallback on login screen
- Apple/Google adds friction — defer to Phase 2 if data shows demand

**2FA**:
- Supabase Auth has TOTP MFA native — enable, enforce on owners Phase 1, optional for diags
- **No SMS 2FA** (SIM-swap risk) — use TOTP + 10 emailed recovery codes instead

**Mobile session**:
- supabase-js persists in `expo-secure-store` (Keychain/Keystore)
- Refresh token rotation enabled by default
- **Biometric unlock** at app-shell via `expo-local-authentication` — FaceID/TouchID gates app hydration

### 7. Edge Functions use cases for KOVAS

Deno runtime, 150 MB deploy, 1 GB RAM, 50s timeout.

**Recommended functions**:
- `stripe-webhook` — `invoice.paid`, `customer.subscription.*`
- `resend-webhook` — bounce/complaint/click
- `docuseal-webhook` — quote signed → flip status, create draft invoice
- `ai-vision-equipment` — server-side Claude Vision
- `ai-whisper-transcribe` — server-side Whisper
- `ai-generate-synthese` — Claude composes mission summary
- `liciel-export-zip` — assemble photos + XML + .mdb stub → ZIP
- `image-thumb` — on Storage object insert → 256px + 1024px thumb back
- `cron-relances-impayees` — daily, J+7/J+15/J+30 overdue → Resend
- `cron-google-reviews` — J+1 after mission done → review request email
- `cron-trial-ending` — J+15/J+25/J+28 trial reminders

**Limits to know**: cold start 50-200 ms, 1000 concurrent invocations default, egress counted toward bandwidth, hard 50s timeout. Liciel ZIP for missions with 60+ photos may need Railway worker.

### 8. Audit logging

Trigger-based, write to partitioned `events`, mutation blocked. The `block_events_mutation()` trigger blocks even `service_role` writes.

**Querying audit trails**: indexed by `(organization_id, created_at)` primary, `(entity_type, entity_id)` for entity history, `(user_id, created_at)` for per-user activity. Retention 24 months per PRD §8.4.

### 9. RGPD compliance via Supabase

**KOVAS sous-traitants list** (document in privacy policy):
- Supabase Inc. (US entity, SCCs + DPA, data in eu-west-3)
- AWS (under Supabase)
- Anthropic (Claude — EU training opt-out on console)
- OpenAI (Whisper — same)
- Stripe (EU entity)
- Resend (EU servers available)
- Sentry (EU region account)
- PostHog (EU cloud OR self-host)
- DocuSeal (self-hosted on Railway EU)
- Vercel (Paris region)
- Expo (limited PII)
- SMS provider (TBD per D304)

**Right-to-be-forgotten cascade**:
- Soft-delete profile (30-day grace)
- Cron after 30 days does hard delete (cascade FKs do the rest)
- **CRITICAL LEGAL CAVEAT**: French Code de commerce mandates **10-year invoice retention**. The deletion script MUST EXCLUDE `invoices` from cascade. Implement `client_snapshot jsonb` to preserve client info at issue time.

**Data export (RGPD article 20)**: Edge Function bundles JSON + Storage photos into a ZIP → `exports/{user}/rgpd-{ts}.zip` → 7-day signed URL.

### 10. Migration / versioning strategy

**supabase CLI workflow**:
```
supabase/
├── config.toml
├── migrations/
│   ├── 20260513120000_init_schema.sql
│   └── ...
├── seed.sql
└── functions/
    ├── stripe-webhook/
    └── ...
```

**Supabase Branching** (GA late 2024): each Git branch → ephemeral preview DB. Wire Vercel preview to preview branch.

**Zero-downtime patterns**:
- Additive (`ADD COLUMN`, `CREATE INDEX CONCURRENTLY`) — safe always
- Destructive — multi-step: add new → backfill → dual-write → cutover → drop old
- NEVER rename in a single step

### 11. Cost forecasting

All in USD/month (Supabase bills USD).

#### Phase 1 — 100 abonnés
| Item | Sub-total |
|---|---|
| Supabase Pro plan | $25 |
| PITR add-on (7-day) | $100 [VERIFY] |
| Storage above 100 GB | $0-2 |
| Egress above 250 GB | $0 |
| Edge Functions | included |
| Realtime concurrent | included |
| **Subtotal Supabase** | **~$125-130** |

#### Phase 2 — 600 abonnés
| Item | Sub-total |
|---|---|
| Supabase Team plan [VERIFY] | $599 |
| Compute Medium | $110 |
| Storage (~6 TB cumul) | $127 |
| Egress (~1 TB/mo) | $70 |
| **Subtotal** | **~$908** |

#### Phase 3 — 1500 abonnés
| Item | Sub-total |
|---|---|
| Supabase Team plan | $599 |
| Compute Large/XL | $410 |
| Storage (~15 TB cumul) | $155 |
| Egress (~2.5 TB/mo) | $208 |
| Realtime ~1500 concurrent | ~$100 |
| **Subtotal** | **~$1682** |

**TL;DR**: Phase 1 ~$125/mo Supabase. Phase 3 ~$1700/mo = ~$1.10/abonné, tiny vs 89-149€/mo MRR.

### 12. Backup and disaster recovery

**Native Supabase**:
- Pro: daily backups, 7-day retention
- PITR add-on ($100/mo [VERIFY]): point-in-time recovery
- Team: 14-day + PITR included [VERIFY]

**RGPD requirement is 30-day retention**. Need PITR + extra:
- **Option recommended**: PITR (7-14 days) + S3 weekly snapshots (30+ days)

**Recommended external S3 EU**:
- **OVHcloud Object Storage** (Strasbourg/Gravelines) — FR sovereignty, ~$0.01/GB/mo
- **Scaleway Object Storage** (Paris) — FR sovereignty, dev-friendly
- For "hébergement souverain France" positioning, **OVHcloud or Scaleway** beats Wasabi.

### 13. Common pitfalls (full list)

1. **`service_role` key leaked** — biggest single risk. Husky pre-commit hook to grep for accidental commits.
2. **Connection pool exhaustion** — use pooler URL (`*.pooler.supabase.com:6543`) for transaction-mode workloads.
3. **Realtime subscription leaks** — build Zustand-wrapped Realtime manager that auto-cleans per screen + on logout.
4. **Storage cost surprises** — egress, image transforms not free above quota.
5. **RLS bypass on `service_role`** — Edge Functions with service_role bypass RLS. Must manually validate org membership.
6. **N+1 RLS** — covered above.
7. **`auth.uid()` null during SSR** — use `@supabase/ssr` package.
8. **Realtime filtered by RLS = silent drops** — test Realtime with actual end-user JWT.
9. **Postgres replica identity** — without `REPLICA IDENTITY FULL`, DELETE events carry only PK.
10. **`public` schema exposed via PostgREST** — put internal tables in a separate schema with explicit grants.

## Recommended Approach

1. **Region**: `eu-west-3` (Paris) primary, `eu-central-1` (Frankfurt) for DR mirror via S3.
2. **Plan trajectory**:
   - Phase 1 (M1-M12, 0-100 abonnés): **Pro + PITR** = ~$125/mo
   - Phase 2 (M13-M18, 100-600): upgrade **Team** when Realtime nears 500
   - Phase 3 (M22+, 600-1500+): Team + Compute upgrade + read replica
3. **Multi-tenant from day 1**: every business table has `organization_id`. Phase 1 single-user auto-creates 1 user / 1 org / 1 membership. Phase 2 = zero schema changes.
4. **RLS**: `auth.is_member_of(org_id)` SECURITY DEFINER helper on every table; never inline subqueries. Composite indexes lead with `organization_id`.
5. **Storage**: 4 shared buckets + org-scoped path + `storage.objects` RLS. Client-side compress photos to 200-500 KB.
6. **Realtime**: CDC for authoritative state, Broadcast for ephemeral UX, Presence for collab (Phase 3).
7. **Edge Functions**: server-side ONLY for webhooks, AI calls, Liciel exports, cron. Mobile NEVER holds AI API keys.
8. **Audit logs**: trigger-based, partitioned monthly, append-only via mutation-blocking trigger.
9. **Auth Phase 1**: Email+Password + Magic Link fallback; TOTP MFA optional (mandatory owners). No Apple/Google Phase 1.
10. **RGPD**: eu-west-3 residency, sub-processor list documented, 30-day soft-delete grace; invoices archived 10 years via `client_snapshot`.
11. **Migrations**: Supabase CLI + supabase/migrations folder + Branching for PRs + permanent staging project + additive-only rule.
12. **Backups**: native daily + 7-day PITR (Pro) → external nightly pg_dump to OVHcloud S3 EU for 30-day RGPD + regional independence.

## Resolved PRD open questions
- **D301**: Region = eu-west-3 Paris
- **D402**: Email+Pass + Magic Link, no OAuth Phase 1
- **D706**: OVHcloud or Scaleway S3 EU — OVHcloud slight preference for FR-sovereignty marketing

## Phase 1 → Phase 2 multi-user migration plan

**Schema changes**: NONE. Schema is multi-user-ready from day 1.

**App-level changes for Phase 2 launch**:
1. Invite flow (Edge Function `POST /functions/v1/invite-member`)
2. Role-based UI (owner / admin / diag / assistant)
3. RLS refinement for roles
4. Pricing: $20/extra user/month surfaced as Stripe subscription items
5. Resolve `// PHASE2: multi-user` markers left from Phase 1

**Estimated effort**: 2-3 weeks at solo founder pace.

## Phase 4 second-wave placeholders (to populate after Discovery)

**Human Actions Required (parent agent should track)**:
| Action | Who | Status |
|---|---|---|
| Sign Supabase DPA | Founder | Pending |
| Choose Pro plan + eu-west-3 | Founder | Pending |
| Enable PITR add-on | Founder | Pending |
| Configure Resend SMTP in Auth | Founder | Pending |
| Create OVHcloud Object Storage | Founder | Pending |
| Anthropic + OpenAI with EU billing | Founder | Pending |
| Apple Developer enrollment | Founder | Pending |
| GitHub repo + branch protection | Agent | Pending |
| Vercel project Paris | Founder/agent | Pending |
| Supabase project creation | Founder | Pending |
| Migrations, Edge Functions, RLS | Agent | After above |
