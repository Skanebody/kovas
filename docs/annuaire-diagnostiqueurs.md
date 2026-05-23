# Annuaire diagnostiqueurs — Méthode de croisement données

> **Statut** : V1 — schéma unifié post-FIX-D + pipeline `verify-diagnosticians-daily` (FIX-BB) + **import DHUP officiel réel** (FIX-OO, 2026-05-23)
> **Dernière mise à jour** : 2026-05-23 (FIX-OO — 13 856 vrais diagnostiqueurs importés)

## 1. Vue d'ensemble

L'annuaire public KOVAS (`/trouver-un-diagnostiqueur`) référence **~13 000 diagnostiqueurs
immobiliers FR certifiés**. La table `diagnosticians` est alimentée par **4 sources
croisées** + dédupliquées + validées en continu.

Aucune source seule ne suffit : DHUP donne la vérité réglementaire des certifications,
Sirene confirme l'activité juridique, GMB enrichit la réputation, PagesJaunes valide
l'adresse opérationnelle.

```
       ┌──────────────────┐
       │  data.gouv.fr    │  ← Source de vérité certifications (DHUP)
       │     (DHUP)       │
       └────────┬─────────┘
                │ Edge Function : absorb-dhup-directory
                │ (cron weekly mon 03:00 UTC)
                ▼
       ┌──────────────────┐    ┌──────────────────────┐
       │  diagnosticians  │ ◄──┤  Sirene (API INSEE)  │ enrich SIRET + state
       │     (Supabase)   │    └──────────────────────┘
       └────────┬─────────┘
                │
                ├── Google My Business → gmb_rating, gmb_review_count, place_id
                │
                ├── PagesJaunes (V2)   → vérification adresse cabinet
                │
                └── BAN (gouv)         → géocodage adresse → lat/lng
```

## 2. Sources de données

### Source 1 — DHUP (data.gouv.fr) — Vérité certifications

**Dataset** : *Annuaire des diagnostiqueurs immobiliers certifiés*
**Producteur** : DHUP (Direction de l'Habitat, de l'Urbanisme et des Paysages),
Ministère du Logement (page produit : Ministère de la Cohésion des territoires).
**Licence** : Etalab 2.0 (réutilisation autorisée, attribution requise).
**Page dataset** : https://www.data.gouv.fr/fr/datasets/annuaire-des-diagnostiqueurs-immobiliers/
**URL CSV stable** (configurée dans `DHUP_DATASET_RESOURCE_URL`) :
`https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36`
**Annuaire web officiel** : https://diagnostiqueurs.din.developpement-durable.gouv.fr/
**Format** : CSV `;` séparateur, UTF-8, 16-17 MB, ~74k lignes (= ~5 certifs × ~13k diagnostiqueurs)
**Colonnes (en-tête réelle 2026-05-22)** :
`Nom;Prenom;Societe;Adresse;CP;Ville;Tel1;Tel2;email;Organisme;Org Cofrac;Type de certificat;N° de certificat;Date début validité;Date fin validité`
**Mise à jour officielle** : déclarative organismes certificateurs (mensuelle environ).
**Premier import réel** : **2026-05-23** — 13 856 diagnostiqueurs uniques importés
(97 départements couverts, Paris 443, Rhône 421, Bouches-du-Rhône 540).

**Pipeline d'import** :
- Edge Function `supabase/functions/absorb-dhup-directory/index.ts`
- Trigger cron : `.github/workflows/cron-dhup-weekly.yml` (lundi 03:00 UTC)
- Trigger manuel : `POST /api/admin/diagnosticians/run-dhup-import` (page admin
  `/admin/diagnostiqueurs/import`)
- UPSERT idempotent par `dhup_source_id` (cf. section 3 anti-doublon)
- Marque les fiches DISPARUES en `validation_status='pending'` (ghost lifecycle)
  → ne casse pas les URLs publiques mais signale une vérif manuelle

