# KOVAS — Setup des 44 Stripe Price IDs (Pricing V3 dual track)

> Document de référence pour la création des 44 produits + tarifs Stripe avant go-live.
> Source de vérité prix produit : `apps/web/src/lib/pricing-plans.ts`.
> Source de vérité mapping env vars : `apps/web/src/lib/pricing/stripe-products.ts`.
>
> **Périmètre** : 44 prix répartis sur 5 surfaces commerciales :
> Annuaire (6) + Logiciel (8) + Bundles (10) + Sponsored Slots (12) + Add-ons (8).

---

## 1. Conventions Stripe

### Produits vs Prix

- Chaque ligne du tableau ci-dessous = **1 produit Stripe** avec **2 prix** rattachés (monthly + annual).
- Le produit porte le nom métier ("KOVAS Annuaire Pro").
- Les deux prix portent un nickname interne ("monthly_v3", "annual_v3") pour faciliter la maintenance.

### Cycle annuel = 2 mois offerts

Le tarif annuel = `monthlyPrice × 10` (10 mois payés sur 12, cf. CLAUDE.md §4).

Exemple Annuaire Pro :
- Monthly : 19,00 € HT / mois
- Annual : 190,00 € HT / an (équivalent 15,83 € HT / mois → "2 mois offerts")

### Currency + Tax

- Toutes les prix en **EUR**, montants HT (TVA gérée via Stripe Tax)
- Stripe Tax activé : TVA 20% appliquée automatiquement aux clients FR

---

## 2. Tableau exhaustif des 44 prix

### A. KOVAS Annuaire (3 tiers × 2 cycles = 6 prix)

| Code plan | Nom Stripe | Prix HT mensuel | Prix HT annuel | Env var monthly | Env var annual |
|---|---|---|---|---|---|
| `annuaire_pro` | KOVAS Annuaire Pro | 19,00 € | 190,00 € | `STRIPE_PRICE_ANNUAIRE_PRO_MONTHLY` | `STRIPE_PRICE_ANNUAIRE_PRO_ANNUAL` |
| `annuaire_visibility` | KOVAS Annuaire Visibilité | 39,00 € | 390,00 € | `STRIPE_PRICE_ANNUAIRE_VISIBILITY_MONTHLY` | `STRIPE_PRICE_ANNUAIRE_VISIBILITY_ANNUAL` |
| `annuaire_sponsored` | KOVAS Annuaire Sponsorisé | 79,00 € | 790,00 € | `STRIPE_PRICE_ANNUAIRE_SPONSORED_MONTHLY` | `STRIPE_PRICE_ANNUAIRE_SPONSORED_ANNUAL` |

> Note : `annuaire_free` (Vérifié, gratuit) n'a **pas** de Price ID Stripe — c'est juste une row en BDD.

### B. KOVAS 360 Logiciel (4 tiers × 2 cycles = 8 prix)

| Code plan | Nom Stripe | Prix HT mensuel | Prix HT annuel | Env var monthly | Env var annual |
|---|---|---|---|---|---|
| `logiciel_starter` | KOVAS 360 Starter | 29,00 € | 290,00 € | `STRIPE_PRICE_LOGICIEL_STARTER_MONTHLY` | `STRIPE_PRICE_LOGICIEL_STARTER_ANNUAL` |
| `logiciel_active` | KOVAS 360 Active | 59,00 € | 590,00 € | `STRIPE_PRICE_LOGICIEL_ACTIVE_MONTHLY` | `STRIPE_PRICE_LOGICIEL_ACTIVE_ANNUAL` |
| `logiciel_cabinet` | KOVAS 360 Cabinet | 149,00 € | 1 490,00 € | `STRIPE_PRICE_LOGICIEL_CABINET_MONTHLY` | `STRIPE_PRICE_LOGICIEL_CABINET_ANNUAL` |
| `logiciel_enterprise` | KOVAS 360 Enterprise | 299,00 € | 2 990,00 € | `STRIPE_PRICE_LOGICIEL_ENTERPRISE_MONTHLY` | `STRIPE_PRICE_LOGICIEL_ENTERPRISE_ANNUAL` |

