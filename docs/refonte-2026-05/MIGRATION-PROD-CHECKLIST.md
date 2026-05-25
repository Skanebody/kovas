# Checklist migration Supabase prod — Refonte acqui-target 2026-05 (Lot B52)

> **Authority** : ce document est le runbook canonique pour appliquer en prod les **6 migrations refonte** de la branche `refonte-acqui-target-2026-05` + les **7 Edge Functions** + les **7 secrets Vault**.
> **Public** : Benjamin Bel (exécutant).
> **Date cible d'application** : à planifier sur fenêtre low-traffic (suggestion : mardi soir 22h-23h CET).
> **Pré-requis** : `supabase` CLI ≥ 1.200 installée + accès owner projet `kovas-prod` + accès Vercel prod.

---

## 0. Vue d'ensemble

### Les 6 migrations à appliquer (ordre alphabétique = chronologique)

| # | Fichier | Catégorie | Risque | Reversible facile ? |
|---|---|---|---|---|
| 1 | `20260525170000_data_lake_schemas.sql` | DDL (3 schemas + 9 tables + 2 matviews + 1 RPC) | Faible (IF NOT EXISTS) | Oui (DROP SCHEMA CASCADE) |
| 2 | `20260525210000_press_kit_releases.sql` | DDL (3 tables + 1 view + RLS) | Faible | Oui (DROP TABLE CASCADE) |
| 3 | `20260525220000_lead_scoring_a135.sql` | ALTER TABLE (4 cols) + 2 RPCs | Faible (ADD COLUMN IF NOT EXISTS) | Modéré (DROP COLUMN + DROP FUNCTION) |
| 4 | `20260525230000_v_etat_profession.sql` | 2 VIEWS (CREATE OR REPLACE) | Très faible | Oui (DROP VIEW) |
| 5 | `20260525240000_mission_flow_state.sql` | DDL (2 tables + RLS + 1 RPC) | Faible | Oui (DROP TABLE CASCADE + DROP FUNCTION) |
| 6 | `20260525250000_diagnostician_response_metrics.sql` | 1 index partiel + 1 RPC | Très faible | Oui (DROP INDEX + DROP FUNCTION) |