**Champs alimentés depuis DHUP** :
- `first_name`, `last_name`, `full_name` (concat triggered)
- `city`, `postcode`, `dept_code`, `department_code` (sync triggered)
- `certifications` JSONB : `[{ type, organism, number, valid_until, status }]`
- `official_email`, `official_phone`, `official_company_name`
- `sirene_siret` (si présent dans DHUP — environ 60% des lignes)
- `dhup_source_id` (hash SHA-256 anti-doublon)

### Source 2 — Sirene (API INSEE) — Validation activité juridique

**API** : https://api.insee.fr/entreprises/sirene/V3
**Usage** : confirme que le SIRET est ACTIF (entreprise en activité juridique).
**Edge Function** : `supabase/functions/cross-validate-sirene/`
**Fréquence** : batch mensuel post-import DHUP.

**Champs alimentés** :
- `sirene_state` ∈ `{active, ceased, unknown}` → drive `sirene_active` (GENERATED)
- `sirene_denomination`, `sirene_legal_form`, `sirene_capital_eur`
- `sirene_creation_date`, `sirene_employee_range`
- `sirene_last_synced_at`

**Impact RLS** : une fiche avec `sirene_state='ceased'` est **automatiquement masquée**
du public (cf. policy `diag_public_read_unified` : `coalesce(sirene_active, true) = true`).

### Source 3 — Google My Business API — Enrichissement réputation

**API** : Google Places API (`Place Details` endpoint)
**Usage** : récupérer rating, review_count et lien Maps.
**Coût** : ~0,017 $/lookup (free tier 28 500/mois sur Google Cloud).
**Edge Function** : `supabase/functions/cross-validate-gmb/` (à créer V2 si pas encore là).

**Champs alimentés** :
- `gmb_place_id` (clé stable pour deep-link Google Maps)
- `gmb_rating` (1 à 5, float)
- `gmb_review_count` (int)

