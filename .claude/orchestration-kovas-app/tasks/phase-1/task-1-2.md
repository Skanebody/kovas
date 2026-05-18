# Task 1.2 : Supabase setup + auth + schéma multi-tenant (Sprint J1 soir + J2 matin)

## Objective

Créer le projet Supabase eu-west-3 Paris + auth Email+Password + Magic Link + schéma initial 14 tables avec RLS multi-tenant via SECURITY DEFINER helper + audit logging trigger-based.

## Context

**Task la plus critique du Sprint J1**. Sans Supabase configuré et RLS multi-tenant fonctionnel, aucune feature business ne peut être implémentée. Le schéma initial doit être **ready Phase 2 multi-user from day 1** (pas de migration de schéma plus tard).

## Dependencies

- Task 1.1 (monorepo prêt, packages/database stub créé)
- Task 0.1 (compte Supabase Free créé, project `kovas-prod` initialisé eu-west-3)

## Blocked By

- Tasks 1.1 + 0.1

## Research Findings

- De `research/supabase-architecture.md` §1 : région **eu-west-3 Paris** confirmée, plan trajectoire Free→Pro M2→PITR M5
- De `research/supabase-architecture.md` §2 : **#1 production gotcha** = RLS performance via SECURITY DEFINER helper `auth.is_member_of()` (pas inline subqueries)
- De `research/supabase-architecture.md` §3 : 14 tables détaillées avec colonnes typées + RLS policies + indexes composites lead `organization_id`
- De `research/supabase-architecture.md` §8 : audit logging trigger-based + table `events` append-only via mutation-blocking trigger
- De `research/supabase-architecture.md` §13 : 10 common pitfalls (notamment service_role leaked, n+1 RLS, public schema exposed via PostgREST)

## Implementation Plan

### Step 1 : Configuration project Supabase (J1 soir)

- Vérifier project `kovas-prod` créé Task 0.1 en eu-west-3
- Activer extensions PostgreSQL nécessaires :
  - `uuid-ossp`
  - `pgcrypto`
  - `postgis` (geo BAN/cadastre Task 1.4)
  - `pg_trgm` (search clients/properties)
  - `vector` (pgvector RAG KB Phase 2+ et auto-apprentissage)
- Configurer SMTP custom Resend (via Supabase Auth Settings)
- Activer **Magic Link** + désactiver OAuth (cf. D402)
- Récupérer SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY

### Step 2 : Init Supabase CLI local

```bash
cd ~/Code/kovas-app
pnpm add -D supabase
pnpm exec supabase init
pnpm exec supabase link --project-ref <project-ref>
```

`supabase/config.toml` : configuration locale dev.

### Step 3 : Migration initiale schéma 14 tables (J2 matin)

`supabase/migrations/20260518000000_init_schema.sql` :

Suit fidèlement `research/supabase-architecture.md` §3. Tables principales :

1. **organizations** (Phase 2 multi-user ready, Phase 1 = auto-create solo)
2. **profiles** (mirror auth.users)
3. **memberships** (user ↔ org with role)
4. **clients** (particulier/agence/notaire/syndic/entreprise/collectivite)
5. **properties** (avec BAN + cadastre + PostGIS geography)
6. **missions** (avec type, status, reference per-org)
7. **mission_rooms**
8. **equipment_findings** (préparation Vision IA Phase 2)
9. **voice_notes** (Whisper)
10. **sketches** (Skia JSONB)
11. **photos** (partitioned monthly)
12. **quotes** (devis)
13. **invoices** (Factur-X, snapshot client pour rétention 10 ans)
14. **events** (audit log, partitioned monthly, mutation-blocked)

Plus tables auxiliaires :
- **ai_usage** (ledger coûts IA)
- **ai_kb_documents** (RAG KB Phase 2+)
- **jobs** (queue async)
- **reference_counters** (numérotation factures continue)
- **support_tickets** + **support_messages** (custom support Phase 1)
- **incidents** (status page custom)
- **vision_corrections** (auto-apprentissage Phase 3+ — préparation)

