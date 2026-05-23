# `lib/invoices/` — Factures clients du diagnostiqueur

> **Sémantique** : ce dossier gère **les factures que le diagnostiqueur émet à ses propres clients**
> (particuliers, agences immobilières, notaires, syndics, etc.) pour les diagnostics réalisés.
> Concerne les **revenus** côté diagnostiqueur. Source de vérité : table Supabase `invoices`.

## À ne PAS confondre avec

- `lib/billing/` → abonnement SaaS que **le diagnostiqueur paie à KOVAS** (dépenses).
- `lib/stripe/invoices.ts` → wrapper Stripe pour les factures KOVAS de l'org.

## Modules

| Fichier | Rôle |
|---|---|
| `types.ts` | Types métier : `InvoiceRow`, `InvoiceStatus`, `LineItem`, etc. |
| `generate-pdf.ts` | Génération PDF FR avec mentions légales obligatoires (NF Z42-013) |
| `generate-facturx-xml.ts` | Génération XML Factur-X (CII profile MINIMUM/BASIC pour PPF 2026+) |
| `emails.ts` | Templates emails (envoi facture, relance J+7/J+15/J+30, attestation paiement) |
| `penalties.ts` | Calcul pénalités de retard légales (L.441-9 + indemnité forfaitaire 40€) |
| `sepa-qr.ts` | Génération QR Code SEPA EPC069-12 v2 (paiement scan ↦ virement) |
| `storage.ts` | Upload PDF + XML vers Supabase Storage `invoices-pdf` |
| `stripe-payment-link.ts` | Lien de paiement Stripe optionnel (option ponctuelle, pas inclus dans pack) |

## Routes API associées

- `/api/invoices/[id]/pdf` — Stream PDF facture client
- `/api/invoices/[id]/xml` — Stream XML Factur-X
- `/api/invoices/[id]/send` — Envoi email au client + tracking
- `/dashboard/factures/*` (actions.ts) — CRUD facture (route racine redirige vers /facturation?tab=factures)

## UI associée

- `/dashboard/facturation?tab=factures` — pipeline factures client (en retard, à échéance, payées)
- `/dashboard/facturation?tab=devis` — pipeline devis client
- `/dashboard/factures/nouveau` — création facture client
- `/dashboard/factures/[id]` — détail facture client
- `/dashboard/relances` — séquences relances clients

## Conformité

- Numérotation séquentielle stricte (art. 289 CGI)
- Conservation 10 ans (L.123-22)
- Factur-X obligatoire à partir de 09/2026 pour TPE en réception, 09/2027 en émission (loi Finances 2024)
