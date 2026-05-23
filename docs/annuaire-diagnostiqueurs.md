# Annuaire diagnostiqueurs — Méthode de croisement données

> **Statut** : V1 — schéma unifié post-FIX-D (migration `20260524110000_diagnosticians_unified.sql`)
> **Dernière mise à jour** : 2026-05-24

## 1. Vue d'ensemble

L'annuaire public KOVAS (`/diagnostiqueurs`) référence **~13 000 diagnostiqueurs
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
Ministère du Logement.
**Licence** : Etalab 2.0 (réutilisation autorisée, attribution requise).
**URL** : https://www.data.gouv.fr/fr/datasets/annuaire-des-diagnostiqueurs-immobiliers-certifies/
**Mise à jour officielle** : irrégulière (déclaratif organismes certificateurs).

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
| `full_name` | text | DHUP / manuel | "Prénom Nom" |
| `full_name_normalized` | text GENERATED | dérivé | lower(unaccent) pour ILIKE/trigram |
| `first_name`, `last_name` | text | DHUP | NULLABLE (compat bandit) |
| `city`, `city_slug`, `postcode` | text | DHUP + BAN | |
| `dept_code`, `department_code` | text | DHUP | **sync via trigger** |
| `address` | text | DHUP | |
| `latitude`, `longitude` | double precision | BAN | **sync avec geo_lat/geo_lng** |
| `certifications` | jsonb | DHUP | `[{type, organism, number, valid_until, status}]` |
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
- `/diagnostiqueurs` (page Next.js Server Component)
- `/diagnostiqueurs/[dept]/[city]` (à venir FIX-H — pages SEO city)

## 6. Page admin

**URL** : `/admin/diagnostiqueurs/import`
**Code** : `apps/web/src/app/admin/(gated)/diagnostiqueurs/import/page.tsx`
**Auth** : `requireAdmin()` (allowlist email `ADMIN_EMAILS`)

**Affiche** :
- Total fiches en DB (toutes, publiées, avec SIRET, géolocalisées)
- Date du dernier import DHUP réussi
- Bouton "Lancer l'import DHUP" → appel `POST /api/admin/diagnosticians/run-dhup-import`
- Détail des stats post-import : imported / updated / ceased / errors / durée

## 7. Seed démo `diagnosticians-fixtures.sql`

En attendant la première cron DHUP en production, le seed
`supabase/seed/diagnosticians-fixtures.sql` permet d'avoir **50 fiches démo**
réparties sur 10 villes (Paris, Lyon, Marseille, Toulouse, Bordeaux, Nice,
Nantes, Strasbourg, Lille, Dieppe).

Toutes les fiches sont préfixées `dhup_source_id='fix_%'` — facile à purger
quand la vraie cron tournera :

```sql
DELETE FROM diagnosticians WHERE dhup_source_id LIKE 'fix_%';
```

**Application en local** :
```bash
supabase db reset --linked  # ou
psql "$DATABASE_URL" -f supabase/seed/diagnosticians-fixtures.sql
```

## 8. Roadmap V2

- [ ] Source 4 PagesJaunes worker Railway (vérif adresse opérationnelle)
- [ ] Bandit Thompson sampling pour ranking dans pages city (déjà migration #149)
- [ ] Cache 5 min CDN sur `/api/diagnosticians/search` (déjà câblé)
- [ ] Régénération types Database (`pnpm gen:types`) → suppression des `as any`
- [ ] Génération automatique des slugs lors de l'import (helper RPC
      `generate_unique_diag_slug` existe déjà côté DB)