Trigger audit + helper SECURITY DEFINER :

```sql
-- Helper SECURITY DEFINER (PERFORMANCE CRITIQUE)
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

-- Numérotation continue per-org (Code de commerce art. L123-22)
CREATE OR REPLACE FUNCTION next_reference(p_org uuid, p_kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
... (cf. research/supabase-architecture.md §3)
$$;

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
... (cf. research/supabase-architecture.md §8)
$$;

-- Mutation block on events table
CREATE OR REPLACE FUNCTION block_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_events_no_update
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION block_events_mutation();
```

RLS sur toutes les business tables :

```sql
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read" ON missions FOR SELECT TO authenticated
  USING (auth.is_member_of(organization_id));

CREATE POLICY "members insert" ON missions FOR INSERT TO authenticated
  WITH CHECK (auth.is_member_of(organization_id));

CREATE POLICY "members update" ON missions FOR UPDATE TO authenticated
  USING (auth.is_member_of(organization_id))
  WITH CHECK (auth.is_member_of(organization_id));

-- DELETE policies: soft-delete only (deleted_at set), no hard delete from client
-- Hard delete only via service_role for RGPD right-to-be-forgotten (Edge Function)
```

Auto-création organization + membership au signup :

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

  -- Create default organization (Phase 1 = solo, Phase 2 = invite-based for multi-user)
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' — cabinet')
  RETURNING id INTO v_org_id;

  -- Create owner membership
  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (v_org_id, NEW.id, 'owner', 'active');

  -- Set default_org_id on profile
  UPDATE public.profiles SET default_org_id = v_org_id WHERE id = NEW.id;

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 4 : Push migration vers Supabase

```bash
pnpm exec supabase db push
# OR via Supabase Studio SQL Editor pour le premier coup
```

### Step 5 : Génération types TypeScript

```bash
pnpm exec supabase gen types typescript --linked > packages/database/src/types.ts
```

### Step 6 : Client Supabase typé dans `packages/database`

`packages/database/package.json` :

```json
{
  "name": "@kovas/database",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "gen-types": "supabase gen types typescript --linked > src/types.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  }
}
```

`packages/database/src/index.ts` :

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export type { Database } from './types'

export function createSupabaseClient(opts: {
  url: string
  anonKey: string
}) {
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}