> Note : `logiciel_free` (essai 14j) n'a **pas** de Price ID Stripe — créé via trial period Stripe sur les plans payants.

### C. Bundles Annuaire + Logiciel (5 combos × 2 cycles = 10 prix)

| Code bundle | Nom Stripe | Prix HT mensuel | Prix HT annuel | Env var monthly | Env var annual |
|---|---|---|---|---|---|
| `bundle_starter_visibility` | KOVAS Starter + Annuaire Pro | 39,00 € | 390,00 € | `STRIPE_PRICE_BUNDLE_STARTER_VISIBILITY_MONTHLY` | `STRIPE_PRICE_BUNDLE_STARTER_VISIBILITY_ANNUAL` |
| `bundle_active_pro` | KOVAS Active + Annuaire Pro | 69,00 € | 690,00 € | `STRIPE_PRICE_BUNDLE_ACTIVE_PRO_MONTHLY` | `STRIPE_PRICE_BUNDLE_ACTIVE_PRO_ANNUAL` |
| `bundle_active_visibility` | KOVAS Active + Annuaire Visibilité | 89,00 € | 890,00 € | `STRIPE_PRICE_BUNDLE_ACTIVE_VISIBILITY_MONTHLY` | `STRIPE_PRICE_BUNDLE_ACTIVE_VISIBILITY_ANNUAL` |
| `bundle_cabinet_pro` | KOVAS Cabinet + Annuaire Pro | 149,00 € | 1 490,00 € | `STRIPE_PRICE_BUNDLE_CABINET_PRO_MONTHLY` | `STRIPE_PRICE_BUNDLE_CABINET_PRO_ANNUAL` |
| `bundle_cabinet_visibility` | KOVAS Cabinet + Annuaire Visibilité | 169,00 € | 1 690,00 € | `STRIPE_PRICE_BUNDLE_CABINET_VISIBILITY_MONTHLY` | `STRIPE_PRICE_BUNDLE_CABINET_VISIBILITY_ANNUAL` |

> Les bundles sont une **alternative** à 2 souscriptions séparées (annuaire + logiciel) à prix remisé.
> Le mapping bundle → tiers individuels est codé dans `pricing-plans.ts` (helper `getBundleComponents`).

### D. Sponsored Slots (6 catégories × 2 cycles = 12 prix)

Réservés au tier `annuaire_sponsored` — achat additionnel pour apparaître en tête sur des pages géo spécifiques.

| Catégorie | Définition | Prix HT mensuel | Prix HT annuel | Env var monthly | Env var annual |
|---|---|---|---|---|---|
| `metropole` | > 500k hab. (Paris, Lyon, Marseille...) | 199,00 € | 1 990,00 € | `STRIPE_PRICE_SLOT_METROPOLE_MONTHLY` | `STRIPE_PRICE_SLOT_METROPOLE_ANNUAL` |
| `grande_ville` | 200k–500k hab. | 119,00 € | 1 190,00 € | `STRIPE_PRICE_SLOT_GRANDE_VILLE_MONTHLY` | `STRIPE_PRICE_SLOT_GRANDE_VILLE_ANNUAL` |
| `ville_moyenne` | 50k–200k hab. | 79,00 € | 790,00 € | `STRIPE_PRICE_SLOT_VILLE_MOYENNE_MONTHLY` | `STRIPE_PRICE_SLOT_VILLE_MOYENNE_ANNUAL` |
| `petite_ville` | 10k–50k hab. | 39,00 € | 390,00 € | `STRIPE_PRICE_SLOT_PETITE_VILLE_MONTHLY` | `STRIPE_PRICE_SLOT_PETITE_VILLE_ANNUAL` |
| `commune` | 3k–10k hab. | 19,00 € | 190,00 € | `STRIPE_PRICE_SLOT_COMMUNE_MONTHLY` | `STRIPE_PRICE_SLOT_COMMUNE_ANNUAL` |
| `rural` | < 3k hab. | 9,00 € | 90,00 € | `STRIPE_PRICE_SLOT_RURAL_MONTHLY` | `STRIPE_PRICE_SLOT_RURAL_ANNUAL` |

