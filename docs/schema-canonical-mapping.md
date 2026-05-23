# Mapping canonique du schéma KOVAS

> **Date** : 2026-05-23
> **Authority** : ce document est la référence pour tous les futurs développeurs sur les noms de colonnes à utiliser dans le code applicatif.
> **Auteur** : agent AUDIT-E
> **Issu de** : FIX-AA réconciliation Supabase prod + AUDIT-A/B/C/D/E sweeps progressifs

## Principe

Plusieurs migrations historiques ont introduit des noms de colonnes différents pour la même donnée. La migration **`20260524110000_diagnosticians_unified.sql`** + **`20260524180000_consolidate_schema_reconciliation.sql`** ont réconcilié le schéma en gardant les deux noms cohabitants côté DB (ADD COLUMN IF NOT EXISTS sur les deux), mais **le code applicatif doit utiliser uniquement le nom canonique**.

## Règle générale

| Code applicatif | DB | Tactique |
|---|---|---|
| Utiliser **nom canonique** uniquement | Cohabite (legacy + canonique) | Si la table a les deux, lire le canonique uniquement ; fallback `coalesce(canonical, legacy)` autorisé si besoin migration progressive |
| Utiliser **nom canonique** uniquement | Canonique seul | Pattern normal |
| Code legacy | Legacy seul | À supprimer ; renommer en canonique |

---

## Table `diagnosticians` — annuaire public

| Colonne legacy | **Colonne canonique** | Type | Notes |
|---|---|---|---|
| `display_name` | **`full_name`** | text | Auto-build via trigger depuis first_name + last_name si null |
| `slug_full` | **`slug`** | text | URL slug `prenom-nom-cp` |
| `address_line` | **`address`** | text | Adresse normalisée BAN |
| `phone_e164` | **`phone`** ou **`official_phone`** | text | `official_phone` depuis DHUP ; `phone` post-claim |
| `rating_avg` | **`gmb_rating`** | double precision | Note Google My Business 0-5 |
| `reviews_count` | **`gmb_review_count`** | integer | Nombre d'avis GMB |
| `years_experience` | **`years_active`** | integer | Ancienneté métier (post-claim) |
| `slug_city` | **`slug_city`** | text | **Canonique (cohabite avec `city_slug`)** — URL `/trouver-un-diagnostiqueur/{slug_dept}/{slug_city}/{slug}` |
| `city_slug` | (legacy → préférer `slug_city`) | text | Ajouté par migration bandit ; utilisable mais `slug_city` est canonique |
| `dept_code` | **`department_code`** | text | Code département `'76'`, `'13'`, `'2A'`, `'971'` (cohabitent en DB) |
| `claimed_by` | **`claimed_by_user_id`** | uuid | FK `auth.users(id)` |
| `company_name` | **`official_company_name`** | text | Raison sociale depuis DHUP |
| `email_company_name` | **`official_email`** | text | Email depuis DHUP (post-claim → `email`) |
| `latitude` / `longitude` | **`geo_lat`** / **`geo_lng`** | double precision | Cohabitent en DB |

### Colonnes uniquement canoniques (jamais de legacy)

- `slug_dept` text — URL slug département
- `first_name`, `last_name` — décomposition obligatoire
- `full_name_normalized` text GENERATED — lower(unaccent(full_name))
- `certifications` jsonb — array de `{ type, organism, number, valid_until, status }`
- `sirene_siret`, `sirene_naf_code`
- `is_indexable`, `is_published`, `withdrawal_requested`, `withdrawal_requested_at`
- `claim_status` enum — `'unclaimed' | 'pending' | 'claimed' | 'rejected'`
- `listing_level` enum — `'free' | 'standard' | 'premium'`
- `photo_url`, `bio`, `pricing_indicative`, `services_offered`, `intervention_radius_km`, `availability_lead_time_days`
- `gmb_place_id`
- `dhup_source_id`, `dhup_imported_at`, `dhup_last_synced_at`
- `view_count`, `quote_request_count`
- `lead_cooldown_until`, `boost_lead_active`, `leads_received_count`, `leads_unlocked_count`
- `organization_id_v2` (FK organizations), `user_id` (FK auth.users)

