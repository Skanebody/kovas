# Phase 2 — Slots premium par ville (V1.5)

> Statut : schéma DB en place (migration `20260603100000_annuaire_freemium_levels.sql`), helper TS prêt (`apps/web/src/lib/diagnosticians/premium-slots.ts`), **fonctionnalité désactivée** (`city_premium_slots.enabled = false` partout).
> Activation prévue **M9-M12** quand l'annuaire est mature (≥ 500 fiches claimed et ≥ 1000 demandes de devis/mois).

## Inspiration

Modèle Google Ads serruriers / "Locksmith near me" : les **3 premiers résultats** d'une recherche locale capturent **80% des clics**.

Sur KOVAS, on transpose ce constat à l'annuaire `/trouver-un-diagnostiqueur/[dept]/[city]` : pour chaque ville française avec ≥ 5 diagnostiqueurs concurrents, on ouvre **3 slots TOP** réservés aux abonnés Pro+/Cabinet ayant souscrit cette option.

## Modèle économique

| Élément | Valeur |
|---|---|
| Prix par slot par mois | **89 € HT** |
| Max slots par ville | **3** (positions 1, 2, 3) |
| Engagement | Mensuel résiliable, pas d'engagement annuel obligatoire |
| Pré-requis | Tier ≥ Pro (39€) + fiche claimed depuis ≥ 3 mois |
| Période d'essai | 14 jours gratuit sur premier slot |

**Modélisation revenus** :
- 50 villes activées × moyenne 2 slots/ville × 89€ = **8 900 €/mois** soit 107 k€/an.
- Cible M18 : 200 villes × 2 slots × 89€ = **35 600 €/mois** soit 427 k€/an.

## Logique de sélection (à valider M9)

Deux options à benchmarker sur des fiches bêta :

### Option A — First-come-first-served + queue d'attente

- Le premier diag qui souscrit obtient le slot #1, le second #2, le troisième #3.
- Au-delà : liste d'attente avec notification quand slot libéré.
- **Avantage** : transparence et simplicité.
- **Inconvénient** : pas de levier prix dynamique.

### Option B — Enchères mensuelles type Google Ads

- Chaque mois, les diag enchérissent (89€ minimum, +10€ par enchère).
- Top 3 enchérisseurs obtiennent les positions.
- **Avantage** : maximise le revenu, sélectionne les diag les plus motivés.
- **Inconvénient** : complexité UX + risque d'effet "loterie".

**Recommandation** : démarrer en Option A pour M9-M12, observer le comportement, basculer en Option B au M12+ si la demande dépasse l'offre dans ≥ 30% des villes.

## Schéma de base

```sql
-- Cf. supabase/migrations/20260603100000_annuaire_freemium_levels.sql
CREATE TABLE city_premium_slots (
  id                          uuid PRIMARY KEY,
  city_slug                   text NOT NULL,
  department_code             text NOT NULL,
  max_slots                   int DEFAULT 3,
  current_slot_price_eur_monthly int DEFAULT 89,
  enabled                     boolean DEFAULT false,
  UNIQUE (city_slug, department_code)
);

CREATE TABLE diagnostician_premium_bookings (
  id                          uuid PRIMARY KEY,
  diagnostician_id            uuid REFERENCES diagnosticians(id),
  slot_id                     uuid REFERENCES city_premium_slots(id),
  position                    int CHECK (position IN (1, 2, 3)),
  active_from                 timestamptz,
  active_until                timestamptz,
  monthly_price_paid_eur      int,
  UNIQUE (slot_id, position)
);
```

## Helper

`apps/web/src/lib/diagnosticians/premium-slots.ts` expose :

- `getActivePremiumBookingsForCity(supabase, citySlug, deptCode): PremiumBooking[]` — retourne `[]` en V1.
- `isPremiumSlotsEnabled(supabase, citySlug, deptCode): boolean` — retourne `false` en V1.
- `getPremiumDiagnosticianIdsForCity(supabase, citySlug, deptCode): Set<string>` — retourne Set vide en V1.

Quand la fonctionnalité sera activée, il suffira de :

1. Insérer des lignes `city_premium_slots` avec `enabled = true`.
2. Créer le flow Stripe (`/api/annuaire/premium-slots/checkout`) pour souscrire.
3. Modifier le tri `/trouver-un-diagnostiqueur/[dept]/[city]/page.tsx` pour mettre les bookings en tête (avant le tri `premium > verified > basic`).

## Cohabitation avec les 3 niveaux

| Cas | Comportement |
|---|---|
| Diag **premium** (Pro+) **avec** slot premium ville | Position 1-3 forcée + badge "Recommandé KOVAS" |
| Diag **premium** (Pro+) **sans** slot premium ville | Tri standard "premium" (après les slots payés) |
| Diag **verified** avec slot premium ville | Pas autorisé (pré-requis tier ≥ Pro) |
| Slot vacant dans une ville | Affichage normal sans slot, première position au diag premium "naturel" |

## Vérifications avant activation M9-M12

- [ ] ≥ 500 fiches claimed (mesure de l'offre)
- [ ] ≥ 1000 demandes de devis/mois (mesure de la demande)
- [ ] Module checkout Stripe pour `add-on` indépendant du tier mensuel
- [ ] UI admin pour activer une ville et fixer son prix
- [ ] Analytics CTR par position (pour valider l'hypothèse 80% top 3)
- [ ] Avenant CGV pour clarifier la nature "publicitaire" du slot

## Conformité

Le slot premium est explicitement marqué "Sponsorisé" sur la card publique (mention LCEN art. 6-III et bonnes pratiques DGCCRF). On ne masque jamais le caractère payant du tri.
