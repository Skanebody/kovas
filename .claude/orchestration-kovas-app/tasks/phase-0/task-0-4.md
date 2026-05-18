# Task 0.4 : Documents légaux IA-first via Claude Max (M1-M5)

## Objective

Générer via Claude Max tous les documents légaux requis pour le lancement public (Vague 1 du plan juridique IA-first). 7 documents au total : CGU, CGV, Politique Confidentialité RGPD, Politique Cookies, Mentions Légales, Template DPA B2B, Charte Bêta-Testeurs.

## Context

Vague 1 du plan juridique. Budget cible : 0€ (Claude Max + INPI déjà payé Task 0.3). Vague 2 (M9-M18) prévoit audit avocat IP/Tech ciblé Lefèvre/Lex2B (1-1,5k€) UNIQUEMENT sur 2 sujets risque : mémorandum reverse-engineering Liciel + CGU spécifiques métier diagnostic. Cette task fournit la base à laquelle l'avocat apportera son sceau Vague 2.

## Dependencies

- Task 0.1 (Google Workspace + emails pro `juridique@kovas.fr` opérationnels)
- Task 0.3 (Marque KOVAS déposée, numéro dépôt référencé dans mentions légales)

## Blocked By

- Tasks 0.1 et 0.3 (en parallèle complétables)

## Research Findings

- De `research/stripe-facturx-signature.md` §13 : Factur-X émission TPE obligatoire **01/09/2027** (à revérifier date exacte, recherche initiale dit 2027, fondateur a mentionné 2028)
- De `research/supabase-architecture.md` §9 : sous-traitants RGPD à documenter (Supabase, AWS sous-jacent, Anthropic, OpenAI, Stripe, Resend, Sentry, PostHog, DocuSeal Railway, Vercel, Expo, Brevo, OVHcloud, Cookiebot, Hiscox, Iopole) — liste mise à jour CLAUDE.md §19
- De `research/liciel-format.md` §3 : L122-6-1 §III CPI (observation/étude logiciel) + CJUE SAS Institute = base légale pour interopérabilité Liciel — à NE PAS citer publiquement dans CGU (cf. defense strategy), mais peut être référencé dans DPA technique si nécessaire
- De `CLAUDE.md` §13 : interdits absolus marketing (pas de mention publique Liciel 12 premiers mois)

## Implementation Plan

### Step 1 : CGU (Conditions Générales d'Utilisation B2B SaaS)

Demander à Claude Max (Opus 4.7 si dispo, sinon Sonnet 4.6) de rédiger CGU couvrant :

- Définitions (KOVAS, utilisateur, abonné, mission, etc.)
- Acceptation des CGU (clic checkbox au signup)
- Description du service (cf. CLAUDE.md §2-3 — Phase 1 Compagnon)
- **Modalités d'utilisation IA** : transparence sur Claude/Whisper traitement transcripts + photos, conservation, anonymisation
- **Propriété intellectuelle utilisateur** : utilisateur reste propriétaire de SES données (missions, photos, rapports) — KOVAS ne revendique pas
- **Propriété intellectuelle KOVAS** : code, design, IP du SaaS appartient à Nexus 1993
- Conditions d'accès essai 14 jours (cf. CLAUDE.md §6)
- Engagement de disponibilité (cf. SLA support 4h ouvrées) — sans garantie absolue (no SLA contractuel Phase 1)
- Limitations de responsabilité (en cohérence avec assurance Hiscox 500k€/1M€ — cf. Task 0.9)
- Résiliation
- Loi applicable : française, juridiction Rouen (proximité Dieppe)

**Important** : ne PAS mentionner Liciel par son nom dans les CGU (cf. defense strategy §3 — éviter cible 12 premiers mois). Mentionner uniquement "votre logiciel actuel" en générique.

Save : `docs/legal/CGU.md`

### Step 2 : CGV (Conditions Générales de Vente)

Couvrir :

- 4 tiers Phase 1 (Découverte 29€, Standard 59€, Volume 99€, Cabinet 199€ Phase 2)
- Surplus à l'usage (2€/mission Découverte, 1,50€ Standard, 1€ Volume)
- Options ponctuelles (eIDAS 2€/sig, bilingue 5€/rapport, SMS 0,15€)
- Modalités de paiement (Stripe Customer enregistré 1 fois, SEPA priorité + CB)
- **Engagement contractuel tarif Founder à vie** : "Les utilisateurs bêta-testeurs M6-M9 ayant signé la Charte Bêta-Testeurs bénéficient du Tarif Founder Standard à vie (49€/mo, 70 missions, surplus 1€/mission) sans augmentation possible, sauf cas de force majeure réglementaire."
- Annuel 10 mois payés / 12 (2 mois offerts)
- Période d'essai 14 jours (gel compte 90j sans conversion)
- TVA 20% FR (Stripe Tax)
- Factur-X (anticipation obligation 09/2027-2028, à revérifier dates exactes Phase 4 second wave)
- Conditions de résiliation : sans préavis pour mensuel, fin de période annuelle pour annuel

