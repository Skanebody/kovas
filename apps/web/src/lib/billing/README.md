# `lib/billing/` — Abonnement KOVAS (SaaS)

> **Sémantique** : ce dossier gère **l'abonnement SaaS que le diagnostiqueur paie à KOVAS** (SASU Nexus 1993).
> Concerne les **dépenses** côté diagnostiqueur. Source de vérité : **Stripe**.

## À ne PAS confondre avec

- `lib/invoices/` → factures que **le diagnostiqueur émet à SES propres clients** (revenus).
- `lib/stripe/invoices.ts` → wrapper Stripe pour lister les factures KOVAS de l'org (utilisé ici).

## Modules

| Fichier | Rôle |
|---|---|
| `quotas.ts` | Compteurs mensuels missions / API IA / SMS — gating des features |
| `trial-guard.ts` | Vérifie l'état d'essai (active / expired / cancelled) + whitelist routes |
| `trial-limits.ts` | Limites d'usage pendant l'essai 30j (modèle Qonto) |
| `fair-use-monitor.ts` | Détecte les dépassements abusifs (au-delà du quota équitable) |
| `feature-gates.ts` | Activation conditionnelle features par plan |
| `ai-cost-calculator.ts` | Calcul coût IA pour reporting marge brute |
| `ai-cost-tracker.ts` | Tracking dépenses IA par org pour facturation surplus |

## Routes API associées

- `/api/billing/checkout` — Setup Intent + Subscription Stripe
- `/api/billing/portal` — Stripe Customer Portal (gérer CB / résilier)
- `/api/billing/invoices` — Liste factures KOVAS de l'org (lecture Stripe)
- `/api/billing/webhook` — Webhook Stripe (paid/failed/cancelled)

## UI associée

- `/dashboard/account?tab=abonnement` — affichage plan actuel + quotas
- `/dashboard/account?tab=facturation` — **historique factures KOVAS** (PDF Stripe)
- `components/billing/InvoicesList.tsx` — tableau factures KOVAS standalone
- `components/billing/TrialBanner.tsx` — bannière essai

## Pricing canonique

Voir `lib/pricing-plans.ts` (5 tiers : Découverte 29€ / Pro 59€ / All-Inclusive 99€ / Cabinet 149€ / Cabinet+ 299€).