---

## Table `clients` — clients diagnostiqueur (CRUD interne)

> **Pas de mapping legacy** — colonnes canoniques natives. Le `display_name` ici **EST le nom canonique** (différent du sens sur diagnosticians).

| Colonne canonique | Type | Notes |
|---|---|---|
| `display_name` | text NOT NULL | Nom d'affichage métier |
| `first_name`, `last_name` | text | Si client particulier |
| `company_name` | text | Si client morale |
| `email`, `phone` | text | Format E.164 pour phone |
| `address`, `city`, `postal_code`, `country` | text | Adresse normalisée |
| `siret` | text | |
| `qonto_customer_id`, `pennylane_customer_id`, `indy_customer_id`, `tiime_customer_id` | text | IDs syncs connecteurs |

⚠️ **Sur `clients`, l'usage de `display_name` et `company_name` est correct.** Le mapping legacy↔canonique ne s'applique pas à cette table.

---

## Table `properties` — biens immobiliers

> **Pas de mapping legacy** — `postal_code` est canonique (pas `postcode`).

| Colonne canonique | Type | Notes |
|---|---|---|
| `address` | text NOT NULL | |
| `city`, `postal_code`, `insee_code` | text | |
| `ban_id` | text | ID Base Adresse Nationale |
| `cadastre_section`, `cadastre_number`, `cadastre_prefix` | text | |
| `property_type` | enum | `'maison' | 'appartement' | 'immeuble' | 'local_commercial' | 'bureau' | 'autre'` |
| `year_built`, `surface_carrez`, `surface_boutin`, `surface_total` | int/float | |
| `apartment_detail`, `floor_number`, `building_letter`, `lot_number` | text/int | |
| `heating_type`, `energy_class`, `ges_class` | text | |

---

## Table `organizations` — cabinets diagnostiqueur

| Colonne canonique | Type | Notes |
|---|---|---|
| `name`, `siret` | text | |
| `address`, `city`, `postal_code`, `country` | text | |
| `certification_n`, `logo_url`, `logo_mime`, `brand_color_hex` | text | |

> `postal_code` (pas `postcode`).

---

## Table `quote_requests` — demandes de devis B2C

| Colonne canonique | Type | Notes |
|---|---|---|
| `requester_first_name`, `requester_last_name` | text NOT NULL | |
| `requester_email` | text NOT NULL | |
| `requester_phone` | text | E.164 |
| `property_type`, `property_situation` | text NOT NULL | |
| `property_address`, `property_postal_code`, `property_city` | text | |
| `property_surface_m2`, `property_year_built` | int | |
| `property_geo_lat`, `property_geo_lng` | double precision | |
| `diagnostics_requested` | text[] | Array de DiagnosticCode |
| `status` | enum | `'pending' | 'pending_email_verification' | 'pending_otp_verification' | ...` |
| `diag_notified_at`, `diag_responded_at` | timestamptz | |

> Sur cette table, **`property_postal_code` est canonique** (pas `postcode`).

---

## Table `otp_codes` — vérification SMS leads

| Colonne canonique | Type | Notes |
|---|---|---|
| `phone_e164` | text NOT NULL | **`_e164` est canonique ICI** car indique explicitement le format |
| `code`, `purpose`, `verified_at`, `attempts`, `expires_at` | … | |

> `phone_e164` est canonique sur cette table (différent du mapping diagnosticians).

---

## Tables `invoices`, `quotes`, `credit_notes` (modules facturation/devis)

| Colonne | Type | Notes |
|---|---|---|
| `display_name` (issuer/client) | text | Canonique pour génération PDF/Factur-X |
| `postal_code` | text | Canonique pour bloc adresse PDF |
| `qonto_*`, `pennylane_*`, `indy_*`, `tiime_*` | text | IDs sync connecteurs |
| `current_period_start`, `current_period_end` | timestamptz | Stripe billing |

