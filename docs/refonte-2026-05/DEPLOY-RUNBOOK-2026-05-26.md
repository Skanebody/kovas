# Deploy Runbook — Branche refonte-acqui-target-2026-05 → Prod

> **Lot B101** — Runbook step-by-step exhaustif pour les 3 actions founder restantes.
> **Authority** : ce document est LA séquence d'actions à exécuter par Benjamin Bel pour passer la refonte en production.
> **Pré-requis** : `next build` exit 0 + 33 lots refonte mergés sur `main`.
> **Complément** (pas remplacement) de :
> - [`MIGRATION-PROD-CHECKLIST.md`](./MIGRATION-PROD-CHECKLIST.md) — détail des 10 migrations + checks SQL granulaires (577 lignes)
> - [`UPSTASH-SETUP.md`](./UPSTASH-SETUP.md) — provisioning Upstash + cascade rate-limit
> - [`.env.example`](../../.env.example) — source unique des 80+ variables d'environnement
>
> Ce runbook regroupe les **3 actions critiques** en une seule séquence chronologique avec quick-start, commandes copy-paste, smoke tests inline et plan de contingence consolidé.

---

## Changelog

| Date | Lot | Modification |
|---|---|---|
| 2026-05-26 | B101 | Création initiale — runbook 3 actions (Supabase, Upstash, Vercel) |

---

## Quick Start — 5 commandes essentielles (founder pressé)

Si tu es à l'aise avec la stack et que tu veux la séquence minimale, voici les 5 commandes à enchaîner. **À NE PAS exécuter sans avoir lu au moins la section "Vue d'ensemble" + les pré-requis ci-dessous.**

```bash
# 1. Pré-vol : confirmer link Supabase + dump backup
cd /Users/benjaminbel/Desktop/KOVAS
supabase link --project-ref <PROJECT_REF_PROD>
supabase db dump --linked --file docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26/full-dump.sql

# 2. Appliquer les 10 migrations refonte (toutes idempotentes)
supabase db push --linked

# 3. Provisionner Upstash + récupérer les 2 credentials REST
#    → https://upstash.com → Create Database (kovas-rate-limit, eu-west-1)
#    → Copier UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

# 4. Injecter toutes les env vars Vercel prod (interactif)
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
# ... (cf. liste complète Action 3 § 3.2)

# 5. Smoke test prod
curl -i https://kovas.fr/api/public/v1/observatoire/profession | head -20
# Attendu : 200 + X-RateLimit-Source: upstash
```

---

## Vue d'ensemble — 3 actions séquentielles (60-90 min total)