// Service role client (BACKEND ONLY, NEVER expose to client)
export function createSupabaseAdminClient(opts: {
  url: string
  serviceRoleKey: string
}) {
  return createClient<Database>(opts.url, opts.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

### Step 7 : Seed dev minimal

`supabase/seed.sql` :

```sql
-- Dev seed : 1 user, 1 org, 3 clients, 2 properties, 2 missions
-- (à compléter selon besoins dev local)
```

### Step 8 : Tests RLS

`packages/database/src/__tests__/rls.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { createSupabaseClient, createSupabaseAdminClient } from '..'

describe('RLS multi-tenant isolation', () => {
  it('user A cannot see missions of user B (different org)', async () => {
    // Setup : create 2 users in 2 different orgs
    // Test : login as A, query missions → should see only A's missions
    // Test : login as A, try to insert mission with B's organization_id → should fail
  })

  it('auth.is_member_of() returns true for active member', async () => {
    // ...
  })

  it('events table is append-only (UPDATE blocked)', async () => {
    // ...
  })

  it('reference_counters generates continuous sequence per-org', async () => {
    // Test : 3 invoices for same org → references "FAC-2026-00001", "00002", "00003"
  })
})
```

## Files to Create

- `supabase/migrations/20260518000000_init_schema.sql` (14+ tables, RLS, triggers, helpers)
- `supabase/seed.sql`
- `supabase/config.toml`
- `packages/database/package.json`
- `packages/database/tsconfig.json`
- `packages/database/src/index.ts`
- `packages/database/src/types.ts` (généré via `supabase gen types`)
- `packages/database/src/__tests__/rls.test.ts`

## Files to Modify

- `.env.example` : ajouter SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

## Contracts

### Provides (for downstream tasks)

- **Schema DB complet** : 14+ tables avec RLS multi-tenant — base pour toutes Tasks 1.3+
- **Types TypeScript générés** : `Database` type pour requêtes typées
- **Auth Email+Password + Magic Link** : signup/login fonctionnels
- **Auto-création organization** au signup : prérequis pour CRUD Task 1.4
- **Helper SECURITY DEFINER `auth.is_member_of()`** : référencé par toutes les RLS policies downstream

## Acceptance Criteria

- [ ] Project Supabase `kovas-prod` créé eu-west-3 Paris
- [ ] 14+ tables créées avec RLS activé sur toutes les business tables
- [ ] Auth Email+Password + Magic Link configuré + custom SMTP Resend
- [ ] Helper `auth.is_member_of()` SECURITY DEFINER créé et utilisé dans toutes RLS policies
- [ ] Audit trigger `audit_table_changes()` actif sur missions, clients, properties, invoices, quotes, equipment_findings
- [ ] Trigger anti-mutation events table actif
- [ ] Auto-création organization + membership owner au signup user
- [ ] Types TypeScript générés dans `packages/database/src/types.ts`
- [ ] Client typé exporté depuis `@kovas/database`
- [ ] Tests RLS passent (isolation 2 users en 2 orgs)

## Testing Protocol

### Unit/Integration Tests

- Test file : `packages/database/src/__tests__/rls.test.ts`
- Test cases :
  - [ ] Signup auto-crée organization + membership owner
  - [ ] User A ne peut PAS voir missions de user B (org différent)
  - [ ] User A ne peut PAS insérer mission avec `organization_id` de B
  - [ ] `auth.is_member_of()` retourne `true` pour membre actif, `false` sinon
  - [ ] `next_reference('FAC', org)` : 3 appels successifs → "FAC-2026-00001", "00002", "00003"
  - [ ] UPDATE/DELETE sur `events` est bloqué (raise exception)
  - [ ] Audit trigger : INSERT mission crée une row dans `events`

### Browser Testing (Claude_in_Chrome MCP)

- Navigate to Supabase Studio → Authentication → vérifier Magic Link enabled
- Test signup E2E :
  1. Navigate to localhost dev signup
  2. Fill email + password
  3. Click submit
  4. Receive Magic Link email via Resend (vérifier `kovas.fr/auth/callback` redirect)
  5. Verify session created
- Test isolation :
  1. Signup user A in org A
  2. Signup user B in org B
  3. Query `/missions` as A → only A's missions returned

### Build/Lint/Type Checks

- [ ] `pnpm -F @kovas/database run typecheck` passe
- [ ] `pnpm exec supabase db lint` passe (Supabase linter)

## Skills to Read

- `kovas-supabase-rls` (lecture intégrale)

## Research Files to Read

- `research/supabase-architecture.md` §1-13 (intégral)

## Git

- Branch : `feature/1-2-supabase-multi-tenant`
- Commit message prefix : `Task 1.2:`
- PR target : `main`

## Notes anti-pattern

- ⛔ **JAMAIS** de `service_role` key dans le bundle mobile ou web client — uniquement dans Edge Functions / Next.js API routes
- ⛔ Ne PAS inliner `auth.uid()` subqueries dans les RLS policies (n+1 perf collapse)
- ⛔ Ne PAS oublier `REPLICA IDENTITY FULL` sur tables Realtime-watched (sinon DELETE events incomplets)
- ⛔ Ne PAS oublier l'index composite `(organization_id, ...)` lead sur toutes les business tables
- ⛔ Ne PAS exposer schemas internes (`auth.is_member_of` est dans `auth` schema, pas `public`)
- ⛔ Ne PAS oublier d'enable RLS sur **toutes** les tables business (sinon faille critique multi-tenant)
- ⛔ Ne PAS oublier le trigger `handle_new_user()` (sinon user crée mais pas d'org auto → app crash)
- ⛔ Ne PAS oublier `client_snapshot jsonb` sur `invoices` pour rétention 10 ans malgré RGPD delete