---

## Colonnes définitivement supprimées (jamais ressuscitées)

| Colonne legacy | Remplacement | Raison |
|---|---|---|
| `phone_country_code` (séparé) | `phone` en E.164 | Format E.164 = pays inclus |
| `mobile_phone` vs `landline` | `phone` unique | Simplification |
| `address_street`, `address_city_full` | `address` + `city` + `postal_code` | Normalisation BAN |

---

## Pattern recommandé pour les développeurs

### Lecture SELECT

Toujours **uniquement** les noms canoniques :

```ts
// ✅ BON
const { data } = await supabase
  .from('diagnosticians')
  .select('id, full_name, slug_city, slug_dept, gmb_rating, gmb_review_count, official_email')

// ❌ MAUVAIS (colonnes legacy)
const { data } = await supabase
  .from('diagnosticians')
  .select('id, display_name, city_slug, rating_avg, reviews_count')
```

### INSERT / UPDATE

Idem — uniquement noms canoniques. Le trigger DB s'occupe d'alimenter le legacy si besoin :

```ts
// ✅ BON
await supabase.from('diagnosticians').upsert({
  full_name: 'Benjamin Bel',
  slug: 'benjamin-bel-76200',
  slug_city: 'dieppe',
  slug_dept: 'seine-maritime',
  gmb_rating: 4.7,
})
```

### Fallback (uniquement migrations progressives)

Si vous **devez** lire une donnée historique qui pourrait être sur l'ancien nom :

```ts
const display = row.full_name ?? row.display_name ?? null
```

Mais documenter explicitement pourquoi et créer un task pour migrer.

### Types Database (`packages/database/src/types.ts`)

- État actuel (2026-05-23) : 29 tables typées, dont **`diagnosticians` ABSENTE**
- Les colonnes legacy/canonique ne sont pas dans les types → utiliser `(supabase as any)` avec `biome-ignore lint/suspicious/noExplicitAny: A1 table` quand nécessaire
- Plan régen : voir [`database-types-regen-plan.md`](./database-types-regen-plan.md)

---

## Quick reference — où chercher

| Donnée | Table principale | Colonne canonique |
|---|---|---|
| Nom complet d'un **diagnostiqueur** | `diagnosticians` | `full_name` |
| Nom d'affichage d'un **client interne** | `clients` | `display_name` |
| URL slug ville d'un diagnostiqueur | `diagnosticians` | `slug_city` |
| URL slug département | `diagnosticians` | `slug_dept` |
| Code département | `diagnosticians` | `department_code` (`dept_code` aussi présent) |
| Email diag pré-claim (DHUP) | `diagnosticians` | `official_email` |
| Email diag post-claim | `diagnosticians` | `email` |
| Téléphone diag | `diagnosticians` | `phone` ou `official_phone` |
| Note Google My Business | `diagnosticians` | `gmb_rating` |
| User claim ownership | `diagnosticians` | `claimed_by_user_id` |
| Code postal client | `clients` | `postal_code` |
| Code postal bien | `properties` | `postal_code` |
| Code postal lead B2C | `quote_requests` | `property_postal_code` |
| Téléphone OTP vérification | `otp_codes` | `phone_e164` |

---

## Liens

- Migration unifiée : [`supabase/migrations/20260524110000_diagnosticians_unified.sql`](../supabase/migrations/20260524110000_diagnosticians_unified.sql)
- Migration réconciliation : [`supabase/migrations/20260524180000_consolidate_schema_reconciliation.sql`](../supabase/migrations/20260524180000_consolidate_schema_reconciliation.sql)
- Fondation annuaire : [`supabase/migrations/20260530100000_annuaire_diagnosticians.sql`](../supabase/migrations/20260530100000_annuaire_diagnosticians.sql)
- Module DTO types : [`apps/web/src/lib/diagnosticians/dhup-types.ts`](../apps/web/src/lib/diagnosticians/dhup-types.ts)
- Plan régen types : [`docs/database-types-regen-plan.md`](./database-types-regen-plan.md)
