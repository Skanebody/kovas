# Chantier fiches publiques diagnostiqueurs — 2026-05-27

> **Contexte** : 3 chantiers parallèles sur la branche `refonte-acqui-target-2026-05`.
> Ce document décrit les patches que l'agent N'A PAS appliqués pour éviter les
> collisions Git avec deux autres agents qui travaillent en même temps sur le
> sweep tutoiement+responsive.
>
> À appliquer **après merge** des autres agents.

---

## Patch — `diagnostician-page-content.tsx`

**Fichier cible** : `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/diagnostician-page-content.tsx`

### 1. Imports à ajouter

Ajouter après l'import existant `BadgeVerified` (ligne 1) :

```tsx
import { LegalIdentitySection } from '@/components/trouver-un-diagnostiqueur/LegalIdentitySection'
```

### 2. Props à enrichir (déjà compatibles)

Le composant reçoit déjà `diagnostician: DiagnosticianRow` qui contient désormais
`sirene_siret`, `company_name`, `naf_code`, `naf_label`, `legal_form`,
`creation_date` (whitelistés dans `sanitizeDiagPublic` côté `page.tsx`).

Aucune nouvelle prop nécessaire — on lit tout depuis `d.*`.

### 3. Bloc JSX à insérer

**Site d'insertion** : juste après la section `04 — Réactivité` et **avant** la
section `05 — Avis Google` (vers la ligne 383-384 du fichier actuel).

Repérer le contexte exact :

```tsx
// CONTEXTE AVANT (ne pas modifier) :
              {/* 04 — Réactivité & vérification (B37 / GC3) */}
              {availability && availability.signalsCount > 0 ? (
                <AvailabilitySection signals={availability} sectionNumber="04" />
              ) : null}

// CONTEXTE APRÈS (ne pas modifier) :
              {/* 05 — Avis Google */}
              {reviewCount !== null && reviewCount > 0 ? (
                <div>
                  <SectionHeader number="05" title="Avis Google" />
```

**Bloc à insérer entre les deux** :

```tsx
              {/* 04bis — Identité légale (open data INSEE/SIRENE) */}
              {d.sirene_siret ? (
                <LegalIdentitySection
                  siret={d.sirene_siret}
                  companyName={d.company_name ?? null}
                  legalForm={d.legal_form ?? null}
                  nafCode={d.naf_code ?? null}
                  nafLabel={d.naf_label ?? null}
                  creationDate={d.creation_date ?? null}
                />
              ) : null}
```

> Le composant `LegalIdentitySection` retourne déjà `null` si `siret` est
> NULL ou pas 14 chiffres — le wrapper `{d.sirene_siret ? ... : null}` est
> une sécurité défensive supplémentaire pour éviter de monter le composant
> inutilement.

### 4. Brancher le tier annuaire sur DiagMap

**Site d'insertion** : section `03 — Zone d'intervention`, ligne ~364.

Repérer :

```tsx
                    <DiagMap
                      lat={lat}
                      lng={lng}
                      radiusKm={radiusKm}
                      name={fullName}
                      city={cityLabel}
                    />
```

Remplacer par :

```tsx
                    <DiagMap
                      lat={lat}
                      lng={lng}
                      radiusKm={radiusKm}
                      name={fullName}
                      city={cityLabel}
                      annuaireTier={resolveAnnuaireTier(d)}
                      highlightedCities={
                        Array.isArray(d.highlighted_cities)
                          ? d.highlighted_cities
                          : undefined
                      }
                    />
```

Et ajouter le helper en bas du fichier (juste avant `function SectionHeader`) :

```tsx
/**
 * Résout le tier annuaire à partir du diagnosticien. Si pas d'abonnement,
 * renvoie `'free'`. Source : `d.annuaire_tier` (texte 'free' | 'presence' |
 * 'boost' | 'premium') ou fallback `'free'`.
 */
function resolveAnnuaireTier(
  d: DiagnosticianRow,
): 'free' | 'presence' | 'boost' | 'premium' {
  const raw = typeof d.annuaire_tier === 'string' ? d.annuaire_tier : null
  if (raw === 'presence' || raw === 'boost' || raw === 'premium') return raw
  return 'free'
}
```

> **Note** : la colonne `annuaire_tier` n'existe pas encore en DB ;
> le helper fallback `'free'` pour toutes les rows actuelles. Quand la
> migration Annuaire (lot B43 ou suivant) ajoutera la colonne avec les
> subscriptions, ce branchement deviendra automatiquement fonctionnel.
> En attendant, la carte rend déjà aux couleurs KOVAS (palette navy DS v5).

### 5. (Optionnel, plus tard) Whitelist `annuaire_tier` dans sanitizeDiagPublic

Quand le lot annuaire B43 livrera la colonne `annuaire_tier` en DB, ajouter
dans `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/page.tsx`
ligne ~458 (juste après `created_at`) :

```ts
    annuaire_tier: diag.annuaire_tier,
    highlighted_cities: diag.highlighted_cities, // JSONB array<{lat,lng,name}>
```

---

## Récapitulatif fichiers touchés par cet agent

| Fichier | Action |
|---|---|
| `supabase/migrations/20260527150000_backfill_city_slug.sql` | **CREATED** — migration backfill `city_slug` + trigger auto-set |
| `apps/web/src/app/trouver-un-diagnostiqueur/page.tsx` | **EDIT 1 ligne** — `'inconnu'` → `'commune-non-precisee'` |
| `apps/web/src/lib/annuaire/intervention-zone-tier.ts` | **CREATED** — helper config visuelle 4 tiers |
| `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/diag-map.tsx` | **REWRITE** — CartoDB tiles + marker custom + tiers + popup DS v5 |
| `apps/web/src/app/trouver-un-diagnostiqueur/[dept]/[city]/[slug]/page.tsx` | **EDIT** — whitelist 5 champs SIRENE open data |
| `apps/web/src/lib/data-gouv/recherche-entreprises/diagnostician-badge.ts` | **EXTEND** — interface enrichie (`companyName` / `legalForm` / `siret`) |
| `apps/web/src/components/trouver-un-diagnostiqueur/LegalIdentitySection.tsx` | **CREATED** — section identité légale open data |

## Application en prod de la migration SQL

Le sandbox CLI a refusé l'appel `curl` vers `api.supabase.com` (réseau sortant
bloqué). À exécuter manuellement avec le token déjà disponible dans `.env.local` :

```bash
# Depuis la racine du repo
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)

curl -X POST "https://api.supabase.com/v1/projects/jlizdkffwjdiokvmhcwg/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(jq -Rs '{query: .}' < supabase/migrations/20260527150000_backfill_city_slug.sql)"
```

Ou plus simplement via la console SQL Supabase Studio en collant le contenu
du fichier `supabase/migrations/20260527150000_backfill_city_slug.sql`.

Sanity check post-application :

```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE city_slug IS NULL) AS null_count,
       COUNT(*) FILTER (WHERE city_slug = 'commune-non-precisee') AS sentinel_count
FROM public.diagnosticians;
```

Le `null_count` doit être à 0. Le `sentinel_count` correspond aux rows où
`city` était aussi NULL (cas Hugo Tanguy etc.).