**Toutes les migrations sont idempotentes** (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE VIEW`).

### Downtime estimé : **0 minute**

Toutes les opérations sont non-bloquantes (sauf les `CREATE INDEX` sans `CONCURRENTLY` mais les volumétries sont actuellement nulles ou faibles côté `data.*` / `mission_flow_*` / `press_*`).

**Fenêtre de précaution recommandée** : 15 minutes low-traffic (mardi 22h-22h15 CET).

### Project ID prod : `kovas-prod` (cf. `supabase/config.toml`)

---

## 1. Préparation (T-30 min)

### 1.1 Backup PITR du dump pré-migration

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# 1. Link au projet prod (skip si déjà fait)
supabase link --project-ref <PROJECT_REF_PROD>
# Note : le ref se trouve dans Supabase Studio > Settings > General > Reference ID

# 2. Dump complet pré-migration (schema + data critique)
mkdir -p docs/refonte-2026-05/snapshots/pre-migration-2026-05-25
supabase db dump --linked --file docs/refonte-2026-05/snapshots/pre-migration-2026-05-25/full-dump.sql --data-only=false

# 3. Snapshot rôles + RLS séparés (utile au rollback fin)
supabase db dump --linked --role-only --file docs/refonte-2026-05/snapshots/pre-migration-2026-05-25/roles.sql
```

**Vérifie ensuite** :
- Le fichier `full-dump.sql` fait au moins 1 MB
- Le fichier contient bien `CREATE TABLE public.quote_requests` (table modifiée par migration 3)
- PITR Supabase est activé (cf. Dashboard > Settings > Database > Point in time recovery)

> Si PITR n'est pas activé en prod, **STOP** et active-le d'abord (plan Pro requis).

### 1.2 Dry-run en local

```bash
# Reset DB locale + applique TOUTES les migrations (anciennes + 6 nouvelles)
supabase db reset

# Vérifie qu'il n'y a aucune erreur dans la sortie
# (en particulier les 6 nouvelles : 2026052517 → 2026052525)
```

Si le reset local échoue → **STOP**, ne pas pousser en prod, debug en local d'abord.

### 1.3 Vérification connexion prod

```bash
# Liste les migrations distantes pour comparaison
supabase migration list --linked

# Doit afficher la dernière migration prod actuelle (probablement 20260524600000)
# et confirmer qu'il y a bien 6 migrations à appliquer
```

### 1.4 Pause des cron jobs existants (par précaution)

Dans Supabase Studio > Database > Cron jobs, **pause** temporairement :
- `verify-diagnosticians-daily`
- `ademe-daily-sync`
- `observatoire-monthly-report`

(Les ré-activer en étape 5.)

---

## 2. Application des migrations (T-0)

### 2.1 Push direct

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# Application séquentielle (ordre des timestamps respecté)
supabase db push --linked
```

**Attendu en sortie** :

```
Connecting to remote database...
Applying migration 20260525170000_data_lake_schemas.sql...
Applying migration 20260525210000_press_kit_releases.sql...
Applying migration 20260525220000_lead_scoring_a135.sql...
Applying migration 20260525230000_v_etat_profession.sql...
Applying migration 20260525240000_mission_flow_state.sql...
Applying migration 20260525250000_diagnostician_response_metrics.sql...
Finished supabase db push.
```

⚠️ **Si une seule migration échoue** : `db push` s'arrête. Note **laquelle** a échoué, puis va directement à la section **7. Rollback**.

### 2.2 Variante (si `db push` ne marche pas)

```bash
# Variante 1 — push avec confirmation interactive
supabase migration up --linked

# Variante 2 — application manuelle d'une seule migration (utile si une seule a échoué)
psql "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  -f supabase/migrations/20260525170000_data_lake_schemas.sql
```

---

## 3. Vérification post-migration (T+5 min)

Ouvre **Supabase Studio > SQL Editor** et exécute les checks ci-dessous, **un par un**. Tous doivent réussir.

### 3.1 Migration 1 — `data_lake_schemas`

```sql
-- A. Les 3 schemas existent
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('data', 'analytics', 'internal')
ORDER BY schema_name;
-- Attendu : 3 lignes (analytics, data, internal)

-- B. Les 9 tables data.* sont créées
SELECT count(*)::int AS data_tables_count
FROM information_schema.tables WHERE table_schema = 'data';
-- Attendu : 9 (properties_unified, properties_transactions_history, properties_dpe_history,
-- properties_erp_risks, properties_diagnostiqueurs_zone, dvf_mutations, ademe_dpe,
-- france_renov_rge, equipment_brands_models)

-- C. Les 2 matviews analytics.* existent
SELECT matviewname FROM pg_matviews WHERE schemaname = 'analytics' ORDER BY matviewname;
-- Attendu : 2 lignes (passoires_thermiques_by_commune, transactions_history_by_commune)

-- D. Les 4 tables internal.* sont créées
SELECT count(*)::int AS internal_tables_count
FROM information_schema.tables WHERE table_schema = 'internal';
-- Attendu : 4 (ingestion_state, data_quality_incidents, diagnostician_pattern_learnings,
-- bandit_state_per_diagnostician)

-- E. La RPC PostGIS est callable (résultat vide = OK, structure validée)
SELECT * FROM public.diagnosticians_within_radius(48.8566::numeric, 2.3522::numeric, 5000);
-- Attendu : 0 ligne (table vide) sans erreur

-- F. La column geom (PostGIS GENERATED) existe sur properties_unified
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'data' AND table_name = 'properties_unified' AND column_name = 'geom';
-- Attendu : 1 ligne, data_type = USER-DEFINED (geometry)
```

### 3.2 Migration 2 — `press_kit_releases`

```sql
-- A. Les 3 tables press_* existent en public
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'press_%'
ORDER BY table_name;
-- Attendu : 3 lignes (press_contacts, press_release_sends, press_releases)

-- B. Count initial (doit être 0 partout)
SELECT
  (SELECT count(*) FROM public.press_contacts)::int AS contacts,
  (SELECT count(*) FROM public.press_releases)::int AS releases,
  (SELECT count(*) FROM public.press_release_sends)::int AS sends;
-- Attendu : 0 | 0 | 0

-- C. RLS activée sur les 3 tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'press_%';
-- Attendu : 3 lignes, rowsecurity = true partout

-- D. Vue v_press_mentions_stats interrogeable
SELECT * FROM public.v_press_mentions_stats;
-- Attendu : 1 ligne avec total_mentions, unique_outlets, etc. (valeurs initiales basses ou 0)
```

### 3.3 Migration 3 — `lead_scoring_a135`

```sql
-- A. Les 4 colonnes intent_* existent sur quote_requests
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quote_requests'
  AND column_name LIKE 'intent_%'
ORDER BY column_name;
-- Attendu : 4 lignes (intent_bucket, intent_score, intent_scored_at, intent_signals)

-- B. RPC bandit_thompson_rank callable avec un array vide
SELECT * FROM public.bandit_thompson_rank(ARRAY[]::uuid[]);
-- Attendu : 0 ligne, sans erreur

-- C. RPC route_lead_rank_candidates callable (Paris, 30 km, limit 5)
SELECT * FROM public.route_lead_rank_candidates(48.8566::float8, 2.3522::float8, 30, 5, false);
-- Attendu : 0..5 lignes selon données diagnosticians (probablement 0 lignes sans erreur si table vide)

-- D. Les 2 index partiels existent
SELECT indexname FROM pg_indexes
WHERE tablename = 'quote_requests'
  AND indexname IN ('idx_quote_requests_intent_bucket', 'idx_quote_requests_intent_score');
-- Attendu : 2 lignes
```

### 3.4 Migration 4 — `v_etat_profession`

```sql
-- A. Les 2 vues existent
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname LIKE 'v_etat_profession%'
ORDER BY viewname;
-- Attendu : 2 lignes (v_etat_profession_by_dept, v_etat_profession_summary)

-- B. Summary interrogeable (1 ligne de KPIs nationaux)
SELECT * FROM public.v_etat_profession_summary LIMIT 1;
-- Attendu : 1 ligne avec total_diagnosticians > 0 (DHUP a déjà été ingéré)

-- C. By dept interrogeable (top 5 départements par densité)
SELECT department_code, total_count FROM public.v_etat_profession_by_dept LIMIT 5;
-- Attendu : 5 lignes (75, 92, 93, 94, 13 typiquement en haut)

-- D. Vue security_invoker (pas SECURITY DEFINER → respect RLS)
SELECT relname, reloptions FROM pg_class
WHERE relname = 'v_etat_profession_summary';
-- Attendu : reloptions contient {security_invoker=on}
```

### 3.5 Migration 5 — `mission_flow_state`

```sql
-- A. Les 2 tables mission_flow_* existent
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'mission_flow_%'
ORDER BY table_name;
-- Attendu : 2 lignes (mission_flow_events, mission_flow_states)

-- B. RPC mission_flow_transition callable (on s'attend à une erreur "mission_not_found" propre)
SELECT * FROM public.mission_flow_transition(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'capture_terrain',
  'photos',
  NULL,
  'user_action',
  '{}'::jsonb
);
-- Attendu : 1 ligne (ok=false, error_reason='mission_not_found')

-- C. RLS activée sur les 2 tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'mission_flow_%';
-- Attendu : 2 lignes, rowsecurity = true

-- D. Contrainte CHECK sur current_phase
SELECT conname FROM pg_constraint WHERE conname = 'mission_flow_states_phase_check';
-- Attendu : 1 ligne
```

### 3.6 Migration 6 — `diagnostician_response_metrics`

```sql
-- A. L'index partiel existe
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'quote_requests' AND indexname = 'idx_quote_requests_diag_response';
-- Attendu : 1 ligne, indexdef contient "WHERE (diag_responded_at IS NOT NULL)"

-- B. RPC callable avec un UUID inexistant
SELECT * FROM public.get_diagnostician_response_metrics('00000000-0000-0000-0000-000000000000'::uuid);
-- Attendu : 1 ligne (median_minutes=NULL, sample_size=0) — pas d'erreur

-- C. Permissions anon
SELECT grantee, privilege_type FROM information_schema.role_routine_grants
WHERE routine_name = 'get_diagnostician_response_metrics'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee;
-- Attendu : 3 lignes (toutes EXECUTE)
```

### 3.7 Refresh des matviews data lake

Les 2 matviews `analytics.*` sont créées `WITH NO DATA`. Premier remplissage manuel :

```sql
REFRESH MATERIALIZED VIEW analytics.passoires_thermiques_by_commune;
REFRESH MATERIALIZED VIEW analytics.transactions_history_by_commune;
-- Attendu : ne renvoie rien (tables ademe_dpe et dvf_mutations encore vides → matviews vides)
-- Le refresh CONCURRENTLY ne sera utilisable qu'après la 1re ingestion (1 ligne minimum).
```

---

## 4. Vault secrets à configurer en prod (T+10 min)

Va dans **Supabase Studio > Project Settings > Edge Functions > Secrets** et ajoute les **7 secrets** suivants (si pas déjà présents) :

| Secret | Valeur attendue | Utilisé par |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé Anthropic Console prod | `send-monthly-press-release`, autres fns IA |
| `ANTHROPIC_HAIKU_MODEL` | `claude-haiku-4-5` | `observatoire-monthly-report` (déjà déployée) |
| `ANTHROPIC_SONNET_MODEL` | `claude-sonnet-4-6` | `send-monthly-press-release` |
| `RESEND_API_KEY` | Clé Resend prod | `send-monthly-press-release` (envoi journalistes) |
| `RESEND_FROM` | `KOVAS <contact@kovas.fr>` | idem |
| `USD_TO_EUR_RATE` | `0.92` | Facturation interne IA (ai-usage-tracker) |
| `PRESS_ADMIN_NOTIFY_EMAIL` | `contact@kovas.fr` | Notification draft presse Benjamin |

> **`SUPABASE_SERVICE_ROLE_KEY` et `NEXT_PUBLIC_SUPABASE_URL`** sont injectés automatiquement par la plateforme — ne pas les ajouter manuellement dans cette section.

> **Hardening optionnel** : `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` activent le rate-limit distribué (`lib/api-public/rate-limit.ts`). Recommandé dès que le trafic public V1 dépasse 10 req/sec.

---

## 5. Déploiement Edge Functions (T+15 min)

### 5.1 Les 7 fonctions à déployer

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# Déploiement individuel (recommandé pour pouvoir suivre les logs un par un)
supabase functions deploy ingest-ademe-dpe-daily --linked
supabase functions deploy ingest-dvf-quarterly --linked
supabase functions deploy refresh-data-lake-matviews --linked
supabase functions deploy send-monthly-press-release --linked
supabase functions deploy ingest-ban-cache-daily --linked
supabase functions deploy ingest-georisques-weekly --linked
supabase functions deploy ingest-ign-cadastre-weekly --linked

# Variante : tout d'un coup
# supabase functions deploy --linked
# (déploie TOUTES les fonctions du repo — utile si plusieurs autres ont aussi changé)
```

### 5.2 Cron à programmer dans Supabase Studio > Database > Cron jobs

| Fonction | Cron suggéré | Heure CET |
|---|---|---|
| `ingest-ademe-dpe-daily` | `0 4 * * *` | 5h CET (été) / 5h CET (hiver) |
| `ingest-dvf-quarterly` | `0 6 1 1,4,7,10 *` | 7h CET, 1er trimestre |
| `refresh-data-lake-matviews` | `0 5 * * *` | 6h CET — **après** ingest-ademe |
| `send-monthly-press-release` | `0 9 5 * *` | 10h CET — 5e du mois |
| `ingest-ban-cache-daily` | `0 3 * * *` | 4h CET — avant tout le reste |
| `ingest-georisques-weekly` | `0 4 * * 1` | 5h CET — lundi |
| `ingest-ign-cadastre-weekly` | `0 5 * * 2` | 6h CET — mardi |

**Création d'un cron** (exemple ADEME daily) via SQL Editor :

```sql
SELECT cron.schedule(
  'ingest-ademe-dpe-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/ingest-ademe-dpe-daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );
  $$
);
```

> Note : `pg_cron` + `pg_net` doivent être activés dans Database > Extensions (en principe déjà fait en prod KOVAS).

### 5.3 Re-active les crons existants pausés à l'étape 1.4

`verify-diagnosticians-daily`, `ademe-daily-sync`, `observatoire-monthly-report`.

---

## 6. Tests smoke en prod (T+20 min)

### 6.1 API publique V1 (3 endpoints)

```bash
# OpenAPI spec
curl -s -o /dev/null -w "%{http_code}\n" https://kovas.fr/api/public/v1/openapi.json
# Attendu : 200

curl -s https://kovas.fr/api/public/v1/openapi.json | jq '.openapi'
# Attendu : "3.1.0"

# État de la profession
curl -s https://kovas.fr/api/public/v1/observatoire/profession | jq '.data.total_diagnosticians'
# Attendu : entier > 0 (ex : 12450)

# Profil propriété (BAN ID test — sera 404 si pas en cache, mais doit pas être 500)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://kovas.fr/api/public/v1/property/75056_0001_00001
# Attendu : 200 ou 404 (PAS 500)
```

### 6.2 Pages publiques

```bash
# /presse
curl -s -o /dev/null -w "%{http_code}\n" https://kovas.fr/presse
# Attendu : 200

# /observatoire/etat-profession
curl -s -o /dev/null -w "%{http_code}\n" https://kovas.fr/observatoire/etat-profession
# Attendu : 200
```

### 6.3 Admin login + dashboard refonte

1. Ouvre https://kovas.fr/login avec ton compte admin
2. Va sur `/admin/refonte`
3. **Vérifie** : la page affiche **13/13 algos** opérationnels (cf. PROGRESS.md)
4. Vérifie aussi :
   - `/admin/press` affiche la console presse (KPI à 0)
   - `/admin/renewals` charge sans erreur
   - `/admin/churn` charge sans erreur
   - `/admin/leads/queue` affiche la colonne **Intent** et le filtre **bucket**

### 6.4 Logs sentry

Ouvre Sentry et vérifie **aucune nouvelle erreur 5xx** dans les 5 minutes suivant le push.

---

## 7. Rollback procedure (si bug détecté)

### 7.1 Décider le niveau de rollback

| Symptôme | Action |
|---|---|
| Une migration a échoué pendant `db push` | Rollback de cette migration uniquement (section 7.2) |
| Toutes les migrations ont passé mais l'app crash 500 sur `/admin/refonte` | Rollback ciblé code Next.js (Vercel rollback) — pas besoin de toucher la DB |
| Toutes les migrations ont passé mais Sentry remonte des erreurs sur ingestion `data.ademe_dpe` | Garder DB, désactiver les crons Edge Functions et debug |
| Corruption / perte de données détectée | **Restore PITR complet** (section 7.3) |

### 7.2 Rollback ciblé par migration (DROP manuel)

Exécute dans Supabase Studio > SQL Editor **dans l'ordre inverse** (6 → 1) selon ce qui a réussi :

```sql
-- Rollback migration 6 (diagnostician_response_metrics)
DROP FUNCTION IF EXISTS public.get_diagnostician_response_metrics(uuid);
DROP INDEX IF EXISTS public.idx_quote_requests_diag_response;

-- Rollback migration 5 (mission_flow_state)
DROP FUNCTION IF EXISTS public.mission_flow_transition(uuid, text, text, int, text, jsonb);
DROP TABLE IF EXISTS public.mission_flow_events CASCADE;
DROP TABLE IF EXISTS public.mission_flow_states CASCADE;

-- Rollback migration 4 (v_etat_profession) — innocent, juste 2 vues
DROP VIEW IF EXISTS public.v_etat_profession_by_dept;
DROP VIEW IF EXISTS public.v_etat_profession_summary;

-- Rollback migration 3 (lead_scoring_a135)
DROP FUNCTION IF EXISTS public.route_lead_rank_candidates(double precision, double precision, integer, integer, boolean);
DROP FUNCTION IF EXISTS public.bandit_thompson_rank(uuid[]);
DROP INDEX IF EXISTS public.idx_quote_requests_intent_bucket;
DROP INDEX IF EXISTS public.idx_quote_requests_intent_score;
ALTER TABLE public.quote_requests
  DROP COLUMN IF EXISTS intent_score,
  DROP COLUMN IF EXISTS intent_bucket,
  DROP COLUMN IF EXISTS intent_signals,
  DROP COLUMN IF EXISTS intent_scored_at;

-- Rollback migration 2 (press_kit_releases)
DROP VIEW IF EXISTS public.v_press_mentions_stats;
DROP TABLE IF EXISTS public.press_release_sends CASCADE;
DROP TABLE IF EXISTS public.press_releases CASCADE;
DROP TABLE IF EXISTS public.press_contacts CASCADE;

-- Rollback migration 1 (data_lake_schemas) — le plus radical, attention aux dépendances futures
DROP FUNCTION IF EXISTS public.diagnosticians_within_radius(numeric, numeric, integer);
DROP SCHEMA IF EXISTS internal CASCADE;
DROP SCHEMA IF EXISTS analytics CASCADE;
DROP SCHEMA IF EXISTS data CASCADE;
```

> ⚠️ **DROP CASCADE détruit toutes les données ingérées**. Ne fais ça que si vraiment nécessaire.

### 7.3 Restore PITR complet (cas extrême)

1. Dans **Supabase Studio > Settings > Database > Point in time recovery**
2. Choisis un timestamp **5 minutes avant** le `db push`
3. Confirme — Supabase crée un nouveau projet en restore (~5-10 min)
4. Bascule le DNS / les env vars Vercel sur le nouveau projet

> **Attention** : un restore PITR **perd toutes les écritures faites après le timestamp**. C'est destructif côté utilisateur.

### 7.4 Désactivation feature-flag (option intermédiaire)

Si le code Next.js déployé crash parce qu'une migration a échoué, on peut **rollback Vercel** sans toucher à la DB :

```bash
# Sur Vercel CLI ou Dashboard
vercel rollback <previous-deployment-url> --token=<TOKEN>
```

> **Limite** : si le code prod attend les tables `mission_flow_*` ou les colonnes `intent_*` et qu'elles n'existent pas, la rollback Vercel **peut elle aussi crasher** sur l'ancienne version qui ignore ces tables. Le rollback Vercel est OK pour annuler le **nouveau code Next.js**, pas pour annuler les migrations DB.

---

## 8. Post-déploiement (T+30 min à J+1)

### 8.1 Monitoring 24h

- **Sentry** : surveille le taux d'erreur 5xx (cible : pas d'augmentation)
- **PostHog** : vérifie que les events `mission_flow_transition` apparaissent quand un user navigue le tchat mission
- **Supabase Studio > Logs > Edge Functions** : vérifie les premiers runs cron (ADEME daily à 4h UTC le lendemain)

### 8.2 Premier refresh manuel matviews (lendemain matin)

Après le premier run de `ingest-ademe-dpe-daily` et `ingest-dvf-quarterly` (J+1 ou J+90) :

```sql
-- Une fois qu'il y a au moins 1 ligne dans data.ademe_dpe / data.dvf_mutations
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.passoires_thermiques_by_commune;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.transactions_history_by_commune;
```

(La fn `refresh-data-lake-matviews` le fera automatiquement à 5h UTC chaque jour.)

### 8.3 Premier brouillon presse (5e du mois)

Le cron `send-monthly-press-release` lance la génération le 5 du mois à 9h UTC. Vérifie le **5 juin 2026** :
- Email reçu sur `contact@kovas.fr` avec le draft
- Une ligne créée dans `public.press_releases` avec `status='pending_review'`

---

## 9. Annexes

### 9.1 Dépendances tables / fonctions inter-migrations

| Cette migration | dépend de tables/fns existantes en prod |
|---|---|
| `data_lake_schemas` | PostGIS extension (déjà 3.3.7 prod) |
| `press_kit_releases` | `public.observatoire_reports` (migration `20260523110000`), `public.observatoire_press_citations` (`20260524100000`), `public.is_admin()` (`20260518000000`) |
| `lead_scoring_a135` | `public.quote_requests` (init), `public.diagnosticians` (init), `public.subscriptions` (`20260518140000`), `public.bandit_diagnostician_stats` (`20260522200000_bandit_annuaire.sql`) |
| `v_etat_profession` | `public.diagnosticians` (toutes colonnes : `validation_status`, `sirene_state`, `activity_score`, `claim_status`, `fraud_flags`, `dhup_last_synced_at`, `department_code`) |
| `mission_flow_state` | `public.missions`, `public.organizations`, `public.mission_rooms` (`20260524600000`), `public.is_member_of()` |
| `diagnostician_response_metrics` | `public.quote_requests` (colonnes `diagnostician_id`, `diag_responded_at`, `created_at`) |

### 9.2 Anomalies signalées (à creuser dans un lot séparé)

> **Ces points ne bloquent PAS le déploiement** mais méritent un correctif ultérieur :

1. **`bandit_thompson_rank` SECURITY DEFINER + `random()`** : la fn est `SECURITY DEFINER` et utilise `random()` non-déterministe. Sans contrainte de session, deux appels successifs donnent des résultats différents → comportement attendu pour Thompson sampling. Aucun risque de sécurité, mais à documenter pour l'équipe ops.

2. **Matviews créées `WITH NO DATA`** : `REFRESH MATERIALIZED VIEW CONCURRENTLY` exige un index unique **ET** un premier refresh non-CONCURRENTLY. Le 1er refresh doit être manuel sans `CONCURRENTLY` (cf. § 3.7). À ajouter au runbook ops.

3. **`route_lead_rank_candidates` Haversine au lieu de PostGIS** : la fn utilise une formule Haversine maison alors que `data.properties_unified.geom` (PostGIS) existe déjà. Performance OK pour < 15k diag, mais migration future vers `ST_DWithin(d.geom::geography, ...)` recommandée.

4. **`v_press_mentions_stats` 6 sub-queries** : pas un bug, mais la vue exécute 6 `COUNT(*)` à chaque appel. Si la page `/presse` devient virale, envisager une vue matérialisée rafraîchie 1×/heure.

5. **`mission_flow_events` pas de policy DELETE** : append-only by design (cf. comment table). OK, mais à documenter pour éviter qu'un futur dev tente un cleanup manuel sans comprendre.

### 9.3 Contacts / escalation

- **Owner** : Benjamin Bel (benjaminbel@outlook.fr)
- **Supabase support** : si projet down > 5 min, ouvre un ticket priority Pro
- **Vercel support** : ticket si rollback impossible

---

**Fin du runbook. Bon courage Benjamin.**