Save : `docs/legal/CGV.md`

### Step 3 : Politique de Confidentialité RGPD 2026

Couvrir :

- Identité du responsable de traitement : Nexus 1993
- DPO contact : `juridique@kovas.fr` (Benjamin Bel acting DPO Phase 1, externalisation possible Phase 2+)
- Finalités de traitement : authentification, fourniture du service, facturation, support, amélioration produit (IA training opt-in only)
- Bases légales : exécution contrat (CGU), obligations légales (facture/diag), intérêt légitime (analytics anonyme)
- **Sous-traitants RGPD** (cf. CLAUDE.md §19) :
  - Supabase Inc. (AWS sous-jacent, eu-west-3 Paris, DPA + SCCs)
  - Anthropic PBC (Claude API, US, DPA + SCCs, opt-out training activé)
  - OpenAI LLC (Whisper API, US, DPA + SCCs, opt-out training activé)
  - Deepgram Inc. (Whisper fallback, EU Frankfurt)
  - Stripe Inc. (paiements, EU entity)
  - Resend (emails, EU)
  - Brevo (SMS, FR)
  - Sentry (monitoring, EU)
  - PostHog (analytics, EU)
  - DocuSeal (signature, self-hosted Railway EU)
  - Vercel (web hosting, Paris)
  - Expo (mobile builds, US)
  - Cloudflare (DNS+CDN, global)
  - Google Workspace (email pro)
  - Hiscox (assurance RC pro)
- Durées de conservation :
  - Données compte : durée abonnement + 3 ans après résiliation
  - Données missions : 10 ans (Code de commerce L123-22 — factures)
  - Audit logs : 24 mois
  - Photos/voice : 30 jours par défaut post-mission, configurable user
- Droits RGPD (Articles 15-22) : accès, rectification, effacement, limitation, portabilité, opposition
- Procédure exercice : email à `juridique@kovas.fr` ou self-service dans Settings (cf. Task 1.4)
- Transferts hors UE : Anthropic + OpenAI + Expo (US) — clauses contractuelles types (SCCs) signées
- Sécurité : TLS chiffrement, RLS multi-tenant, 2FA TOTP optionnel, audit logs append-only
- Droit de réclamation CNIL

Save : `docs/legal/RGPD-confidentialite.md`

### Step 4 : Politique de Cookies

Couvrir :

- Définition cookies + technologies similaires (localStorage, sessionStorage)
- Cookies essentiels (auth Supabase, CSRF, preferences UI) — pas de consentement requis
- Cookies analytics (PostHog) — consentement opt-in requis
- Cookies marketing : **AUCUN Phase 1** (pas de retargeting, pas de Google Ads, pas de Facebook Pixel)
- Bandeau cookies custom React (cf. Task ultérieure, pas Cookiebot) :
  - 3 boutons : Tout accepter / Refuser tout / Préférences
  - Conformité CNIL "refuser aussi simple qu'accepter"
- Durée de conservation des cookies : 13 mois max (conformité CNIL)
- Comment refuser/modifier : lien permanent footer kovas.fr → "Gestion cookies"

Save : `docs/legal/politique-cookies.md`

### Step 5 : Mentions Légales

Standard mais conforme :

- Identité éditeur : SASU Nexus 1993, SIRET <à compléter>, capital social, adresse Dieppe, RCS Rouen
- Directeur publication : Benjamin Bel
- Contact : `contact@kovas.fr`
- Hébergeur web : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA (puis Paris pour kovas.fr)
- Hébergeur DB : Supabase Inc., eu-west-3 (Paris)
- Marque déposée : KOVAS, dépôt INPI n°<numéro Task 0.3>
- Propriété intellectuelle : œuvres du site protégées droit d'auteur

Save : `docs/legal/mentions-legales.md`

### Step 6 : Template DPA B2B (Data Processing Agreement)

Pour clients pro (cabinets B2B, notaires, agences) qui demandent un DPA dédié :

- Définitions (Responsable de traitement = client, Sous-traitant = KOVAS)
- Catégories de données traitées (noms clients, adresses biens, données techniques DPE)
- Personnes concernées (clients finaux du diagnostiqueur)
- Mesures techniques + organisationnelles (mêmes que politique confidentialité)
- Notification de violations < 72h
- Audit possible 1x/an (sur préavis 30j)
- Sous-traitants ultérieurs (liste cf. CLAUDE.md §19)
- Durée + sort des données fin de contrat (effacement 30j)