**Stratégie** : on ne tire que les fiches **claimed** (économies coût API + RGPD :
l'utilisateur a opté-in à la visibilité publique).

### Source 4 — PagesJaunes (V2, planifié) — Vérification adresse cabinet

**Source** : scraping légal PagesJaunes (CGU article 7 autorise crawl à but informatif).
**Usage** : confirmer que l'adresse postale du cabinet est OPÉRATIONNELLE (présence
d'une fiche professionnelle active).

À implémenter en V2 avec un worker Railway dédié (rate-limit strict : 1 req/3s).

### Source 5 — BAN (api-adresse.data.gouv.fr) — Géocodage

**API** : https://api-adresse.data.gouv.fr/search/
**Usage** : transformer `address + postcode` DHUP en `latitude` + `longitude`.
**Coût** : gratuit, ~50 req/s/IP, sans clé.
**Wrapper** : `apps/web/src/lib/ban.ts`

**Champs alimentés** :
- `latitude`, `longitude` (canoniques)
- `geo_lat`, `geo_lng` (legacy, sync triggered)
- `ban_accuracy`, `ban_label` (audit qualité géocodage)

## 3. Anti-doublon — `dhup_source_id`

Chaque fiche DHUP est dédupliquée par un hash stable :

```
dhup_source_id = SHA-256(siret || '|' || nom || '+' || prenom || '|' || dept_code)
```

**Avantages** :
- Stable entre runs (même hash = même personne)
- Ne dépend pas du libellé de ville (Saint-Étienne vs Saint Etienne ne casse pas le hash)
- Inclut le département → distingue 2 homonymes dans 2 départements différents
- Si SIRET absent (cas DHUP partiel), fallback sur nom+prenom+dept

**Contrainte SQL** : `UNIQUE (dhup_source_id) DEFERRABLE INITIALLY IMMEDIATE` →
permet UPSERT atomique en batch.

## 4. Schéma canonique post-FIX-D

La migration `20260524110000_diagnosticians_unified.sql` harmonise les noms de
colonnes entre les 3 schémas historiques concurrents (bandit / A1 / freemium).

| Colonne canonique | Type | Source | Notes |
|---|---|---|---|
| `id` | uuid PK | — | gen_random_uuid() |
| `slug` | text UNIQUE | DHUP normalisé | URL publique |
| `full_name` | text | DHUP / manuel | "Prénom Nom" (gérant) |
| `full_name_normalized` | text GENERATED | dérivé | lower(unaccent) pour ILIKE/trigram |
| `first_name`, `last_name` | text | DHUP | NULLABLE (compat bandit) |
| `company_name` | text | DHUP "Societe" | **FIX-RR** — raison sociale cabinet ("Cabinet Diag Pro 75 SARL"). Préféré à `full_name` en affichage public ; NULL pour les indépendants en nom propre (EI/EURL). |
| `city`, `city_slug`, `postcode` | text | DHUP + BAN | |
| `dept_code`, `department_code` | text | DHUP | **sync via trigger** |
| `address` | text | DHUP | |
| `latitude`, `longitude` | double precision | BAN | **sync avec geo_lat/geo_lng** |
| `certifications` | jsonb | DHUP | `[{type, organism, number, valid_until, status}]`. **FIX-RR** : types canoniques = `DPE`, `DPE_MENTION` (audit énergétique avec mention, premium), `AMIANTE`, `PLOMB`, `GAZ`, `ELECTRICITE`, `TERMITES`, `CARREZ`, `ERP`. |
| `certif_valid_count` | int GENERATED | dérivé | nb de certifs `status='valid'` |
| `sirene_siret` | text | Sirene | E.164 |
| `sirene_state` | text | Sirene | active / ceased / unknown |
| `sirene_active` | bool GENERATED | dérivé | true si `state IN (active, unknown)` |
| `gmb_place_id`, `gmb_rating`, `gmb_review_count` | — | GMB | |
| `claim_status` | text | KOVAS | unclaimed / pending / claimed / rejected |
| `claimed_by`, `claimed_by_user_id` | uuid → auth.users | KOVAS | **les 2 sync** |
| `activity_score` | double precision | KOVAS algo | combo ADEME DPE count + Sirene + GMB |
| `fraud_flags` | jsonb | KOVAS algo | `[{type, severity, detected_at}]` |
| `is_published`, `withdrawal_requested` | bool | KOVAS | RGPD opt-out |
| `dhup_source_id` | text UNIQUE | DHUP | hash anti-doublon |
| `dhup_imported_at`, `dhup_last_synced_at` | timestamptz | cron | audit |

## 5. RPC unifiée `search_diagnosticians`

Toute recherche annuaire passe par cette fonction PostgreSQL (cf. migration).

**Signature** :
```sql
search_diagnosticians(
  p_query     text,            -- recherche libre nom/ville (ILIKE + unaccent)
  p_city_slug text,            -- slug ville (paris, lyon-69003, …)
  p_dept_code text,            -- code département
  p_certs     text[],          -- types certif (DPE, AMIANTE, …)
  p_lat       double precision,-- avec lng + radius → filtre rayon
  p_lng       double precision,
  p_radius_km double precision,-- défaut 30 km
  p_limit     integer,         -- défaut 24
  p_offset    integer
) RETURNS TABLE (...)
```

**Sécurité** : `SECURITY INVOKER` → respecte RLS (anon ne voit que les fiches
publiées + non retirées + Sirene active + ≥1 certif valide).

**Index utilisés** :
- `idx_diag_dept_city_unified` pour le filtre dept+ville
- `idx_diag_full_name_norm_trgm` (GIN trigram) pour la recherche libre
- `idx_diag_certifications_gin` pour le filtre par type certif
- `idx_diag_earth_unified` (GIST) pour le rayon km

**Routes consommatrices** :
- `GET /api/diagnosticians/search` — JSON public
- `/trouver-un-diagnostiqueur` (page Next.js Server Component)
- `/trouver-un-diagnostiqueur/[dept]/[city]` (à venir FIX-H — pages SEO city)

## 6. Page admin

**URL** : `/admin/diagnostiqueurs/import`
**Code** : `apps/web/src/app/admin/(gated)/trouver-un-diagnostiqueur/import/page.tsx`
**Auth** : `requireAdmin()` (allowlist email `ADMIN_EMAILS`)

**Affiche** :
- Total fiches en DB (toutes, publiées, avec SIRET, géolocalisées)
- Date du dernier import DHUP réussi
- Bouton "Lancer l'import DHUP" → appel `POST /api/admin/diagnosticians/run-dhup-import`
- Détail des stats post-import : imported / updated / ceased / errors / durée

## 7. Import bulk via script Node — `scripts/import-dhup-real.ts`

**Statut historique** : les 50 fixtures démo `dhup_source_id='fix_*'` ont été **purgées en
prod le 2026-05-23** suite à l'import DHUP officiel réussi. Le script qui les
créait (`supabase/seed/diagnosticians-fixtures.sql`) reste disponible pour les
environnements de développement local.

**Pipeline de prod** : import bulk PostgREST via `scripts/import-dhup-real.ts`.

Pourquoi pas l'Edge Function `absorb-dhup-directory` pour le premier import ?
- 13 856 diagnostiqueurs × 3-4 round-trips DB (lookup + RPC slug + insert/update + cert
  upsert) = ~55 000 requêtes série → > 60 s timeout Edge Function.
- Le script Node local groupe les INSERT en chunks de 500 via `POST /rest/v1/diagnosticians`
  avec `Prefer: return=minimal` → **import complet en < 10 s** sur connexion résidentielle.
- Limite PostgREST : la contrainte `UNIQUE (dhup_source_id) DEFERRABLE INITIALLY IMMEDIATE`
  empêche `ON CONFLICT (dhup_source_id) DO UPDATE` (erreur 55000). Pour ré-import
  idempotent, le script **prefetch** d'abord les `dhup_source_id` existants puis **skip** les
  doublons. Pour les MAJ futures, il faudra soit basculer la contrainte en `NOT DEFERRABLE`,
  soit refactorer la voie batch UPDATE (cf. §11 Roadmap).

### Usage

```bash
# Configurer le secret Supabase Edge Functions (1 fois, pour le cron mensuel) :
curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"name":"DHUP_DATASET_RESOURCE_URL","value":"https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36"}]'

# Lancer l'import en prod (purge fixtures + import + skip doublons) :
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx \
  node --experimental-strip-types scripts/import-dhup-real.ts
```

### Variables d'env supportées par le script

| Variable | Défaut | Description |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | (requis) | Clé service_role (PostgREST bypass RLS) |
| `SUPABASE_PROJECT_REF` | `jlizdkffwjdiokvmhcwg` | Project ref |
| `DHUP_DATASET_RESOURCE_URL` | URL data.gouv.fr | Source CSV |
| `DHUP_CSV_LOCAL_PATH` | (non set) | Bypass download — lit un fichier local |
| `DRY_RUN` | `0` | Parse + log sans écrire en DB |
| `PURGE_FIXTURES` | `1` | Supprime `fix_*` au début (avant import) |
| `CHUNK_SIZE` | `500` | Taille des batches INSERT |

### Sortie attendue

```
[parse] 74292 lignes, 13856 diagnostiqueurs uniques, 0 lignes skip.
[purge] 50 fixtures supprimees.
[prefetch] 0 dhup_source_id deja en base — seront skip.
[insert] chunk 28/28: OK (+356) 134ms
[KOVAS] Import termine en 8.9s
  diagnostiqueurs traites : 13,856
  echecs                  : 0
  fixtures purgees        : 50
```

### Post-import : flip `is_published`

Le script importe avec `is_published=false` par défaut (cf. migration schema).
Pour activer la visibilité publique des fiches DHUP officielles :

```sql
UPDATE diagnosticians
SET is_published = true,
    validation_status = 'verified'
WHERE dhup_source_id LIKE 'dhup_%'
  AND withdrawal_requested = false;
```

Cette opération est faite côté admin une fois par mois post-import. Justification :
les fiches DHUP **sont** certifiées par l'État FR, leur publication par défaut est
conforme RGPD (Etalab 2.0 + données déjà publiques sur diagnostiqueurs.din.developpement-durable.gouv.fr).

## 8. Pipeline `verify-diagnosticians-daily` (FIX-BB)

### Objectif

Chaque diagnostiqueur est **revérifié quotidiennement** en croisant 3 sources externes
+ recalcul d'un `activity_score` ∈ [0, 1]. Sous le seuil `0.5`, la fiche est
**masquée du public** (RLS) et signalée dans `fraud_flags`.

### Algorithme de score

```
score = (dhup_active     ? 0.40 : 0)   # DHUP sync < 60 jours
      + (sirene_active   ? 0.30 : 0)   # SIRET état='A' (ou bénéfice du doute si Sirene skipped)
      + (gmb_rating > 0  ? 0.20 : 0)   # Google My Business présent
      + (has_valid_cert  ? 0.10 : 0)   # ≥ 1 certif non expirée

Si score < 0.5  → fraud_flags non vide + visibilité publique = false
```

### Edge Function : `supabase/functions/verify-diagnosticians-daily/`

**Trigger** :
1. `pg_cron` quotidien `kovas-verify-diagnosticians-daily` (03:00 UTC)
2. Manuel via `/admin/diagnostiqueurs/audit` → bouton "Lancer vérif manuelle"
3. Manuel via `POST /api/admin/diagnosticians/run-verify-daily`

**Batch** : 500 diagnostiqueurs par run, ordre LRU `activity_score_computed_at`.
Couverture : 13k / 500 = **~26 jours** pour parcourir tout l'annuaire.

**Graceful degradation** : si `INSEE_CLIENT_ID` ou `GOOGLE_PLACES_API_KEY` absent,
la fonction skip cette source sans erreur (log warning + champ `notes` dans réponse).

### Fraud signals détectés

| Type | Sévérité | Trigger |
|---|---|---|
| `dhup_absent` | high | Hash DHUP absent du dernier import (> 60 jours) |
| `sirene_inactive` | high | SIRET radié ou inconnu côté INSEE |
| `no_valid_certification` | medium | Aucune certif non expirée |

### Cron pg_cron

Migration : `supabase/migrations/20260524190000_verify_diagnosticians_daily_cron.sql`

```sql
SELECT cron.schedule(
  'kovas-verify-diagnosticians-daily',
  '0 3 * * *',
  $$
  SELECT public.invoke_edge_function(
    'verify-diagnosticians-daily',
    jsonb_build_object('mode', 'batch', 'limit', 500)
  );
  $$
);
```

Pour doubler la fréquence : modifier `limit` à 1000 OU ajouter un second job à 04:00 UTC.

## 9. Page admin `/admin/diagnostiqueurs/audit`

**URL** : `/admin/diagnostiqueurs/audit`
**Code** : `apps/web/src/app/admin/(gated)/diagnostiqueurs/audit/page.tsx`

Tableau de bord :
- Métriques globales (total, vérifiés, en attente, suspendus, radiés, flaggés)
- Stats dernière exécution cron (timestamp, statut, logs 24h, fraud_flags 24h)
- Top 10 départements (total / vérifiés / sous seuil)
- Liste des 50 diagnostiqueurs les plus flaggés (`activity_score < 0.5`)
- Bouton "Lancer vérif manuelle" avec choix taille batch (50-2000)

### Vues SQL alimentant la page

| Vue | Description |
|---|---|
| `diagnosticians_verify_health` | KPIs globaux (counts, score moyen, dernière cron) |
| `diagnosticians_top_departments` | Top 20 dept par volume |

Les deux vues sont créées avec `WITH (security_invoker = on)` + `GRANT SELECT TO service_role`.

## 10. Variables d'environnement requises

### Vercel (Next.js)

| Variable | Source | Usage |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API | Frontend + routes API admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API | Routes API admin → Edge Functions |
| `ADMIN_EMAILS` | KOVAS config | Liste séparée par virgules des emails admin |

### Supabase Edge Functions (Dashboard → Functions → Secrets)

| Variable | Optionnelle ? | Description |
|---|---|---|
| `SUPABASE_URL` | non (auto) | URL projet |
| `SUPABASE_SERVICE_ROLE_KEY` | non (auto) | Auth interne |
| `DHUP_DATASET_RESOURCE_URL` | **requis pour absorb-dhup-directory** | URL stable du CSV data.gouv.fr |
| `INSEE_CLIENT_ID` | optionnelle | Identifiant OAuth2 INSEE Sirene |
| `INSEE_CLIENT_SECRET` | optionnelle | Secret OAuth2 INSEE Sirene |
| `GOOGLE_PLACES_API_KEY` | optionnelle | Clé API Google Places (Maps Platform) |
| `INSEE_THROTTLE_MS` | défaut 1500 | Pause inter-requêtes INSEE |
| `GMB_THROTTLE_MS` | défaut 200 | Pause inter-requêtes Google Places |
| `DHUP_FRESHNESS_DAYS` | défaut 60 | Seuil au-delà duquel `dhup_active=false` |
| `CRON_SECRET` | optionnelle | Auth alternative pour pg_cron (header `x-cron-secret`) |

### Supabase Vault (extension `supabase_vault`)

Pour que pg_cron puisse invoquer les Edge Functions via `public.invoke_edge_function` :

```sql
SELECT vault.create_secret('https://jlizdkffwjdiokvmhcwg.supabase.co', 'project_url',
  'URL du projet Supabase pour invocations cron');
SELECT vault.create_secret('<service_role_jwt>', 'service_role_token',
  'Service role JWT pour cron internes');
```

Voir `docs/SUPABASE-MANUAL-FIXES.md` pour la procédure complète.

## 11. Plan de bascule fixtures → DHUP réel

**Statut au 2026-05-23 (FIX-OO)** : bascule **terminée**. 50 fixtures purgées,
13 856 vrais diagnostiqueurs DHUP officiels importés et publiés.

Étapes historiques (à reproduire pour les MAJ mensuelles ou pour un autre environnement) :

1. **Configurer `DHUP_DATASET_RESOURCE_URL`** dans Supabase Functions Secrets
   (URL canonique : `https://www.data.gouv.fr/api/1/datasets/r/7987214d-949e-4245-b005-5cc4e7a5df36`).
2. **(Optionnel)** Configurer `INSEE_CLIENT_ID` / `INSEE_CLIENT_SECRET` (Sirene)
   et `GOOGLE_PLACES_API_KEY` (GMB) pour cross-validation enrichie. Sans ces variables,
   `verify-diagnosticians-daily` skip ces sources avec un warning (graceful degradation).
3. **Lancer la première run** via le script Node bulk : voir §7.
4. **Le script purge automatiquement** les `fix_*` AVANT d'importer.
5. **Flipper `is_published=true`** sur les fiches DHUP via SQL (voir §7 ci-dessus).
6. **Vérifier** : `curl /rest/v1/rpc/search_diagnosticians` avec `p_city_slug='paris'`
   doit retourner ≥ 10 fiches Paris.
7. **Lancer manuellement** `verify-diagnosticians-daily` mode=batch limit=500
   pour seed les `activity_score` initiaux.
8. **Laisser tourner le cron** quotidien (`kovas-verify-diagnosticians-daily`) pendant
   ~26 jours pour une rotation complète des 13 856 fiches.

### Limites V1 (à enrichir progressivement)

- `INSEE_CLIENT_ID/SECRET` **non configurés** côté Supabase Secrets prod (validé via
  réponse `verify-diagnosticians-daily` : `"sireneSkipped":50, "notes":["INSEE_CLIENT_ID
  absent — Sirene cross-validation skipped (graceful)"]`).
  **Conséquence** : tous les `sirene_state` restent `null`, le composant Sirene du score
  bénéficie du **bénéfice du doute** (+0.3 dans `computeScore`). À configurer dès création
  d'un compte INSEE Sirene API ([Inscription](https://api.insee.fr/catalogue/)).
- `GOOGLE_PLACES_API_KEY` **non configuré**. `gmb_*` colonnes restent NULL, perte du
  composant réputation (-0.2 max). À configurer pour enrichir 13k fiches × ~0,017 $ = ~221 $.
- `SIRET` **absent du dataset DHUP officiel** (~0 % avec SIRET). Le hash `dhup_source_id`
  utilise le fallback `name:nom|prenom|dept` → stable mais sensible aux changements de nom
  (mariage, etc.). À enrichir via cross-validate Sirene par recherche nom + ville.
- L'Edge Function `absorb-dhup-directory` reste **fonctionnellement correcte** mais
  son temps d'exécution dépasse le budget timeout (60-150 s) pour 13k+ UPSERTs. **À
  refactorer** en mode pagination/chunked (cf. §13 Roadmap).

## 12. Comment ajouter une nouvelle source de croisement

Pour ajouter une 4e source (ex : PagesJaunes V2) dans `verify-diagnosticians-daily` :

1. Créer un module helper `checkXxx(diag)` retournant `{ value, skipped }`
   - Lire l'env var via `Deno.env.get('XXX_API_KEY')` ; si absent → `skipped: true`
2. Ajouter le call dans `processOne()` avec throttle adapté
3. Ajuster la formule `computeScore()` (rebalance les pondérations à 1.0 total)
4. Ajouter un signal `fraud_flag` dédié si nécessaire
5. Logger côté `diagnostician_cross_validation_logs` (source = 'XXX')
6. Documenter ici + dans le commentaire d'en-tête de l'Edge Function

## 13. Monitoring qualité

| Métrique | Cible saine | Alerte si... |
|---|---|---|
| `avg_activity_score` | > 0.7 | < 0.5 (signal incident massif) |
| `total_fraud_flagged / total` | < 5 % | > 15 % (revue manuelle requise) |
| `overdue_30d` | < 500 | > 2000 (cron freezé ?) |
| `logs_24h` | ~500 (= batch quotidien) | 0 (cron cassé) |
| `fraud_flags_24h` | < 50 | > 200 (signal anomalie source DHUP) |

Consultable via `/admin/diagnostiqueurs/audit`.

## 13bis. FIX-RR — Raison sociale + audit énergétique avec mention (2026-05-24)

### Objectif

Afficher la **raison sociale du cabinet** (`company_name`) plutôt que le nom du
gérant (`full_name`) dans l'annuaire public. Plus professionnel,
plus reconnaissable Google par le particulier. Ajouter également un badge
premium chartreuse pour les diagnostiqueurs habilités **audit énergétique
avec mention** (DPE_MENTION) — certification spécifique au-delà du DPE simple,
obligatoire pour les audits réglementaires F/G (loi Climat & Résilience 2023).

### Investigation DHUP

Le dataset officiel `data.gouv.fr/r/7987214d-949e-4245-b005-5cc4e7a5df36`
expose les colonnes suivantes :

```
"Nom";"Prenom";"Societe";"Adresse";"CP";"Ville";"Tel1";"Tel2";"email";
"Organisme";"Org Cofrac";"Type de certificat";"N° de certificat";
"Date début validité";"Date fin validité"
```

La colonne **`Societe`** est présente sur ~60-70 % des lignes (les indépendants
en nom propre EI/EURL ne l'ont pas). Exemples observés : `sarl cotri`,
`spm diagnostic - agenda 40`, `cabinet diag pro 75`.

Les types de certificat distincts observés (avant ce patch) :
- `Performance énergétique (DPE individuel)` → `DPE`
- `Performance énergétique (DPE par immeuble, ...)` → `DPE`
- **`Audit énergétique`** → `DPE_MENTION` *(nouveau type premium FIX-RR)*
- `Amiante` / `Amiante (missions spécifiques**, ...)` → `AMIANTE`
- `Plomb` → `PLOMB`
- `Gaz` → `GAZ`
- `Electricité` → `ELECTRICITE`
- `Termites Métropole` / `Termites OM` → `TERMITES`

### Migration

[`supabase/migrations/20260524410000_diagnosticians_company_name.sql`](../supabase/migrations/20260524410000_diagnosticians_company_name.sql) :

```sql
ALTER TABLE diagnosticians ADD COLUMN IF NOT EXISTS company_name text;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1); $$;

CREATE INDEX idx_diag_company_name ON diagnosticians
  USING gin ((lower(public.immutable_unaccent(company_name))) gin_trgm_ops)
  WHERE company_name IS NOT NULL;
```

Pushed prod via Management API le 2026-05-24. Vérification :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='diagnosticians' AND column_name='company_name';
-- → company_name
```

### Edge function — `absorb-dhup-directory`

- Type union `CertificationType` étendu avec `DPE_MENTION`.
- `normalizeCertificationType()` teste **AUDIT/MENTION en priorité** sur DPE
  (ordre déterministe pour éviter qu'une cert "Audit énergétique" tombe sur
  le mapping DPE générique).
- `upsertDiagnostician()` passe désormais `company_name: row.officialCompanyName`
  dans le payload (ignoré avant ce patch).

### Backfill

[`scripts/backfill-company-name-dhup.ts`](../scripts/backfill-company-name-dhup.ts) :
- Re-télécharge le CSV DHUP.
- Reconstruit `dhup_source_id` (SHA-256 hash), match avec la base.
- Update `company_name` si NULL + injecte `DPE_MENTION` dans `certifications`
  jsonb si manquant.
- Idempotent — peut être relancé sans risque.

Usage :
```bash
SUPABASE_URL=https://jlizdkffwjdiokvmhcwg.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
pnpm tsx scripts/backfill-company-name-dhup.ts
```

### UI

Pattern d'affichage canonique côté annuaire public :

```tsx
const displayName = getDiagDisplayName(diag) // raison sociale > full_name capitalisé
const subtitleGerant = diag.company_name && formattedGerant ? formattedGerant : null

<h3>{displayName}</h3>
{subtitleGerant && <p>Représenté par {subtitleGerant}</p>}
{hasMentionAudit(diag.certifications) && (
  <Badge variant="amber">
    <Sparkles /> Audit énergétique avec mention
  </Badge>
)}
```

Helpers exposés par [`apps/web/src/lib/diag-certifications.ts`](../apps/web/src/lib/diag-certifications.ts) :
- `formatFullName()` — capitalize avec particules nobiliaires
- `getDiagDisplayName()` — raison sociale > nom du gérant capitalisé
- `hasMentionAudit()` — détecte DPE_MENTION dans 3 formats jsonb
- `DIAG_CERT_BY_CODE` — lookup type → label/description/premium

Pages touchées :
- `apps/web/src/app/trouver-un-diagnostiqueur/page.tsx` (annuaire racine — SELECT + RPC + mapping + JSON-LD ItemList)
- `apps/web/src/app/trouver-un-diagnostiqueur/diag-result-card.tsx` (card unitaire)
- `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/page.tsx` (page ville — SELECT inline + cards + JSON-LD LocalBusiness ItemList)
- `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/page.tsx` (metadata SEO + Schema.org + sanitize whitelist)
- `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/diagnostician-page-content.tsx` (hero + RelatedCard + sidebar contact)

SEO impact : Schema.org `LocalBusiness.name` et title `<h1>` utilisent la
raison sociale en priorité (cf. Google guidelines : `name` = nom commercial
public, pas nom du gérant).

## 14. Roadmap V2

- [ ] Source 4 PagesJaunes worker Railway (vérif adresse opérationnelle)
- [ ] Bandit Thompson sampling pour ranking dans pages city (déjà migration #149)
- [ ] Cache 5 min CDN sur `/api/diagnosticians/search` (déjà câblé)
- [ ] Régénération types Database (`pnpm gen:types`) → suppression des `as any`
- [ ] Génération automatique des slugs lors de l'import (helper RPC
      `generate_unique_diag_slug` existe déjà côté DB)
- [ ] RLS publique stricte : ne montrer que `activity_score >= 0.5 AND sirene_active = true`
      AND `dhup_last_synced_at >= now() - 60 days` (à activer une fois DHUP en prod)