### E. Add-ons modules (4 modules × 2 cycles = 8 prix)

Souscriptions optionnelles, additionnables sur logiciel `active` ou supérieur.

| Code add-on | Nom Stripe | Prix HT mensuel | Prix HT annuel | Env var monthly | Env var annual |
|---|---|---|---|---|---|
| `addon_signatures_eidas` | Signatures électroniques eIDAS | 19,00 € | 190,00 € | `STRIPE_PRICE_ADDON_SIGNATURES_EIDAS_MONTHLY` | `STRIPE_PRICE_ADDON_SIGNATURES_EIDAS_ANNUAL` |
| `addon_pennylane_sync` | Synchronisation Pennylane | 9,00 € | 90,00 € | `STRIPE_PRICE_ADDON_PENNYLANE_SYNC_MONTHLY` | `STRIPE_PRICE_ADDON_PENNYLANE_SYNC_ANNUAL` |
| `addon_sms_reminders` | SMS rappel client J-1 | 9,00 € | 90,00 € | `STRIPE_PRICE_ADDON_SMS_REMINDERS_MONTHLY` | `STRIPE_PRICE_ADDON_SMS_REMINDERS_ANNUAL` |
| `addon_community_pro` | Communauté Pro | 9,00 € | 90,00 € | `STRIPE_PRICE_ADDON_COMMUNITY_PRO_MONTHLY` | `STRIPE_PRICE_ADDON_COMMUNITY_PRO_ANNUAL` |

---

## 3. Procédure de création — Stripe Dashboard (manuelle, recommandée pour audit)

### Pour chaque ligne du tableau ci-dessus

1. Stripe Dashboard → **Products** → **+ Add product**
2. Renseigner :
   - **Name** : exemple "KOVAS Annuaire Pro"
   - **Description** : texte court reprenant les bénéfices clés (visible Stripe customer portal)
   - **Image** : logo KOVAS 360 ou KOVAS Annuaire selon contexte
   - **Tax behavior** : **Inclusive of tax** → **Non** (montants HT)
3. **Pricing** → **+ Add another price** :
   - **Price 1 (monthly)** :
     - Pricing model : **Standard pricing**
     - Recurring : **Yes**, billing period : **Monthly**
     - Amount : ex. **19,00 EUR** HT (voir tableau)
     - Nickname interne : `monthly_v3`
   - **Price 2 (annual)** :
     - Recurring : **Yes**, billing period : **Yearly**
     - Amount : ex. **190,00 EUR** HT
     - Nickname interne : `annual_v3`
4. **Save product**
5. Copier les deux `price_xxx` IDs depuis l'onglet "Pricing" du produit
6. Renseigner dans Vercel Environment Variables (production scope) :
   - `STRIPE_PRICE_ANNUAIRE_PRO_MONTHLY=price_xxx`
   - `STRIPE_PRICE_ANNUAIRE_PRO_ANNUAL=price_xxx`

Répéter pour les 22 produits (44 prix total).

---

## 4. Procédure de création — Stripe CLI (semi-automatisée)

Pour gagner du temps, utiliser Stripe CLI :

```bash
# Auth
stripe login

# Produit Annuaire Pro
stripe products create \
  --name="KOVAS Annuaire Pro" \
  --description="Fiche premium, photos, mise en avant — KOVAS Annuaire" \
  --metadata[plan_code]=annuaire_pro \
  --metadata[surface]=annuaire

# → Récupérer le prod_xxx affiché, puis créer les 2 prix :
stripe prices create \
  --product=prod_xxx \
  --currency=eur \
  --unit-amount=1900 \
  --recurring[interval]=month \
  --nickname="monthly_v3"

stripe prices create \
  --product=prod_xxx \
  --currency=eur \
  --unit-amount=19000 \
  --recurring[interval]=year \
  --nickname="annual_v3"
```