Génération PDF self-serve dans Settings KOVAS via DocuSeal (cf. Task ultérieure).

Save : `docs/legal/DPA-template.md`

### Step 7 : Charte Bêta-Testeurs

Document signé à l'entrée du programme bêta M6 (cf. CLAUDE.md §17).

Couvrir :

- Engagement KOVAS : accès gratuit M6-M7 + Découverte 29€ M7-M9 + tarif Founder Standard 49€ à vie M9+ + Cabinet Phase 2 Founder 169€ à vie + badge Founder + accès anticipé Phase 2 + influence directe roadmap
- Engagement Bêta-Testeur : min 10 missions réelles + remontée 1-2 bugs/sem + 1 visio mensuelle 30 min + accord citation témoignage (opt-in) + pas de partage d'accès
- Confidentialité (NDA simple) : ne pas divulguer publiquement features non encore lancées
- Données : RGPD-conforme, anonymisation possible
- Résiliation : KOVAS peut résilier Founder status si Bêta-Testeur ne respecte pas engagement (procédure 30j contradictoire)

Save : `docs/legal/charte-beta-testeurs.md`

### Step 8 : Relecture critique + cross-check

- Comparer chaque document à templates Captain Contrat / Yagoo / Legalstart pour gaps
- Identifier sections nécessitant attention avocat Vague 2 (M9+) — typiquement :
  - CGU clauses spécifiques diag immobilier (responsabilité IA Vision Phase 2)
  - DPA clauses sous-traitants critiques (Anthropic/OpenAI US transferts)
  - Charte bêta clauses Founder tarif à vie (engagement contractuel fort)

Marquer ces sections avec `<!-- AVOCAT VAGUE 2 : VALIDER -->` pour audit ciblé futur.

## Files to Create

- `docs/legal/CGU.md`
- `docs/legal/CGV.md`
- `docs/legal/RGPD-confidentialite.md`
- `docs/legal/politique-cookies.md`
- `docs/legal/mentions-legales.md`
- `docs/legal/DPA-template.md`
- `docs/legal/charte-beta-testeurs.md`
- `docs/legal/relecture-checklist.md` (sections à valider avocat Vague 2)

## Files to Modify

- `docs/credentials-setup.md` : ajouter section "Documents légaux" avec liens vers 7 fichiers

## Contracts

### Provides (for downstream tasks)

- **Liens vers documents légaux** : à intégrer dans le site kovas.fr footer (Task 5.1)
- **Template Charte Bêta-Testeurs** : à signer via DocuSeal au signup bêta (Task 6.1)
- **Template DPA B2B** : à signer self-serve via Settings (Task ultérieure Phase 6+)

## Acceptance Criteria

- [ ] 7 documents générés via Claude Max + relecture critique fondateur
- [ ] Conformité RGPD vérifiée (sous-traitants documentés, droits exercice clair)
- [ ] Conformité CNIL cookies (refuser aussi simple qu'accepter)
- [ ] Sections nécessitant validation avocat Vague 2 marquées `<!-- AVOCAT VAGUE 2 -->`
- [ ] Mentions légales référencent numéro dépôt INPI KOVAS (Task 0.3)

## Testing Protocol

### Validation manuelle

- Relecture critique fondateur (notamment CGU + CGV)
- Cross-check vs templates Captain Contrat / Yagoo (identifier gaps)
- Confirmer cohérence inter-documents (sous-traitants identiques entre RGPD + DPA)

### Workflow signature DocuSeal

- À implémenter Task ultérieure : Charte bêta + DPA générés PDF + envoyés via DocuSeal pour signature

## Skills to Read

- `kovas-defense-strategy` (cohérence stratégie défensive — pas de mention publique Liciel dans CGU)

## Research Files to Read

- `research/stripe-facturx-signature.md` §13 (archivage légal 10 ans)
- `research/supabase-architecture.md` §9 (RGPD compliance sous-traitants)

## Git

- Branch : `feature/0-4-docs-legaux-ia-first`
- Commit message prefix : `Task 0.4:`

## Notes anti-pattern

- ⛔ Ne PAS copier-coller templates Captain Contrat sans adaptation métier diag immobilier
- ⛔ Ne PAS citer Liciel ou un concurrent par son nom dans les CGU/CGV (defense strategy)
- ⛔ Ne PAS oublier la liste des sous-traitants RGPD (mise à jour vivante à chaque ajout service)
- ⛔ Ne PAS skipper la validation visuelle bandeau cookies "refuser aussi simple qu'accepter" (sanction CNIL si non-conforme)
- ⛔ Ne PAS skipper le marquage `<!-- AVOCAT VAGUE 2 -->` sur sections sensibles (sinon audit Vague 2 plus long et plus cher)
