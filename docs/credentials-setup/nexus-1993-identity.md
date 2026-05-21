# SASU Nexus 1993 — Identité officielle

> **Source vérité (humaine)** : ce document est l'authority documentaire sur l'identité légale Nexus 1993.
> **Source vérité (code)** : [`apps/web/src/lib/legal/company-identity.ts`](../../apps/web/src/lib/legal/company-identity.ts) — exporte `COMPANY_IDENTITY` + helpers (`formatLegalMentions()`, `formatInvoiceFooter()`, `buildInvoiceLegalBlock()`). Toute modification SIRET/RCS/adresse/marques se fait là, et auto-propage dans footer / PDFs / emails.
> Tout artefact en conflit doit être mis à jour pour pointer ici et vers la constante TypeScript.

## Identité légale (à utiliser dans tous documents officiels)

| Champ | Valeur |
|---|---|
| **Raison sociale** | NEXUS 1993 |
| **Forme juridique** | SASU (Société par Actions Simplifiée Unipersonnelle) |
| **Capital social** | 500 € |
| **SIREN** | 982 786 154 |
| **D-U-N-S Number** | **281 515 446** (obtenu via D&B) |
| **Code APE/NAF** | **58.29C** — Édition de logiciels applicatifs |
| **RCS** | Paris |
| **Convention collective** | Bureaux d'études techniques et sociétés de conseils — IDCC 1486 |
| **Domaine d'activité** | Édition logiciels SaaS |
| **Forme d'exercice** | Commerciale |
| **Date de clôture d'exercice** | 31/12 |

## Adresse siège social (domiciliation commerciale)

**66 AVENUE DES CHAMPS ELYSEES**
**75008 PARIS**
**FRANCE**

⚠️ Probablement une domiciliation commerciale (SeDomicilier, Welcomr, etc.) — pratique standard SASU early stage. À utiliser **telle quelle** dans tous documents officiels (CGV, mentions légales, factures, contrats).

## Activité déclarée

**Principale** :
> L'édition et la commercialisation de logiciels utilisés à des fins professionnelles ou personnelles installés sur des serveurs distants.

**Autres** :
> Commerce de détail de tous types de produits non réglementés sur internet, y compris : Photos, [...]

## Représentation légale

| Champ | Valeur |
|---|---|
| Président | M. Benjamin Bel |
| Pouvoirs | Pleins pouvoirs (président SASU) |
| Email pro | `benjamin@kovas.fr` (Google Workspace) |
| Téléphone pro | **+33 7 45 02 56 42** (format E.164 : `+33745025642`) |

## Compte bancaire

- **Banque** : Qonto
- **Statut** : actif
- **Usage** : prélèvements abonnements services (Apple Dev, INPI, Hiscox, Stripe, etc.)

## D-U-N-S — Détails et usage

- **Numéro** : 281 515 446
- **Délivré par** : Dun & Bradstreet (via UpiK Europe)
- **Date obtention** : 2026-05-18
- **Validité** : à vie tant que Nexus 1993 existe
- **Usage principal KOVAS** :
  - ✅ **Apple Developer Program enrollment** (prérequis Organisation account) — Task 0.2
  - Secondaire : crédibilité B2B vis-à-vis clients pro qui demandent vérification d'entité
  - Secondaire : grands comptes / appels d'offres réglementaires (Phase 3+)

## Texte légal complet (à reprendre tel quel)

> NEXUS 1993, société par actions simplifiée unipersonnelle au capital social de 500 €, dont le siège social est situé au 66 AVENUE DES CHAMPS ELYSEES 75008 PARIS, immatriculée au Registre du Commerce et des Sociétés de Paris sous le numéro 982 786 154, représentée par M. Benjamin Bel agissant et ayant les pouvoirs nécessaires en tant que président.

## Documents officiels à utiliser cette identité

À harmoniser dans tous les documents légaux générés Task 0.4 :

- CGU.md
- CGV.md
- RGPD-confidentialite.md
- politique-cookies.md
- mentions-legales.md
- DPA-template.md
- charte-beta-testeurs.md

Et également dans :

- Contrat advisor (Task 0.6)
- Contrats prestation diagnostiqueurs partenaires (Task 0.7)
- Police Hiscox RC Pro (Task 0.9)
- Dépôt INPI marque KOVAS (Task 0.3, classes 9+42)

## Status comptes services M0 (à jour 2026-05-18)

| Service | Statut | Notes |
|---|---|---|
| **D-U-N-S** | ✅ Obtenu 18/05 | 281 515 446 |
| Google Workspace `kovas.fr` | À créer | benjamin@/contact@/support@/juridique@ |
| Cloudflare DNS + SSL | À créer | kovas.fr |
| GitHub Nexus 1993 org | À créer | `nexus-1993-kovas` |
| Supabase Free → Pro M2 | À créer | eu-west-3 Paris |
| Anthropic Console (3 workspaces) | À créer | dev/staging/prod |
| OpenAI Platform | À créer | Whisper API + DPA signé |
| Stripe (test mode) | À créer | Activation Live nécessite KBis + RIB |
| Vercel Hobby | À créer | Region cdg1 Paris |
| Expo EAS Free | À créer | - |
| Railway | À créer | Free credits M0-M5 |
| Resend | À créer | Domain kovas.fr verified (SPF/DKIM/DMARC) |
| **Apple Developer Program** | **PROCHAINE ÉTAPE (Task 0.2)** | Maintenant déblocable avec D-U-N-S |