> Un script `scripts/stripe-provision-plans.ts` peut être écrit pour automatiser
> les 22 produits + 44 prix d'un coup à partir de `pricing-plans.ts` (cf. `getStripePriceId`).
> Non livré Phase H : à coder si besoin réel en pré-prod.

---

## 5. Métadonnées Stripe recommandées

Pour faciliter le rapprochement comptable et la migration plans :

| Métadonnée | Valeur | Niveau |
|---|---|---|
| `plan_code` | ex. `annuaire_pro` | Product + Price |
| `surface` | `annuaire` / `logiciel` / `bundle` / `slot` / `addon` | Product |
| `version` | `v3` | Product (pour distinguer des plans legacy) |
| `billing_cycle` | `monthly` / `annual` | Price |
| `pricing_tier` | `entry` / `mid` / `top` (optionnel) | Product |

---

## 6. Webhook Stripe — événements à abonner

Une fois les Price IDs créés, configurer le webhook prod :

- **URL** : `https://kovas.fr/api/stripe/webhook`
- **Events** :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

Copier le `whsec_...` dans `STRIPE_WEBHOOK_SECRET` (Vercel + Supabase secret pour Edge Function `stripe-webhook-payment`).

---

## 7. Vérification post-création

### Script de health check

```typescript
// scripts/check-stripe-prices.ts (à coder si besoin)
import { STRIPE_ANNUAIRE_PRICES, STRIPE_LOGICIEL_PRICES, STRIPE_BUNDLE_PRICES, STRIPE_SPONSORED_SLOT_PRICES, STRIPE_ADDON_PRICES } from '@/lib/pricing/stripe-products'

const missing: string[] = []
for (const [code, ids] of Object.entries(STRIPE_ANNUAIRE_PRICES)) {
  if (!ids.monthly) missing.push(`STRIPE_PRICE_ANNUAIRE_${code.toUpperCase().replace('ANNUAIRE_', '')}_MONTHLY`)
  if (!ids.annual) missing.push(`STRIPE_PRICE_ANNUAIRE_${code.toUpperCase().replace('ANNUAIRE_', '')}_ANNUAL`)
}
// ... idem pour les 4 autres surfaces
console.log(missing.length === 0 ? '✓ All 44 prices configured' : `✗ Missing: ${missing.join(', ')}`)
```

### Vérification manuelle

```bash
# Avec Stripe CLI, lister tous les prix V3 + comptage
stripe prices list --limit=100 --active=true | jq -r '.data[] | select(.nickname | startswith("monthly_v3") or startswith("annual_v3")) | .id'
# Doit retourner exactement 44 IDs
```

---

## 8. Migration des bêta-testeurs (plans legacy)

Les bêta-testeurs Phase B2 historiques bénéficient du tarif **Founder à vie** :
- `founder_legacy` : 49 €/mo Standard (70 missions, surplus 1€)
- Cabinet Founder : 169 €/mo

Ces plans **ne sont pas** dans les 44 Price IDs V3. Ils sont conservés en BDD via les
codes `*_legacy` et leurs Price IDs Stripe historiques (créés Phase B0 lors du lancement bêta).

**Ne pas migrer ces utilisateurs en V3** — l'Edge Function `migrate-legacy-plans-v3`
détecte automatiquement les `*_legacy` et les conserve tels quels.

---

## 9. Récap final

| | Quantité |
|---|---|
| Produits Stripe à créer | 22 |
| Prix Stripe à créer (monthly + annual) | 44 |
| Variables d'env Vercel à provisionner | 44 (+ `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` = 47 total) |
| Métadonnées par produit | 3-5 |
| Webhook events à abonner | 9 |

**Temps estimé manuel (dashboard) : 2-3 heures**.
**Temps estimé Stripe CLI : 30-45 minutes**.