| # | Action | Effort | Risque | Rollback | Section |
|---|---|---|---|---|---|
| 1 | Supabase 10 migrations | 30-45 min | **MEDIUM** | PITR snapshot pré-deploy | [§ Action 1](#action-1--application-des-10-migrations-supabase-prod) |
| 2 | Upstash Redis EU | 10 min | LOW | aucun rate-limit cassé (fallback in-memory automatique) | [§ Action 2](#action-2--provisionnement-upstash-redis-eu) |
| 3 | Vercel env vars | 15 min | LOW | rollback env vars instantané + redeploy | [§ Action 3](#action-3--vercel-env-vars) |

### Ordre canonique recommandé

```
Action 1 (DB) ──┐
                ├──► Action 3 (Vercel deploy) ──► Smoke tests finaux
Action 2 (Redis)┘
```

**Pourquoi cet ordre** :
- Action 1 et Action 2 sont **indépendantes** (Upstash ne dépend pas de la DB).
- Action 3 (Vercel) **doit venir après** Action 2 pour que les env vars Upstash soient injectées au prochain deploy.
- Le code Next.js prod **tolère** l'absence de migration (les RPC retournent des erreurs propres) mais préfère un déploiement DB-first pour minimiser les 500 sur les nouvelles routes.

### Pré-requis globaux (vérifier AVANT de commencer)

- [ ] **CLI Supabase ≥ 1.200** installé (`brew install supabase/tap/supabase` ou `npm i -g supabase`)
- [ ] **CLI Vercel ≥ 33** installé (`npm i -g vercel` puis `vercel login`)
- [ ] **Authentifié** Supabase (`supabase login`) avec accès owner sur le projet prod
- [ ] **Authentifié** Vercel (`vercel login`) avec accès admin sur le projet `kovas-web`
- [ ] **Plan Supabase Pro** activé (requis pour PITR)
- [ ] **Branche `main`** à jour avec la dernière refonte mergée (`git pull origin main`)
- [ ] **`next build` exit 0** en local sur la branche `main` (`cd apps/web && pnpm build`)
- [ ] **Fenêtre low-traffic** réservée : suggestion mardi 22h-23h CET ou dimanche matin
- [ ] **Backup local** : pousser le repo local sur GitHub (`git push`) au cas où

### Pré-requis techniques

```bash
# Vérification des versions
supabase --version    # ≥ 1.200
vercel --version      # ≥ 33
node --version        # ≥ 20.x
pnpm --version        # ≥ 9.x

# Vérification de l'auth
supabase projects list    # doit montrer kovas-prod
vercel projects ls        # doit montrer kovas-web
```

---

## Action 1 — Application des 10 migrations Supabase prod

> **Détail granulaire** : [`MIGRATION-PROD-CHECKLIST.md`](./MIGRATION-PROD-CHECKLIST.md) (577 lignes) — ce runbook condense les commandes essentielles + smoke tests post-application. **Lire MIGRATION-PROD-CHECKLIST.md pour les checks SQL ligne-à-ligne par migration**.

### Liste des 10 migrations à appliquer (ordre chronologique = ordre des timestamps)

| # | Fichier | Catégorie | Risque |
|---|---|---|---|
| 1 | `20260525170000_data_lake_schemas.sql` | 3 schemas + 9 tables + 2 matviews + 1 RPC PostGIS | Faible |
| 2 | `20260525210000_press_kit_releases.sql` | 3 tables + 1 vue + RLS | Faible |
| 3 | `20260525220000_lead_scoring_a135.sql` | ALTER quote_requests (4 cols) + 2 RPCs | Faible |
| 4 | `20260525230000_v_etat_profession.sql` | 2 vues `security_invoker` | Très faible |
| 5 | `20260525240000_mission_flow_state.sql` | 2 tables + RLS + 1 RPC | Faible |
| 6 | `20260525250000_diagnostician_response_metrics.sql` | 1 index partiel + 1 RPC | Très faible |
| 7 | `20260526100000_matview_first_refresh.sql` | Fix B54 — REFRESH initial matviews | Nul (runtime) |
| 8 | `20260526110000_route_lead_postgis.sql` | Perf B55 — Haversine → PostGIS GIST | Très faible |
| 9 | `20260526190000_user_mission_patterns.sql` | Lot B61 — pattern learning runtime | Faible |
| 10 | `20260526200000_guides_refresh_queue.sql` | Lot B65 — pipeline auto-update guides | Faible |

**Toutes les migrations sont idempotentes** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`).

**Downtime estimé** : 0 min. Fenêtre de précaution recommandée : 15 min low-traffic.

---

### Étape 1.1 — Préparation (T-30 min)

#### Snapshot PITR via console Supabase

Console UI à parcourir :

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Studio > Settings > Database                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Backups                                                     │
│ ──────────                                                  │
│ Daily backups                          [ Enabled ]          │
│ Point in time recovery (PITR)          [ Enabled ✓ ]        │
│                                                             │
│ → Si PITR = Disabled : STOP. Activer (plan Pro requis).     │
│                                                             │
│ Restore from a point in time                                │
│ [ Select restore point ]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> **Si PITR n'est pas activé** : abandonner et activer d'abord. Le plan Pro Supabase est requis (~25$/mois). Sans PITR, le rollback complet en cas de catastrophe est impossible.

#### Dump SQL pré-migration (backup local immédiat)

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# 1. Link au projet prod (skip si déjà fait)
supabase link --project-ref <PROJECT_REF_PROD>
# Note : le ref se trouve dans Supabase Studio > Settings > General > Reference ID

# 2. Créer le dossier snapshot daté
mkdir -p docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26

# 3. Dump complet (schema + data)
supabase db dump --linked \
  --file docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26/full-dump.sql \
  --data-only=false

# 4. Dump rôles + RLS séparés
supabase db dump --linked --role-only \
  --file docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26/roles.sql

# 5. Vérifie la taille (devrait être > 1 MB)
ls -lh docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26/
```

**Attendu** :

```
-rw-r--r--  1 benjaminbel  staff   1.2M May 26 21:30 full-dump.sql
-rw-r--r--  1 benjaminbel  staff    12K May 26 21:30 roles.sql
```

#### Pause des cron jobs existants (par précaution)

Console UI à parcourir :

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Studio > Database > Cron jobs                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Active jobs:                                                │
│  ✓ verify-diagnosticians-daily        [ Pause ]             │
│  ✓ ademe-daily-sync                    [ Pause ]             │
│  ✓ observatoire-monthly-report         [ Pause ]             │
│                                                             │
│ → Cliquer Pause sur chacun.                                 │
│ → Re-activation après Action 1 (étape 1.4).                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Étape 1.2 — Dry-run en local

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# 1. Reset DB locale + applique TOUTES les migrations
supabase db reset

# 2. Vérifie qu'il n'y a aucune erreur dans la sortie
# (en particulier les 10 nouvelles : 20260525170000 → 20260526200000)
```

**Si le reset local échoue** → **STOP** ici. Debug en local d'abord. Ne pas pousser en prod tant qu'une migration n'est pas verte localement.

---

### Étape 1.3 — Application séquentielle en prod (T-0)

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# 1. Liste les migrations distantes pour comparaison
supabase migration list --linked

# 2. Application séquentielle (ordre des timestamps respecté)
supabase db push --linked
```

**Sortie attendue** :

```
Connecting to remote database...
Applying migration 20260525170000_data_lake_schemas.sql...
Applying migration 20260525210000_press_kit_releases.sql...
Applying migration 20260525220000_lead_scoring_a135.sql...
Applying migration 20260525230000_v_etat_profession.sql...
Applying migration 20260525240000_mission_flow_state.sql...
Applying migration 20260525250000_diagnostician_response_metrics.sql...
Applying migration 20260526100000_matview_first_refresh.sql...
Applying migration 20260526110000_route_lead_postgis.sql...
Applying migration 20260526190000_user_mission_patterns.sql...
Applying migration 20260526200000_guides_refresh_queue.sql...
Finished supabase db push.
```

> ⚠️ **Si une migration échoue** : `db push` s'arrête sur la première erreur. Note **laquelle** a échoué, puis va à la section [Rollback Action 1](#rollback-action-1).

#### Variante (si `db push` rencontre un conflit de schema_migrations)

```bash
# Application interactive avec confirmation
supabase migration up --linked

# OU application manuelle migration par migration
psql "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  -f supabase/migrations/20260525170000_data_lake_schemas.sql
# (répéter pour chaque migration)
```

---

### Étape 1.4 — Smoke tests post-migration (T+5 min)

Ouvrir **Supabase Studio > SQL Editor** et exécuter ce bloc en une seule fois :

```sql
-- ============================================================
-- SMOKE TESTS POST-MIGRATION REFONTE 2026-05-26
-- ============================================================

-- A. Les 3 schemas data lake existent
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('data', 'analytics', 'internal')
ORDER BY schema_name;
-- Attendu : 3 lignes (analytics, data, internal)

-- B. Les 9 tables data.* sont créées
SELECT count(*)::int AS data_tables_count
FROM information_schema.tables WHERE table_schema = 'data';
-- Attendu : ≥ 9 (properties_unified, dvf_mutations, ademe_dpe, etc.)

-- C. Les 2 matviews analytics.* existent + ispopulated = true
SELECT matviewname, ispopulated FROM pg_matviews
WHERE schemaname = 'analytics' ORDER BY matviewname;
-- Attendu : 2 lignes, ispopulated = true partout (grâce fix B54)

-- D. Les 3 tables press_* existent
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'press_%'
ORDER BY table_name;
-- Attendu : 3 lignes (press_contacts, press_release_sends, press_releases)

-- E. Les 4 colonnes intent_* existent sur quote_requests
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quote_requests'
  AND column_name LIKE 'intent_%'
ORDER BY column_name;
-- Attendu : 4 lignes (intent_bucket, intent_score, intent_scored_at, intent_signals)

-- F. Les 2 vues v_etat_profession existent
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname LIKE 'v_etat_profession%'
ORDER BY viewname;
-- Attendu : 2 lignes (v_etat_profession_by_dept, v_etat_profession_summary)

-- G. Les 2 tables mission_flow_* existent
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'mission_flow_%'
ORDER BY table_name;
-- Attendu : 2 lignes (mission_flow_events, mission_flow_states)

-- H. La RPC mission_flow_transition est callable (renvoie une erreur propre)
SELECT * FROM public.mission_flow_transition(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'capture_terrain',
  'photos',
  NULL,
  'user_action',
  '{}'::jsonb
);
-- Attendu : 1 ligne (ok=false, error_reason='mission_not_found')

-- I. La RPC route_lead_rank_candidates (perf B55 PostGIS) callable
SELECT count(*)::int FROM public.route_lead_rank_candidates(
  48.8566::float8, 2.3522::float8, 30, 5, false
);
-- Attendu : 0..5 (sans erreur), selon densité diagnosticians prod

-- J. L'index GIST PostGIS est créé
SELECT indexname FROM pg_indexes
WHERE tablename = 'diagnosticians'
  AND indexname = 'idx_diagnosticians_geog_active';
-- Attendu : 1 ligne

-- K. Table user_mission_patterns créée + RLS active (B61)
SELECT relname, relrowsecurity FROM pg_class
WHERE relname = 'user_mission_patterns';
-- Attendu : 1 ligne, relrowsecurity = true

-- L. Pipeline guides refresh queue créé (B65)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'internal'
  AND table_name IN ('guide_refresh_queue', 'guide_versions');
-- Attendu : 2 lignes

-- M. RLS policies actives sur les nouvelles tables sensibles
SELECT schemaname, tablename, count(*)::int AS policies
FROM pg_policies
WHERE schemaname IN ('public', 'data', 'internal')
  AND tablename IN (
    'press_contacts', 'press_releases', 'press_release_sends',
    'mission_flow_events', 'mission_flow_states',
    'user_mission_patterns', 'guide_refresh_queue', 'guide_versions'
  )
GROUP BY 1, 2
ORDER BY 1, 2;
-- Attendu : ≥ 8 lignes, chaque table avec ≥ 1 policy

-- N. Comptage final sanity check
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'data')::int AS data_tables,
  (SELECT count(*) FROM pg_matviews WHERE schemaname = 'analytics')::int AS analytics_matviews,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'internal')::int AS internal_tables,
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('bandit_thompson_rank', 'route_lead_rank_candidates', 'mission_flow_transition', 'get_diagnostician_response_metrics', 'diagnosticians_within_radius'))::int AS new_rpcs;
-- Attendu : data_tables ≥ 9, analytics_matviews = 2, internal_tables ≥ 4, new_rpcs = 5
```

**Si UNE seule de ces queries renvoie un résultat inattendu** → traiter comme un échec partiel. Décider entre :
1. **Continuer** si l'écart est explicable (ex : table déjà existante sans risque).
2. **Rollback ciblé** (cf. [Rollback Action 1](#rollback-action-1)).

---

### Étape 1.5 — Réactivation des crons (T+10 min)

Console UI :

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Studio > Database > Cron jobs                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Paused jobs:                                                │
│  ✗ verify-diagnosticians-daily        [ Resume ]            │
│  ✗ ademe-daily-sync                    [ Resume ]            │
│  ✗ observatoire-monthly-report         [ Resume ]            │
│                                                             │
│ → Cliquer Resume sur chacun.                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Rollback Action 1

#### Cas 1 — Une migration sur les 10 a échoué

`db push` s'arrête à la première erreur. Les migrations précédentes sont **déjà appliquées**. Décision :

1. **Diagnostic** : lire le message d'erreur Postgres complet.
2. **Si erreur trivial** (ex : extension manquante, permission) → fix manuel via SQL Editor + relancer `db push`.
3. **Si erreur grave** (ex : table conflit, syntax error inhérent à la migration) → exécuter le rollback ciblé ci-dessous **dans l'ordre inverse** des migrations qui ont réussi (cf. [MIGRATION-PROD-CHECKLIST.md § 7.2](./MIGRATION-PROD-CHECKLIST.md#72-rollback-ciblé-par-migration-drop-manuel) pour le détail SQL).

#### Cas 2 — Toutes les migrations ont passé mais l'app crash 500

Pas de rollback DB nécessaire — c'est le code Next.js qui a un bug. Rollback Vercel :

```bash
# Lister les déploiements récents
vercel ls

# Promouvoir le déploiement précédent en prod
vercel promote <previous-deployment-url> --scope=<team>
```

#### Cas 3 — Corruption / perte de données détectée (catastrophe)

**Restore PITR complet** via console :

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Studio > Settings > Database > PITR                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Restore from a point in time                                │
│                                                             │
│ Restore point : [ 2026-05-26 21:25:00 UTC ]  ← 5 min avant │
│                                                             │
│ ⚠️  Restore creates a new project ID                       │
│ ⚠️  All writes after restore point will be LOST           │
│                                                             │
│ [ Initiate restore ]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Downtime estimé : ~5-10 min (Supabase crée un nouveau projet, on bascule les env vars Vercel sur le nouveau ref).

---

## Action 2 — Provisionnement Upstash Redis EU

> **Détail granulaire** : [`UPSTASH-SETUP.md`](./UPSTASH-SETUP.md) (242 lignes) — ce runbook condense les 3 étapes essentielles. **Lire UPSTASH-SETUP.md pour le détail de la cascade rate-limit (Upstash → in-memory) et les tests locaux**.

### Pourquoi cette action

Le module [`apps/web/src/lib/api-public/rate-limit.ts`](../../apps/web/src/lib/api-public/rate-limit.ts) implémente une cascade résiliente : **si Upstash absent en prod → fallback in-memory non-distribué**. Conséquence : un attaquant peut hammering plusieurs lambdas Vercel froides → la limite "60 req/min anon" n'est plus tenue.

Provisioning Upstash = 10 min, gratuit (Free tier 10k commands/jour), résout le problème de façon durable.

---

### Étape 2.1 — Créer le compte + la base (5 min)

#### Création du compte

1. Aller sur https://upstash.com → **Sign Up** (GitHub OAuth recommandé)
2. Pas de carte bancaire requise pour le Free tier
3. Confirmer l'email reçu

#### Création de la base Redis

Console UI à parcourir :

```
┌─────────────────────────────────────────────────────────────┐
│ Upstash Console > Databases > Create Database               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name        : [ kovas-rate-limit              ]             │
│                                                             │
│ Type        : ◉ Regional                                    │
│               ○ Global (multi-region)                       │
│                                                             │
│ Region      : ◉ EU West 1 (Ireland)        ← RGPD          │
│               ○ EU Central 1 (Frankfurt)                    │
│               ○ US East 1 (N. Virginia)    ⛔ ne pas choisir│
│                                                             │
│ TLS/SSL     : ✓ Enabled (default)                           │
│ Eviction    : noeviction (default — nos clés ont TTL 60s)   │
│ Plan        : ◉ Free (10k commands/day, 256 MB)            │
│                                                             │
│ [ Create Database ]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> ⛔ **NE PAS choisir US ou autre région non-UE** — transferts de données IP utilisateurs FR hors RGPD = sanction CNIL potentielle.

---

### Étape 2.2 — Récupérer les 2 credentials REST

Une fois la base créée, dashboard de la base → onglet **REST API** :

```
┌─────────────────────────────────────────────────────────────┐
│ Database: kovas-rate-limit > REST API                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Endpoint                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ https://kovas-rate-limit-12345.upstash.io          [📋] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Token (read-write)                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AaBbCcDdEeFfGg...XxYyZz                            [📋] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⚠️  Garde ce token secret — accès complet à la base        │
│                                                             │
│ [ Reset Token ]                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Copier les 2 valeurs dans un gestionnaire de mots de passe sécurisé (1Password, Bitwarden) :

- `UPSTASH_REDIS_REST_URL` : `https://kovas-rate-limit-12345.upstash.io`
- `UPSTASH_REDIS_REST_TOKEN` : `AaBbCc...` (~80-120 chars base64)

> ⚠️ **NE JAMAIS commit ces secrets dans git.** Le token donne accès complet à la base.

---

### Étape 2.3 — Configurer en local (optionnel, recommandé pour test)

```bash
# Éditer .env.local à la racine du repo
cd /Users/benjaminbel/Desktop/KOVAS

# Ajouter les 2 lignes :
# UPSTASH_REDIS_REST_URL=https://kovas-rate-limit-12345.upstash.io
# UPSTASH_REDIS_REST_TOKEN=AaBbCc...

# Le symlink apps/web/.env.local → ../../.env.local existe déjà
# (cf. UPSTASH-SETUP.md § 9 FAQ)

# Redémarrer le serveur dev pour propager
cd apps/web && pnpm dev
```

Test local de la cascade Upstash :

```bash
# Faire 65 requêtes consécutives sur /api/public/v1/openapi.json
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/public/v1/openapi.json
done

# Attendu : 60 × 200, puis 5 × 429 (Too Many Requests)

# Vérifier le header X-RateLimit-Source
curl -i http://localhost:3000/api/public/v1/openapi.json | grep -i ratelimit
# Attendu : X-RateLimit-Source: upstash
```

---

### Étape 2.4 — Configurer en prod (Vercel)

**À faire dans le cadre de l'Action 3 ci-dessous** — les 2 variables Upstash font partie de la liste exhaustive des env vars Vercel à injecter.

---

### Smoke test rate-limit en prod (post-déploiement)

À exécuter **après Action 3 + redeploy Vercel** :

```bash
# Faire 70 requêtes consécutives sur l'API publique
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code}\n" https://kovas.fr/api/public/v1/observatoire/profession
done

# Attendu : 60 × 200, puis 10 × 429 (la limite anon est 60 req/min)

# Vérifier que le header indique bien Upstash actif
curl -i https://kovas.fr/api/public/v1/observatoire/profession 2>&1 | grep -i ratelimit

# Attendu :
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 59
# X-RateLimit-Source: upstash    ← critique
```

### Rollback Action 2

**Aucune action requise** — la cascade rate-limit du module détecte automatiquement les erreurs Upstash et fallback in-memory :

```typescript
// apps/web/src/lib/api-public/rate-limit.ts (extrait)
try {
  return await upstashRateLimit(key, limit, window);
} catch (err) {
  console.warn('[rate-limit] Upstash error, fallback memory:', err);
  return memoryRateLimit(key, limit, window);
}
```

Si tu veux **explicitement désactiver Upstash** (économie budget, debug) : supprimer les 2 env vars Vercel + redeploy. Le code retombe automatiquement sur in-memory (acceptable temporairement, non distribué).

---

## Action 3 — Vercel env vars

### Liste exhaustive des variables à injecter en prod

**Source de vérité** : [`.env.example`](../../.env.example) à la racine du monorepo (596 lignes, 80+ variables).

#### Variables CRITIQUES (sans elles, le site casse)

| Variable | Valeur prod | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` | Supabase Studio > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (JWT anon) | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (JWT service_role) | idem · **SENSITIVE** |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic Console > API Keys · **SENSITIVE** |
| `OPENAI_API_KEY` | `sk-...` (Whisper) | OpenAI Platform > API Keys · **SENSITIVE** |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe Dashboard > Developers > API keys · **SENSITIVE** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Dashboard > Webhooks > endpoint signing secret · **SENSITIVE** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe Dashboard |
| `RESEND_API_KEY` | `re_...` | Resend Dashboard · **SENSITIVE** |
| `RESEND_FROM` | `KOVAS <contact@kovas.fr>` | (constante) |
| `NEXT_PUBLIC_APP_URL` | `https://kovas.fr` | (constante) |
| `NEXT_PUBLIC_API_URL` | `https://kovas.fr/api` | (constante) |
| `NODE_ENV` | `production` | (Vercel injecte auto) |

#### Variables nouvelles refonte (lots B66-B98)

| Variable | Valeur prod | Source / commentaire |
|---|---|---|
| `ANTHROPIC_MODEL_VOICE` | `claude-haiku-4-5` | (constante) |
| `ANTHROPIC_MODEL_VISION` | `claude-sonnet-4-6` | (constante) |
| `ANTHROPIC_MODEL_CHAT` | `claude-haiku-4-5` | (constante) |
| `ANTHROPIC_VISION_MODEL` | `claude-haiku-4-5` | (constante, alias legacy) |
| `ANTHROPIC_CONSOLIDATION_MODEL` | `claude-sonnet-4-6` | (constante) |
| `ANTHROPIC_BOT_MODEL` | `claude-haiku-4-5` | (constante) |
| `OPENAI_MODEL_TRANSCRIBE` | `gpt-4o-mini-transcribe` | (constante) |
| `USD_TO_EUR_RATE` | `0.92` | À mettre à jour trimestriellement |
| `PRESS_ADMIN_NOTIFY_EMAIL` | `contact@kovas.fr` | (constante) |
| `GUIDES_ADMIN_NOTIFY_EMAIL` | `contact@kovas.fr` | (constante, Lot B65) |

#### Upstash (Action 2)

| Variable | Valeur prod | Source |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | `https://kovas-rate-limit-12345.upstash.io` | Upstash dashboard (cf. Action 2) |
| `UPSTASH_REDIS_REST_TOKEN` | `AaBbCc...` | idem · **SENSITIVE** |

#### MDB Writer (Lot B94 — Railway)

| Variable | Valeur prod | Source |
|---|---|---|
| `MDB_WRITER_URL` | `https://kovas-mdb-writer.up.railway.app` | Railway dashboard (URL du service Java) |
| `MDB_WRITER_API_KEY` | `<32 bytes hex>` | À générer : `openssl rand -hex 32` · **SENSITIVE** |

#### Observabilité

| Variable | Valeur prod | Source |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | `https://<key>@<org>.ingest.sentry.io/<project>` | Sentry > Settings > Client Keys |
| `SENTRY_AUTH_TOKEN` | `sntrys_...` | Sentry > User Settings > Auth Tokens · **SENSITIVE** |
| `SENTRY_ORG` | `nexus-1993` | (constante) |
| `SENTRY_PROJECT` | `kovas-web` | (constante) |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | PostHog > Settings > Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.posthog.com` | (constante — EU instance) |
| `BETTER_STACK_UPTIME_TOKEN` | `<token>` | Better Stack dashboard · **SENSITIVE** |

#### OAuth Google + Dropbox (Lot B82 — file sharing)

| Variable | Valeur prod | Source |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `<...>.apps.googleusercontent.com` | Google Cloud Console > APIs & Services > Credentials |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `GOCSPX-...` | idem · **SENSITIVE** |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://kovas.fr/api/auth/google/callback` | (constante) |
| `DROPBOX_APP_KEY` | `<...>` | Dropbox App Console |
| `DROPBOX_APP_SECRET` | `<...>` | idem · **SENSITIVE** |

#### Cron secrets

| Variable | Valeur prod | Source |
|---|---|---|
| `CRON_SECRET` | `<32+ chars random>` | Générer : `openssl rand -hex 32` · **SENSITIVE** |
| `INTERNAL_CRON_SECRET` | `<32+ chars random>` | idem · **SENSITIVE** |
| `INTERNAL_API_SECRET` | `<32+ chars random>` | idem · **SENSITIVE** |

#### reCAPTCHA (Lot B70 — anti-spam formulaires)

| Variable | Valeur prod | Source |
|---|---|---|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | `6Lc...` | Google reCAPTCHA admin console |
| `RECAPTCHA_SECRET_KEY` | `6Lc...` | idem · **SENSITIVE** |

#### Telegram (notifications founder)

| Variable | Valeur prod | Source |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `<...>` | @BotFather sur Telegram · **SENSITIVE** |
| `TELEGRAM_WEBHOOK_SECRET` | `<32+ chars random>` | Générer : `openssl rand -hex 32` · **SENSITIVE** |
| `TELEGRAM_ADMIN_USER_ID` | `<numeric>` | @userinfobot sur Telegram |
| `TELEGRAM_CHAT_ID_SIGNUPS` | `<numeric>` | Chat ID notifications signups |
| `TELEGRAM_CHAT_ID_REVENUE` | `<numeric>` | Chat ID notifications revenue |
| `TELEGRAM_CHAT_ID_ALERTS` | `<numeric>` | Chat ID notifications alerts |
| `TELEGRAM_CHAT_ID_ERRORS` | `<numeric>` | Chat ID notifications erreurs |

#### Stripe Price IDs (40+ variables)

Voir [`.env.example`](../../.env.example) lignes 57-108 pour la liste exhaustive des `STRIPE_PRICE_*`. Toutes à récupérer depuis Stripe Dashboard > Products > [chaque produit] > Pricing > Price ID (`price_...`).

> **Astuce** : exporter toutes ces vars depuis Stripe CLI en une commande :
>
> ```bash
> stripe prices list --limit 100 --output json | jq '.[] | {id, nickname}'
> ```

---

### Étape 3.1 — Injecter les env vars via Vercel CLI

```bash
cd /Users/benjaminbel/Desktop/KOVAS

# Authentification (skip si déjà fait)
vercel login
vercel link  # lier le repo au projet kovas-web

# Injection variable par variable (interactif, paste la valeur quand demandé)
vercel env add ANTHROPIC_API_KEY production
# (paste sk-ant-... + Enter)

vercel env add UPSTASH_REDIS_REST_URL production
# (paste https://kovas-rate-limit-12345.upstash.io + Enter)

vercel env add UPSTASH_REDIS_REST_TOKEN production
# (paste AaBbCc... + Enter)

# ... répéter pour CHAQUE variable de la liste ci-dessus
```

#### Variante (plus rapide) — import via dashboard

Console UI à parcourir :

```
┌─────────────────────────────────────────────────────────────┐
│ Vercel Dashboard > kovas-web > Settings > Env Variables     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Production · Preview · Development                          │
│                                                             │
│ [ + Add New ]                                               │
│                                                             │
│ NAME                  VALUE         ENVS                    │
│ ─────────────────────────────────────────────────           │
│ ANTHROPIC_API_KEY    sk-ant-***  Prod, Preview              │
│ NEXT_PUBLIC_*         (visible)  Prod, Preview              │
│ STRIPE_SECRET_KEY    sk_live_*** Prod only                  │
│ ...                                                         │
│                                                             │
│ [ Import .env ]  ← Bulk import via fichier .env             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Bulk import :

1. Créer un fichier temporaire `prod.env` contenant TOUTES les vars en format `KEY=VALUE` (une par ligne)
2. Vercel Dashboard > Env Variables > **Import .env**
3. Coller le contenu, sélectionner **Production** uniquement
4. **Supprimer immédiatement** `prod.env` du disque (`rm prod.env`)

> ⚠️ **Marquer les SENSITIVE en "Sensitive"** : la checkbox "Sensitive" masque la valeur dans les logs Vercel et empêche son affichage UI après injection. À cocher impérativement pour : `*_API_KEY`, `*_SECRET`, `*_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.

---

### Étape 3.2 — Redéployer la prod

```bash
# Option A — redéployer depuis main (recommandé)
vercel deploy --prod

# Option B — promouvoir le dernier déploiement preview
vercel ls
vercel promote <preview-url> --scope=<team>

# Option C — trigger via git push (CI/CD automatique)
git push origin main
```

Suivre la progression dans Vercel Dashboard > Deployments. Attendre le **status Ready** (~2-3 min build).

---

### Étape 3.3 — Smoke tests post-déploiement Vercel

```bash
# 1. Home publique 200
curl -sf -o /dev/null -w "Home: %{http_code}\n" https://kovas.fr

# 2. Sitemap accessible
curl -sf -o /dev/null -w "Sitemap: %{http_code}\n" https://kovas.fr/sitemap.xml

# 3. Robots.txt
curl -sf -o /dev/null -w "Robots: %{http_code}\n" https://kovas.fr/robots.txt

# 4. API publique observatoire (200 + JSON valide)
curl -sf https://kovas.fr/api/public/v1/observatoire/profession | jq '.data.total_diagnosticians'

# 5. API OpenAPI spec
curl -sf https://kovas.fr/api/public/v1/openapi.json | jq '.openapi'
# Attendu : "3.1.0"

# 6. Rate-limit Upstash actif
curl -i https://kovas.fr/api/public/v1/openapi.json 2>&1 | grep -i ratelimit
# Attendu : X-RateLimit-Source: upstash

# 7. Dashboard auth-redirect
curl -sf -o /dev/null -w "Dashboard: %{http_code}\n" https://kovas.fr/dashboard
# Attendu : 307 → /login

# 8. OG image dynamique
curl -sf -o /dev/null -w "OG image: %{content_type}\n" https://kovas.fr/opengraph-image
# Attendu : image/png

# 9. MDB writer Railway ping (si déployé)
curl -sf -o /dev/null -w "MDB writer: %{http_code}\n" $MDB_WRITER_URL/health
# Attendu : 200
```

### Rollback Action 3

#### Cas 1 — Variable mal saisie / typo

```bash
# Supprimer la variable
vercel env rm <VAR_NAME> production

# Re-ajouter avec la bonne valeur
vercel env add <VAR_NAME> production

# Redeploy
vercel deploy --prod
```

#### Cas 2 — Déploiement crash

```bash
# Lister les déploiements récents
vercel ls

# Promouvoir le déploiement précédent stable en prod
vercel promote <previous-deployment-url> --scope=<team>
```

Effet immédiat (~10 secondes) — pas de downtime visible.

#### Cas 3 — Suppression massive d'env vars (mauvaise manipulation)

Vercel garde un historique des env vars dans **Settings > Env Variables > Recently Deleted** (rétention 30j). Restaurer en 1 clic.

---

## Smoke tests finaux post-déploiement (consolidés)

### Smoke tests HTTP (15 routes)

```bash
#!/bin/bash
# Sauve dans /tmp/smoke-tests.sh + bash /tmp/smoke-tests.sh

BASE=https://kovas.fr
PASS=0
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$actual" = "$expected" ]; then
    echo "✓ $label ($actual)"
    PASS=$((PASS+1))
  else
    echo "✗ $label (got $actual, expected $expected)"
    FAIL=$((FAIL+1))
  fi
}

# Pages publiques (toutes attendues 200)
check "Home" $BASE 200
check "Tarifs" $BASE/tarifs 200
check "Comparatif" $BASE/comparatif 200
check "Témoignages" $BASE/temoignages 200
check "Démo" $BASE/demo 200
check "API publique landing" $BASE/api-publique 200
check "À propos" $BASE/a-propos 200
check "Aide" $BASE/aide 200
check "Observatoire" $BASE/observatoire 200
check "Presse" $BASE/presse 200
check "Contact" $BASE/contact 200
check "Sitemap" $BASE/sitemap.xml 200
check "Robots" $BASE/robots.txt 200

# Routes auth-protégées (redirect 307)
check "Dashboard (auth-redirect)" $BASE/dashboard 307

# API publique (200 + rate-limit)
check "API observatoire" $BASE/api/public/v1/observatoire/profession 200
check "API OpenAPI spec" $BASE/api/public/v1/openapi.json 200

echo ""
echo "Résultat : $PASS passed, $FAIL failed"
```

### Smoke tests rate-limit

```bash
# Vérifier que la limite 60/min est appliquée par Upstash
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code} " https://kovas.fr/api/public/v1/observatoire/profession
done
echo ""
# Attendu : 60 × 200, puis 10 × 429
```

### Smoke tests Sentry + PostHog

1. Sentry Dashboard → Projects → kovas-web : **pas de nouvelle erreur 5xx** dans les 5 min post-deploy
2. PostHog Dashboard → Live Events : événements `$pageview` arrivent en temps réel

### Smoke tests DB intégration

À exécuter dans **Supabase Studio > SQL Editor** :

```sql
-- Vérifier que les nouveaux RPC sont appelables depuis le client (RLS-correct)
SELECT public.get_diagnostician_response_metrics(
  '00000000-0000-0000-0000-000000000000'::uuid
);
-- Attendu : 1 ligne (median_minutes=NULL, sample_size=0) — pas d'erreur permission

-- Vérifier que la vue observatoire est lisible par anon
SET ROLE anon;
SELECT total_diagnosticians FROM public.v_etat_profession_summary LIMIT 1;
RESET ROLE;
-- Attendu : 1 valeur entière > 0 (pas d'erreur RLS)
```

---

## Plan de contingence (si problème majeur)

### Niveau 1 — Bug visible mais site fonctionnel

**Symptôme** : une page secondaire 500, un bouton inactif, un email pas envoyé.

**Action** :
1. Capturer la trace Sentry (URL exacte du bug)
2. Créer un PR fix sur `main` → merge → redeploy via CI
3. Pas de rollback nécessaire

**Communication** : silence externe. Slack/Telegram interne uniquement.

---

### Niveau 2 — Pages critiques 500 (Home, Dashboard, Login)

**Symptôme** : kovas.fr renvoie 500 sur des routes high-traffic.

**Action** :
1. **Rollback Vercel immédiat** (5 secondes) :
   ```bash
   vercel ls
   vercel promote <previous-stable-url> --scope=<team>
   ```
2. La DB reste migrée (les anciennes RPC continuent de marcher car les migrations sont **purement additives**)
3. Investiguer le bug à froid

**Communication** : status page mise à jour ("Maintenance en cours").

---

### Niveau 3 — Corruption DB / perte de données

**Symptôme** : SQL queries renvoient des résultats incohérents, données disparues, RLS bypass détecté.

**Action** :
1. **Lock immédiat des writes** : passer Supabase en mode read-only via console
2. **Snapshot d'urgence** : `supabase db dump --linked --file emergency-dump.sql`
3. **Restore PITR** à T-15 minutes (cf. [Rollback Action 1 Cas 3](#cas-3--corruption--perte-de-données-détectée-catastrophe))
4. **Communication interne** : ping Benjamin sur Telegram alerts
5. **Communication externe** : status page mise à jour, email aux 40 bêta-testeurs si pertinent

---

### Contacts d'urgence

| Service | Méthode | SLA |
|---|---|---|
| **Supabase support** | Dashboard > Help > Open ticket (priority Pro) | < 4h heures ouvrées |
| **Vercel support** | Dashboard > Help (Pro plan) | < 24h |
| **Upstash support** | dashboard chat | < 24h (Free tier best-effort) |
| **Stripe support** | dashboard.stripe.com/support | < 4h |
| **Anthropic support** | console.anthropic.com/settings/support | < 24h |
| **DNS Cloudflare** | cloudflare.com/support | self-service immédiat |

### Owner principal

- **Benjamin Bel** — benjaminbel@outlook.fr
- Téléphone : (dans 1Password sous "KOVAS Founder Contact")

---

## Annexes

### A. Checklist consolidée (à imprimer le jour J)

#### Pré-vol (T-30 min)

- [ ] CLI Supabase ≥ 1.200 installée + `supabase login` OK
- [ ] CLI Vercel ≥ 33 installée + `vercel login` OK
- [ ] `git pull origin main` à jour
- [ ] `pnpm build` exit 0 en local
- [ ] Plan Supabase Pro + PITR activé (Studio > Settings > Database)
- [ ] Fenêtre low-traffic réservée

#### Action 1 — Supabase migrations (T-0 → T+15)

- [ ] Dump complet : `supabase db dump --linked --file docs/refonte-2026-05/snapshots/pre-deploy-2026-05-26/full-dump.sql`
- [ ] Crons existants pausés (verify-diagnosticians-daily, ademe-daily-sync, observatoire-monthly-report)
- [ ] Dry-run local : `supabase db reset` exit 0
- [ ] Application prod : `supabase db push --linked` exit 0
- [ ] Smoke test SQL (les 14 queries A-N) toutes vertes
- [ ] Crons réactivés

#### Action 2 — Upstash (T+15 → T+25)

- [ ] Compte Upstash créé
- [ ] Base `kovas-rate-limit` créée en région `eu-west-1` (Free tier)
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` copiés dans 1Password
- [ ] (optionnel) Test local : `X-RateLimit-Source: upstash` confirmé

#### Action 3 — Vercel env vars (T+25 → T+40)

- [ ] Toutes les vars CRITIQUES injectées en `production` (cf. liste § 3)
- [ ] Vars nouvelles refonte (B66-B98) injectées
- [ ] Vars Upstash injectées
- [ ] Vars MDB Writer injectées
- [ ] Vars Observabilité (Sentry, PostHog) injectées
- [ ] Vars OAuth (Google, Dropbox) injectées
- [ ] Vars Cron secrets injectées
- [ ] Vars Stripe Price IDs injectées (40+)
- [ ] SENSITIVE marqué sur toutes les vars `*_SECRET`, `*_TOKEN`, `*_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Redeploy `vercel deploy --prod` exit 0
- [ ] Smoke tests HTTP (15 routes) toutes vertes
- [ ] Smoke test rate-limit (60 × 200 + 10 × 429) OK
- [ ] Sentry : pas de nouvelle erreur 5xx dans les 5 min
- [ ] PostHog : événements live OK

#### Post-déploiement (T+40 → J+1)

- [ ] Monitoring Sentry 24h actif
- [ ] Premier refresh manuel matviews le lendemain matin (cf. MIGRATION-PROD-CHECKLIST.md § 8.2)
- [ ] Vérification 1er run cron `ingest-ademe-dpe-daily` à 5h CET le lendemain
- [ ] Tag git `deploy/refonte-acqui-target-2026-05-26` créé : `git tag deploy/refonte-acqui-target-2026-05-26 && git push --tags`

---

### B. Glossaire des composants critiques

| Terme | Définition |
|---|---|
| **PITR** | Point In Time Recovery — Supabase Pro feature, permet restore DB à n'importe quelle seconde du dernier mois |
| **Cascade rate-limit** | Mécanisme `lib/api-public/rate-limit.ts` : Upstash → in-memory fallback automatique en cas d'erreur |
| **Matview** | Materialized view PostgreSQL — `analytics.passoires_thermiques_by_commune` + `analytics.transactions_history_by_commune` |
| **RPC** | Remote Procedure Call PostgreSQL — fonction SQL appelable depuis Supabase client (`supabase.rpc(...)`) |
| **RLS** | Row Level Security — policies Supabase qui filtrent les rows visibles par user authentifié |
| **Edge Function** | Fonction Deno servie par Supabase (ingest-ademe-dpe-daily, refresh-data-lake-matviews, etc.) |
| **MDB Writer** | Microservice Java/Jackcess sur Railway qui écrit les fichiers .mdb (format Liciel) |

---

### C. Variables d'environnement absentes / différées

Ces variables n'ont pas besoin d'être injectées en prod aujourd'hui :

- `DEEPGRAM_API_KEY` — fallback transcription, optionnel
- `BREVO_API_KEY` + `BREVO_SMS_SENDER` — SMS, V1.5 post-launch
- `KOVAS_DEV_*` — variables dev only, ne pas mettre en prod
- `AXIOM_TOKEN` + `AXIOM_DATASET` — logging avancé, M3+
- Stripe Price IDs **bundles + slots + addons** — peut être incomplet en bêta, à compléter au fur et à mesure des produits Stripe créés

---

### D. Liens de référence

- [`MIGRATION-PROD-CHECKLIST.md`](./MIGRATION-PROD-CHECKLIST.md) — détail granulaire des 10 migrations + checks SQL ligne par ligne
- [`UPSTASH-SETUP.md`](./UPSTASH-SETUP.md) — détail Upstash + cascade rate-limit + tests
- [`AI_ECONOMICS.md`](./AI_ECONOMICS.md) — modèle de coût Claude/Whisper + alertes
- [`PROGRESS.md`](./PROGRESS.md) — état d'avancement des 33+ lots refonte
- [`.env.example`](../../.env.example) — source unique des 80+ variables d'environnement
- [`apps/web/src/lib/api-public/rate-limit.ts`](../../apps/web/src/lib/api-public/rate-limit.ts) — module cascade rate-limit

---

**Fin du runbook.**

Bon courage Benjamin — la séquence est défensive, idempotente, et chaque action a son rollback. En cas de doute pendant l'exécution : **STOP**, capture une trace (screenshot, log), et reviens à ce document avant de prendre la moindre décision destructive.
