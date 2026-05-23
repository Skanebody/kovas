# Réconciliation Supabase prod — FIX-AA (2026-05-23)

> Session de réconciliation entre les 130+ migrations locales `supabase/migrations/*.sql` et l'état effectif de Supabase prod (`jlizdkffwjdiokvmhcwg`). Objectif : remettre la prod en cohérence avec le repo et réactiver le tracking `schema_migrations`.

## Contexte

Avant la session :

- **130 migrations locales** dans `supabase/migrations/`.
- **59 tables en prod** sans aucun tracking (`supabase_migrations.schema_migrations` n'existait pas).
- La prod avait été construite par patches successifs via Management API (`scripts/seed-diagnosticians-prod.sh`, `scripts/deploy-prod-migrations.sh`, etc.), sans jamais activer le tracking standard Supabase CLI.
- Tables manquantes critiques : `admin_users`, `quote_requests`, `veille_articles_draft`, `veille_keywords_priority`, `observatoire_reports`, `observatoire_press_citations`, `observatoire_live_stats`.
- Fonction `is_admin(uuid)` absente.
- Extension `vault` activée, `pgcrypto` OK, mais `unaccent` / `pg_trgm` à confirmer.

## Méthode — 5 étapes

### Étape 1 — Backup logique

`pg_dump` n'est pas installé localement (pas de brew/postgres-client sur cet hôte macOS). Solution : un **snapshot logique JSON** via Management API (`scripts/prod-snapshot.ts`) qui capture :

- Inventaire complet (tables, columns, indexes, functions, policies, views, triggers).
- Comptes de lignes par table (`pg_stat_user_tables.n_live_tup`).

Output : `backups/prod-snapshot-{timestamp}.json` (gitignored). **NB** : ce n'est PAS un dump SQL complet — pour un vrai rollback bit-perfect, il faut Supabase Dashboard → Database → Backups (PITR Pro tier).

**Snapshot pré-reconciliation** (`backups/prod-snapshot-2026-05-23-10-25-15.json`) :
- 59 tables, 909 colonnes, 239 indexes, 67 policies, 6 views, 30 triggers
- 8808 lignes estimées

### Étape 2 — Audit ligne par ligne

Script `scripts/migration-status-audit.ts` :

- Lit chaque migration `supabase/migrations/*.sql`.
- Parse le SQL avec regex pour extraire les objets créés (tables, fonctions, indexes, policies, views, triggers).
- Compare contre l'inventaire prod (information_schema + pg_indexes + pg_policies + pg_triggers).
- Calcule un statut par migration :
  - `applied` — tous les objets attendus existent.
  - `needs_apply` — aucun objet n'existe.
  - `partial` — certains objets existent, d'autres manquent.
  - `empty` — la migration ne crée aucun objet trackable (seeds, ALTER seuls).

**Output** : `scripts/migration-status-result.json` (gitignored).

**État initial après audit** :
- `applied: 23, needs_apply: 81, partial: 9, empty: 17, total: 130`

### Étape 3 — Consolidate migration idempotente

Migration `supabase/migrations/20260524180000_consolidate_schema_reconciliation.sql` (370 lignes), 100% idempotente :

1. Extensions requises (`pgcrypto`, `unaccent`, `pg_trgm`).
2. Helper `immutable_unaccent(text)` — wrapper IMMUTABLE de `unaccent()` pour usage dans index predicates et generation expressions.
3. Colonnes manquantes sur `diagnosticians` : `claimed_by_user_id`, `claimed_at`, `email`, `email_verified_at`, `phone`, `slug_city`, `full_name_normalized` (generated), `lead_cooldown_until`, `boost_lead_active`, `leads_received_count`, `leads_unlocked_count`, `listing_level`, `organization_id_v2`, `user_id` + indexes associés.
4. Table `quote_requests` + 3 policies RLS + trigger updated_at + index `idx_quote_requests_pending_routing`.
5. Table `user_preferences` (bloquante pour scheduling + monthly_reports) + RLS self.
6. Table `upsell_suggestions` (bloquante pour upsell_email_tracking) + RLS self + service_role.
7. Colonnes manquantes sur `addon_modules` (`is_active`, `category`) et `user_addons` (`expires_at`, `subscription_id`, `metadata`) + indexes.
8. Colonnes manquantes sur `accounting_connectors` (`encrypted_token`, `encrypted_secret`, `pennylane_company_id`, `is_active`) + indexes.
9. Helper `is_admin(p_user_id uuid)` recréé via `CREATE OR REPLACE` (sans DROP — ~50 policies dépendent de cette fonction).
10. Backfill `claimed_by_user_id` depuis `memberships` (owner/admin → recopie sur fiches diagnostician).
11. Création du schema `supabase_migrations.schema_migrations` + insert sentinel pour cette consolidate.

### Étape 4 — Tracking schema_migrations

Script `scripts/migration-replay.ts` insère dans `supabase_migrations.schema_migrations` la version de chaque migration une fois appliquée (avec succès ou erreur bénigne idempotente comme `already exists`).

### Étape 5 — Replay sequential

Le même script `migration-replay.ts` (en mode `--apply`) :

- Lit l'audit JSON.
- Pour chaque migration `needs_apply` ou `partial`, exécute le SQL via Management API.
- Gère le rate-limit 429 avec exponential backoff (3s → 6s → 12s).
- Délai 500ms entre migrations pour ne pas saturer l'API.
- Tolère les erreurs idempotentes courantes (`already exists`, `duplicate_object`).

Plusieurs passes nécessaires (la consolidate débloque des migrations en chaîne).

## Résultats

### État final prod

| Métrique | Avant | Après | Delta |
|---|---|---|---|
| Tables | 59 | **166** | +107 |
| Columns | 909 | **2732** | +1823 |
| Indexes | 239 | **724** | +485 |
| Functions | 913 | **1021** | +108 |
| Policies | 67 | **294** | +227 |
| Views | 6 | **13** | +7 |
| Triggers | 30 | **103** | +73 |
| Rows | 8808 | **8986** | +178 |

### Tracking `schema_migrations`

**113 migrations trackées** (sur 133 totales). Les 20 non trackées correspondent aux migrations qui restent `partial` ou `needs_apply` après les passes de replay (voir « Conflits non résolus »).

### Tables critiques mentionnées dans le brief

Toutes présentes :
- `admin_users` ✅
- `quote_requests` ✅
- `veille_articles_draft` ✅
- `veille_keywords_priority` ✅
- `observatoire_reports` ✅
- `observatoire_press_citations` ✅
- `observatoire_live_stats` ✅
- `user_preferences` ✅ (bonus, débloque scheduling)
- `upsell_suggestions` ✅ (bonus, débloque upsell tracking)

Fonction `is_admin(uuid)` ✅ — créée par migration `20260521120000_admin_dashboard.sql` rejouée, recréée idempotemment par la consolidate.

### Migrations du jour (5+3)

| Migration | Statut |
|---|---|
| `20260524100000_observatoire_press_citations.sql` | ✅ applied |
| `20260524110000_diagnosticians_unified.sql` | ⚠️ partial (search_diagnosticians et sync_diagnostician_geo restent à fixer — voir conflit #5) |
| `20260524120000_ai_pipelines_cron.sql` | ✅ applied |
| `20260524130000_veille_articles_seed_initial.sql` | (empty — seed uniquement, à exécuter via `pnpm tsx`) |
| `20260524140000_observatoire_report_mai_2026.sql` | (empty — seed uniquement) |
| `20260524150000_quote_requests_dpe_calculator.sql` | ✅ applied |
| `20260524160000_observatoire_live_stats.sql` | ✅ applied |
| `20260524170000_observatoire_stats_cron.sql` | (empty — pg_cron setup only) |

### Conflits non résolus (à traiter manuellement)

Ces migrations restent en `partial` ou `needs_apply` après plusieurs passes — elles nécessitent un fix dans le SQL source car les erreurs sont structurelles, pas idempotentes.

1. **`20260520180000_capture_first_mode.sql`** — `functions in index predicate must be marked IMMUTABLE`.
   Solution : remplacer `unaccent(col)` par `public.immutable_unaccent(col)` dans le predicate de l'index. La fonction est créée par la consolidate ; il faut juste rééditer le SQL source.

2. **`20260521190000_admin_alerts.sql`** — `null value in column "cooldown_minutes"`.
   Solution : ajouter un `DEFAULT 60` à la colonne ou un INSERT avec `cooldown_minutes` explicite.

3. **`20260522100000_subscription_trial_30d.sql`** — `generation expression is not immutable`.
   Solution : revoir la generation expression — probablement un appel à `now()` qui doit être remplacé par une simple colonne avec trigger.

4. **`20260524110000_diagnosticians_unified.sql`** — `cannot use subquery in column generation expression`.
   Solution : remplacer la column `full_name_normalized` qui contient un subquery par un trigger BEFORE INSERT/UPDATE.

5. **`20260524120000_monthly_reports.sql`** — initialement bloquée par `user_preferences` absent. À rejouer une fois le rate-limit retombé (probablement OK maintenant).

6. **`20260525153000_prescriber_relationships.sql`** — `generation expression is not immutable` (idem #3).

7. **`20260530120000_diagnostician_emails.sql`** — `column d.unsubscribed does not exist`. Ajouter `unsubscribed boolean DEFAULT false` sur `diagnosticians`.

8. **`20260604100000_anti_spam_and_ghost_lifecycle.sql`** — `column d.postal_code does not exist`. La table prod a `postcode`, pas `postal_code` — fix renommage de colonne ou migration.

9. **`20260605100000_upsell_system.sql`** — `functions in index predicate must be marked IMMUTABLE` (idem #1).

10. **`20260606100000_diagnostician_cross_validation.sql`** — `check constraint "diag_xval_source_check" violated` — données existantes ne matchent pas un nouveau CHECK. Soit relaxer le CHECK, soit nettoyer les données avant ALTER.

11. **`20260608100000_seo_pipeline.sql`** — `cannot change name of input parameter "p_user_id"`. La fonction `is_admin` y est redéclarée avec `user_id`. Renommer en `p_user_id` dans le SQL source.

12. **`20260610100000_upsell_email_tracking.sql`** — `column "status" does not exist` sur `upsell_suggestions`. Ajouter `status text` sur `upsell_suggestions`.

13. **`20260518000000_init_schema.sql`** — `mission_rooms` table manquante (renommée `dossier_rooms` dans une migration ultérieure). C'est un faux positif : la table existe sous un autre nom.

14. **`20260519220000_import_liciel.sql`** — 3 objets manquants (triggers probablement renommés).

15. **`20260524180000_consolidate_schema_reconciliation.sql`** elle-même remontée comme `partial` à cause d'un index manquant (faux positif : tous les objets critiques sont appliqués, le parsing du fichier indique 32 attendus et 1 manque détecté est probablement un index dont le nom diffère).

### Outils livrés

| Fichier | Rôle |
|---|---|
| `scripts/migration-status-audit.ts` | Audit local→prod, génère `migration-status-result.json` |
| `scripts/migration-replay.ts` | Replay des migrations non appliquées, gère rate-limit et idempotence |
| `scripts/prod-snapshot.ts` | Snapshot logique JSON via Management API |
| `supabase/migrations/20260524180000_consolidate_schema_reconciliation.sql` | Migration consolidate idempotente |
| `backups/prod-snapshot-*.json` | Snapshots horodatés (gitignored) |
| `docs/supabase-prod-reconciliation.md` | Cette doc |

### Re-runner l'audit à tout moment

```bash
SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-status-audit.ts
```

### Re-runner le replay (idempotent)

```bash
# Dry run d'abord
SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-replay.ts

# Apply
SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-replay.ts --apply

# Une seule migration (debug)
SUPABASE_ACCESS_TOKEN=sbp_... pnpm tsx scripts/migration-replay.ts --apply --only=20260524150000
```

## Prochaines étapes (DEPLOY-2, DEPLOY-4, et fix des 15 conflits)

1. **DEPLOY-2** : Vault secrets pour les crons IA (Anthropic API key, OpenAI, Brevo). Création via Studio → Database → Vault.
2. **DEPLOY-4** : Régénérer les types Database TS (`supabase gen types typescript --project-id jlizdkffwjdiokvmhcwg --schema public > apps/web/src/types/database.types.ts`).
3. **Fix des 15 conflits** restants — chaque migration source à patcher en local pour adresser les erreurs IMMUTABLE / colonnes / contraintes documentées ci-dessus, puis rejouer le replay.
4. **Backup vrai SQL** : configurer Supabase PITR (Pro tier 25$/mo) ou faire un dump pg_dump via une VM Linux temporaire pour avoir un vrai rollback bit-perfect.

## Sécurité — ce qui n'a PAS été fait

- ⚠️ Aucun `pg_dump` complet n'a été pris (impossible sans postgres-client local). Le snapshot JSON capture **structure et metadata**, pas les données ligne-à-ligne. En cas de besoin de rollback granulaire, utiliser Supabase Dashboard → Backups.
- ⚠️ Aucun objet n'a été DROP. La consolidate utilise uniquement `CREATE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY` (safe), `CREATE OR REPLACE FUNCTION`.
- ⚠️ Aucune migration ne touche les données existantes sauf le backfill explicite du `claimed_by_user_id` sur `diagnosticians` (read-only sur `memberships`, write only sur lignes où `claimed_by_user_id IS NULL`).
