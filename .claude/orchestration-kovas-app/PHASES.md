# KOVAS App — Implementation Phases

**Target** : Lancement public M9 (septembre-octobre 2026)
**Execution** : Phases séquentielles, agents Claude Code en pair-programming + parallélisation où possible
**Authority** : [`CLAUDE.md`](../../CLAUDE.md) (racine) > [`DISCOVERY.md`](DISCOVERY.md) > ce PHASES.md > recherches

---

## Scope Constraints (cf. CLAUDE.md §3 + features-roadmap.md)

**OUT of scope MVP V0.5 Phase 1** (reportés V2/V3 ou Phase 2-3) :

- ❌ Vision IA reconnaissance équipement (V2 M12-M18)
- ❌ Croquis IA depuis photo panoramique (V3)
- ❌ Génération recommandations post-DPE F/G auto (V2)
- ❌ Scan LiDAR iPad Pro 3D (V3+ ou jamais)
- ❌ Assistant IA conversationnel métier (Phase 3 M19+)
- ❌ Marketplace MAR/RGE (Phase 3)
- ❌ Multi-utilisateurs cabinet (V2)
- ❌ Signature eIDAS Yousign en pack mensuel (option ponctuelle 2€/sig uniquement)
- ❌ Télémètres BLE (V2)
- ❌ Module audit énergétique (Phase 3)
- ❌ API publique (Phase 2)
- ❌ Espace pro B2B (V2)
- ❌ Module DPE certifié ADEME (Phase 2 M10-M18)
- ❌ Modules amiante/plomb/gaz/élec/termites (Phase 2)
- ❌ Génération PDF native avancée (Phase 2)
- ❌ Drones/IoT (V3)
- ❌ Phase 4 Field Compliance OS extension (M30+)

**ATTENTION** : reproduire ces features dans le MVP = scope creep critique.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Frontend mobile | React Native + Expo SDK 52 (ou latest stable) + TypeScript strict |
| Mobile UI | NativeWind 4 + expo-blur + Lucide RN + @shopify/react-native-skia |
| Mobile state | Zustand + TanStack Query + react-native-mmkv |
| Mobile camera | react-native-vision-camera 4 (HEIF, frame processors) |
| Mobile audio | expo-audio (replace expo-av) |
| Mobile DB offline | op-sqlite + Drizzle ORM + sync custom layer |
| Mobile routing | expo-router 4 |
| Frontend web | Next.js 15 App Router + TypeScript strict |
| Web UI | Tailwind CSS + shadcn/ui + Lucide React + next-themes + next-intl |
| Web animation | Framer Motion + Recharts |
| Backend | Supabase (PG + Auth + Storage + Realtime + Edge Functions + RLS) — eu-west-3 Paris |
| AI Voice | OpenAI Whisper `gpt-4o-mini-transcribe` (primary) + Deepgram Nova-3 Frankfurt (fallback) + iOS SFSpeechRecognizer (offline) |
| AI Text | Anthropic Claude Haiku 4.5 (voice structuration, chatbot) + Sonnet 4.6 (cas complexes Phase 2) |
| Payments | Stripe Billing (SEPA priorité + CB fallback + Stripe Tax) |
| Emails | Resend |
| SMS | Brevo SMS (~0.06€/SMS) |
| Signature | DocuSeal self-hosted Railway (SES) + Yousign ponctuel 2€/sig (eIDAS) |
| Liciel bridge | Microservice Java/Jackcess (Linux Railway primary) + Hetzner Windows VM (conditionnel) |
| Hosting web | Vercel (Paris) |
| Hosting mobile | Expo EAS (builds + OTA) |
| DNS/CDN | Cloudflare |
| CI/CD | GitHub Actions |
| Monitoring | Sentry + PostHog |
| Email pro | Google Workspace Business Starter |
| Comptable | FEC standard + Pennylane M24+ (PDP) |

---

## Skills Reference

> Skills à créer en Phase 7 m2c1 si décidée. Dans le contexte sprint MVP solo, ces skills sont des documents techniques internes plutôt que des skills Claude Code formels.

| Skill | Use When |
|---|---|
| `kovas-supabase-rls` | Toute task touchant aux RLS multi-tenant ou schéma DB |
| `kovas-mobile-offline-sync` | Toute task touchant sync mobile/web ou queue offline |
| `kovas-claude-api` | Tout appel Claude API (voice structuration, chatbot, Phase 2+) |
| `kovas-whisper-api` | Tout appel Whisper API ou pipeline transcription |
| `kovas-liciel-bridge` | Toute task touchant export ZIP Liciel ou Imports spécifiques |
| `kovas-stripe-billing` | Toute task touchant Stripe subscriptions ou métering |
| `kovas-design-system` | Toute task touchant composants UI (web ou mobile) |
| `kovas-playwright-testing` | Toute task d'e2e testing UI |

---

## Tools Reference

| Server/Tool | Use For | Key Operations |
|---|---|---|
| **Claude_in_Chrome MCP** | Browser testing local + production + outreach LinkedIn | navigate, click, fill, read, screenshot, console, network |
| **Claude_Preview MCP** | Preview Next.js dev server | preview_start, preview_screenshot, preview_click |
| **Supabase CLI** | Migrations + Edge Functions + Branching | `supabase migration new`, `supabase db push`, `supabase functions deploy` |
| **GitHub CLI (`gh`)** | PRs, branches, Actions | `gh pr create`, `gh run watch` |
| **Expo CLI / EAS CLI** | Build mobile + OTA | `eas build`, `eas update`, `expo run:ios` |
| **Vercel CLI** | Web deploy preview + prod | `vercel`, `vercel --prod` |
| **Stripe CLI** | Webhook testing local | `stripe listen`, `stripe trigger` |
| **mdb-tools (CLI Linux)** | Read `.mdb` Liciel fixtures | `mdb-schema`, `mdb-tables`, `mdb-export` |
| **Jackcess (Java)** | Write `.mdb` Jet 4.0 | DatabaseBuilder + TableBuilder via microservice Java |
| **pnpm** | Monorepo workspace | `pnpm install`, `pnpm -F mobile dev`, `pnpm -F web dev` |
| **GPG signing** | Repo `kovas-discovery-log` (defense strategy) | `git commit -S` |

---

## Testing Methods

| Method | Tool | Description |
|---|---|---|
| Unit tests | Vitest / Jest | Service, utility, hook tests |
| Integration tests | Vitest + Supabase test client | DB + Edge Functions + RLS |
| Browser testing (local) | Claude_in_Chrome MCP / Playwright | Navigate localhost dev server, test UI flows |
| Browser testing (live) | Claude_in_Chrome MCP / Playwright | Navigate staging.kovas.fr / kovas.fr for regression |
| Mobile testing (sim) | Expo iOS Simulator + Detox | Test capture flow, voice, croquis, offline |
| Mobile testing (real device) | TestFlight + manual | Test Apple Pencil, BLE (V2+), camera quality |
| API testing | curl / Bruno / Insomnia | Edge Functions + REST endpoints |
| Stripe webhook testing | Stripe CLI `stripe listen` | Subscription lifecycle events |
| Sentry verification | Sentry dashboard | Crash-free rate, error rate |
| PostHog verification | PostHog dashboard | Funnel signup → activation → conversion |
| Liciel import verification | VM Windows + Liciel V4 démo | Import ZIP KOVAS → confirm 100% champs reconnus |
| Voice precision validation | 30+ clips diag jargon test | Pipeline Whisper + Claude ≥ 93% précision |
| Photo precision validation (V2) | 200 photos terrain réelles | Vision IA ≥ 85% global pondéré |

---

## Phase Overview

| Phase | Goal | Période | Tasks |
|---|---|---|---|
| **0** : Pre-sprint setup | Comptes services + D-U-N-S + INPI + recrutement advisor + corpus Liciel + 50 entretiens | M0-M5 (en parallèle) | 9 |
| **1** : Foundation | Monorepo + Supabase + design system + CRUD missions/clients/biens + auto-complétion adresse | Sprint J1-J3 | 5 |
| **2** : Field capture mobile | Photos géolocalisées + saisie vocale Whisper + structuration Claude | Sprint J4-J6 + checkpoint J7 | 5 |
| **3** : Croquis + Sync + Offline | Croquis 2D Apple Pencil + dashboard web + Realtime + offline complet | Sprint J8-J10 | 4 |
| **4** : Exports + Stripe | Export multi-format + ZIP Liciel + Stripe 4 tiers + widget transparence | Sprint J11-J13 | 5 |
| **5** : Build prod + onboarding bêta | Deploy Vercel + EAS + TestFlight + 10 bêta-testeurs initiaux | Sprint J14 | 3 |
| **6** : Bêta validation | Phase A gratuite (M6-M7) puis Phase B 29€ (M7-M9) + 30-50 bêta-testeurs + remontée bugs | M6-M9 | 4 |
| **7** : Lancement public + V1 polish | Ouverture inscription publique + 3 assets com de crise + KB 50 articles + V1 polish (streaks, plafond, etc.) | M9-M12 | 6 |
| **8** : E2E Comprehensive Testing | Multi-angle e2e sur live software, edge cases, perf, regression | Continu post-launch + M11 audit | 4 |
| **Total** | | | **45** |

---

## Phase 0 : Pre-sprint setup (M0-M5)

**Goal** : Avoir tous les comptes, accès, données et personnes en place pour démarrer le Sprint MVP 14j sans friction.

### Task 0.1 : Création comptes services M0
- **Objective** : Ouvrir les 12 comptes services impératifs M0 (Anthropic, OpenAI, Stripe, Supabase Free, GitHub, Resend, Vercel, Expo EAS, Railway, Cloudflare, Google Workspace, D-U-N-S)
- **Dependencies** : None
- **Blocked by** : Aucune
- **Files** : `.env.example` (template variables), `docs/credentials-setup.md` (manuel)
- **Contracts** : Variables d'environnement standardisées (préfixes `KOVAS_`, `SUPABASE_`, `ANTHROPIC_`, etc.)
- **Acceptance Criteria** :
  - [ ] 12 comptes créés sous Nexus 1993 (facturation)
  - [ ] Variables d'env documentées dans `.env.example`
  - [ ] D-U-N-S Dun & Bradstreet demandé (5-15j délai, déclencheur Apple Dev)
  - [ ] Email pro `benjamin@kovas.fr`, `contact@kovas.fr`, `support@kovas.fr` opérationnels (Google Workspace)
  - [ ] DNS kovas.fr pointant Cloudflare (records A/CNAME)
- **Testing** : Test API call sur chaque service avec `curl` ou SDK pour vérifier auth
- **Skills** : aucune (manuel + Claude_in_Chrome MCP)

### Task 0.2 : Apple Developer + Google Play (M1)
- **Objective** : Enrollment Apple Developer Program (après réception D-U-N-S) + Google Play Developer
- **Dependencies** : Task 0.1 (D-U-N-S reçu)
- **Files** : `apps/mobile/ios/Info.plist` (bundle ID `com.nexus1993.kovas`), `apps/mobile/app.json` (Expo config)
- **Acceptance Criteria** :
  - [ ] Apple Developer Program enrolled sous Nexus 1993 (~95€/an)
  - [ ] Google Play Developer ($25 lifetime)
  - [ ] Bundle ID iOS réservé : `com.nexus1993.kovas`
- **Testing** : Login App Store Connect + Google Play Console réussi
- **Skills** : aucune

### Task 0.3 : INPI dépôt marque KOVAS (M1)
- **Objective** : Dépôt marque KOVAS classes 9 (logiciels) + 42 (SaaS)
- **Dependencies** : None
- **Files** : `docs/legal/inpi-deposit-kovas.pdf` (récépissé), `docs/legal/marque-strategy.md`
- **Acceptance Criteria** :
  - [ ] Recherche antériorité préalable via Claude sur TMview + data.inpi.fr + WIPO
  - [ ] Dépôt INPI DIY classes 9 + 42 (~300€ frais INPI)
  - [ ] Récépissé archivé
- **Testing** : Recherche TMview confirme absence d'antériorité bloquante
- **Skills** : `kovas-defense-strategy` (cohérence avec marque + IP)

### Task 0.4 : Documents légaux IA-first (M1-M5)
- **Objective** : Générer via Claude Max tous les documents légaux requis (Vague 1 du plan juridique)
- **Dependencies** : Task 0.1 (Google Workspace pour email contact)
- **Files** :
  - `docs/legal/CGU.md`
  - `docs/legal/CGV.md`
  - `docs/legal/RGPD-confidentialite.md`
  - `docs/legal/politique-cookies.md`
  - `docs/legal/mentions-legales.md`
  - `docs/legal/DPA-template.md` (B2B clients pro)
  - `docs/legal/charte-beta-testeurs.md`
- **Acceptance Criteria** :
  - [ ] 7 documents générés via Claude Max + relecture fondateur
  - [ ] Conformité RGPD vérifiée (CNIL guidance)
  - [ ] DPA signable self-serve via DocuSeal Phase 5 sprint
- **Testing** : Relecture critique + comparaison avec templates Captain Contrat / Yagoo pour identifier gaps
- **Skills** : `kovas-defense-strategy`

### Task 0.5 : 50 entretiens découverte LinkedIn + ADEME (M0-M5)
- **Objective** : Conduire 50 entretiens découverte avec diagnostiqueurs FR pour valider le pitch, le pricing, les features et identifier 3-5 candidats advisor
- **Dependencies** : Task 0.1 (LinkedIn Premium Business)
- **Files** :
  - `docs/discovery/entretiens-decouverte.md` (compte-rendus structurés)
  - `agents/linkedin-outreach/` (Playwright agent + Claude API personnalisation)
- **Acceptance Criteria** :
  - [ ] Annuaire ADEME ministère scrapé via Playwright (~13 000 diagnostiqueurs avec coords + SIRET)
  - [ ] 50 entretiens conduits (30 min chacun, semi-structuré)
  - [ ] Compte-rendus structurés dans Supabase + Notion
  - [ ] **3-5 candidats advisor identifiés** (M3-M4) avec critères profil cohérents (10+ ans, Liciel maîtrisé, influence métier)
- **Testing** :
  - Métrique : taux réponse outreach ≥ 5% (50 RDV sur 1 000 messages envoyés)
  - Métrique : taux complétion entretien ≥ 90%
- **Skills** : aucune

### Task 0.6 : Recrutement advisor diagnostiqueur (M3-M5)
- **Objective** : Recruter 1 advisor diagnostiqueur senior selon les termes 0,5-1% BSPCE vesting 2 ans cliff 6 mois
- **Dependencies** : Task 0.5 (candidats identifiés)
- **Files** :
  - `docs/legal/contrat-advisor-template.md`
  - `docs/team/advisor-onboarding.md`
- **Acceptance Criteria** :
  - [ ] Contrat advisor signé (BSPCE 0,5-1%, vesting 2 ans, cliff 6 mois)
  - [ ] Onboarding planifié M5-M6 (lecture PRD + démo bêta)
  - [ ] Citation publique "Senior Advisor KOVAS" sur kovas.fr + LinkedIn officiel programmée M6
- **Testing** : Contrat relu par Claude Max + comparaison templates Galion Project / France Digitale
- **Skills** : aucune

### Task 0.7 : Acquisition fixtures Liciel + journal découverte GPG (M1-M3)
- **Objective** : Construire corpus de 25-50 exports Liciel anonymisés pour validation parser KOVAS + setup repo `kovas-discovery-log` avec GPG
- **Dependencies** : Task 0.5 (3 diagnostiqueurs partenaires identifiés)
- **Files** :
  - Repo séparé `kovas-discovery-log` (GitHub privé Nexus 1993, GPG signing activé)
  - `docs/legal/contrat-prestation-diagnostiqueur-template.md`
  - `agents/anonymization/anonymize-liciel-export.py` (script anonymisation)
- **Acceptance Criteria** :
  - [ ] Repo `kovas-discovery-log` créé, GPG signing testé (`git commit -S` réussi)
  - [ ] Démo Liciel V4 téléchargée légitimement par Benjamin (étape 1)
  - [ ] 3 diagnostiqueurs partenaires sous NDA + contrat 100-200€/personne
  - [ ] 25-50 exports ZIP Liciel anonymisés collectés couvrant 10 variantes critiques
  - [ ] Script anonymisation versionné + tests sur 5 cas
  - [ ] Licence Liciel 1 mois achetée par Benjamin Bel conditionnelle (étape 3, si étape 1+2 insuffisants)
- **Testing** :
  - Pour chaque export : `mdb-schema` + `mdb-tables` + `mdb-export` réussissent sans erreur
  - Script anonymisation : zéro PII résiduel détectable
- **Skills** : `kovas-liciel-bridge`, `kovas-defense-strategy`

### Task 0.8 : 3 assets com de crise + runbook bascule Liciel (M2-M5)
- **Objective** : Préparer la communication de crise et le runbook de bascule d'urgence avant lancement bêta
- **Dependencies** : Task 0.4 (documents légaux)
- **Files** :
  - `docs/crisis-comms/page-pourquoi-kovas.md` (à publier kovas.fr lancement)
  - `docs/crisis-comms/faq-technique-liciel.md` (à publier kovas.fr lancement)
  - `docs/crisis-comms/communique-presse-reponse.md` (template à activer si attaque)
  - `docs/runbooks/liciel-bascule-urgence.md` (procédure 5 étapes)
- **Acceptance Criteria** :
  - [ ] 3 assets pré-rédigés et stockés (publiables en 1 clic)
  - [ ] Runbook bascule documenté avec feature flag PostHog opérationnel
  - [ ] Canal `juridique@kovas.fr` opérationnel (Google Workspace)
- **Testing** : Simulation de bascule à blanc en Sprint 6 (test runbook)
- **Skills** : `kovas-defense-strategy`

### Task 0.9 : Hiscox RC Pro + extension PI souscrite (M5)
- **Objective** : Souscrire la RC Pro Hiscox avec extension PI obligatoire avant lancement bêta
- **Dependencies** : Tasks 0.1-0.8 (entreprise prête à exposer un produit aux utilisateurs externes)
- **Files** : `docs/legal/hiscox-police-rc-pro.pdf`, `docs/legal/assurance-summary.md`
- **Acceptance Criteria** :
  - [ ] Pack Hiscox RC Pro Numérique + Cyber souscrit sous Nexus 1993
  - [ ] **Extension PI obligatoire** (+200-400€/an) confirmée dans la police
  - [ ] Plafonds : 500k€/sinistre, 1M€/an
  - [ ] Sous-couvertures : cyber 500k€, RGPD 50k€, défense juridique 100k€, erreurs IA explicite, litiges IP 100k€
  - [ ] Prime totale ~900€/an, prélèvement Qonto Nexus 1993
- **Testing** : Lecture détaillée police, vérification présence des sous-couvertures listées
- **Skills** : `kovas-defense-strategy`

### Task 0.R : Phase 0 Regression
- **Objective** : Vérification finale que toute l'infrastructure non-tech est en place avant le Sprint MVP 14j
- **Dependencies** : Tasks 0.1-0.9 complétés
- **Testing** :
  - [ ] Checklist 9 tâches : tous les items "DONE"
  - [ ] Apple Developer + Google Play : login dashboards réussi
  - [ ] D-U-N-S reçu et archivé
  - [ ] 50 entretiens : Notion à jour
  - [ ] Advisor : contrat signé
  - [ ] Corpus Liciel : ≥ 25 exports anonymisés disponibles
  - [ ] 3 assets com de crise + runbook : drafts finaux
  - [ ] Hiscox : police active

---

## Phase 1 : Foundation (Sprint J1-J3)

**Goal** : Monorepo en place + Supabase configuré + design system + CRUD missions/clients/biens + auto-complétion adresse opérationnels.

### Task 1.1 : Setup monorepo pnpm + workspaces (J1)
- **Objective** : Créer le monorepo pnpm avec apps/mobile, apps/web, packages/{shared,database,ai,liciel-bridge}, services/mdb-writer
- **Dependencies** : Task 0.1 (GitHub repo créé)
- **Files** : `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `.env.example`, `.gitignore`, branch `main` protégée
- **Contracts** :
  - Convention nommage packages : `@kovas/<name>`
  - TypeScript strict partout, zéro `any`
- **Acceptance Criteria** :
  - [ ] `pnpm install` réussit sans erreur
  - [ ] `pnpm -r run typecheck` passe (zéro `any`)
  - [ ] Branch `main` protégée (1 review minimum, CI verte)
  - [ ] GitHub Actions CI base : lint + typecheck sur PR
- **Testing** :
  - [ ] `pnpm install` réussit
  - [ ] `pnpm -F @kovas/shared run typecheck` passe
- **Skills** : aucune

### Task 1.2 : Supabase setup + auth + schéma multi-tenant (J1)
- **Objective** : Créer le projet Supabase eu-west-3 Paris + auth Email+Password + Magic Link + schéma initial 14 tables avec RLS multi-tenant
- **Dependencies** : Task 1.1 (monorepo prêt)
- **Files** :
  - `supabase/migrations/20260518000000_init_schema.sql` (14 tables + RLS + triggers audit)
  - `supabase/seed.sql` (données dev)
  - `packages/database/client.ts` (Supabase client typé)
  - `packages/database/types.ts` (généré via `supabase gen types`)
- **Contracts** :
  - Toutes les tables business ont `organization_id uuid NOT NULL`
  - RLS policies via `auth.is_member_of(p_org uuid)` SECURITY DEFINER helper
  - Audit trigger `audit_table_changes()` sur toutes les business tables
- **Acceptance Criteria** :
  - [ ] Projet Supabase `kovas-prod` créé eu-west-3
  - [ ] 14 tables créées avec RLS activé : organizations, profiles, memberships, clients, properties, missions, mission_rooms, equipment_findings, voice_notes, sketches, photos, quotes, invoices, events, ai_usage, jobs, reference_counters
  - [ ] Auth Email+Password + Magic Link configuré + custom SMTP Resend
  - [ ] `auth.is_member_of()` SECURITY DEFINER helper créé
  - [ ] Audit trigger `audit_table_changes()` actif sur missions, clients, properties, invoices, quotes, equipment_findings
  - [ ] Trigger anti-mutation events table actif
- **Testing** :
  - [ ] Login E2E via Claude_in_Chrome ou Playwright (signup + magic link)
  - [ ] RLS test : user A ne peut pas voir missions de user B (différent organization_id)
  - [ ] Audit log : INSERT mission crée un event dans `events` table
- **Skills** : `kovas-supabase-rls`
- **Research** : `research/supabase-architecture.md` §2-3

### Task 1.3 : Design system complet (J2)
- **Objective** : Implémenter design tokens NativeWind 4 + shadcn/ui base + 30+ composants signature + Manrope chargée + thèmes light/dark avec auto-switch
- **Dependencies** : Task 1.1 (monorepo)
- **Files** :
  - `packages/shared/design-tokens.ts` (palette light/dark + radii + shadows + spacing)
  - `apps/mobile/tailwind.config.js` (NativeWind tokens)
  - `apps/web/tailwind.config.js`
  - `apps/web/src/components/ui/*` (shadcn base 30+ composants)
  - `apps/mobile/src/components/*` (composants RN équivalents)
  - `apps/web/src/app/(showcase)/storybook/page.tsx` (Storybook simple inline)
- **Contracts** :
  - Tokens nommés : `bg-card`, `text-primary`, `text-secondary`, `border-subtle`, `cta-bg`, `cta-bg-hover`
  - Composants : Card, Button (3 variantes), Input, Pill, Avatar, Sidebar, BlurOverlay, KPISemiCircle, EmptyState, Toast, Modal, DataTable, Form (RHF + Zod)
- **Acceptance Criteria** :
  - [ ] Palette light/dark identique CLAUDE.md §9
  - [ ] Manrope chargée web (`next/font/google`) + mobile (`expo-font`)
  - [ ] 30+ composants implémentés et utilisables
  - [ ] Storybook simple accessible localhost:3000/storybook (toggle dark mode visible)
  - [ ] Border-radius cohérents (16-24px cartes, 12px boutons, 100px pills)
  - [ ] `backdrop-blur-md` opérationnel sur overlays
- **Testing** :
  - [ ] Playwright : toggle light/dark fonctionne sur Storybook
  - [ ] Screenshots avant/après dark mode pour 5 composants clés
- **Skills** : `kovas-design-system`

### Task 1.4 : CRUD missions/clients/biens + auto-complétion adresse BAN/IGN/Géorisques (J3)
- **Objective** : Implémenter le CRUD complet missions/clients/biens côté mobile et web, avec auto-complétion adresse BAN, récupération cadastre IGN, ERP Géorisques + validation SIRET INSEE
- **Dependencies** : Tasks 1.2 (DB), 1.3 (composants UI)
- **Files** :
  - `packages/database/queries/missions.ts`, `clients.ts`, `properties.ts`
  - `packages/shared/services/ban.ts` (API BAN)
  - `packages/shared/services/cadastre.ts` (API IGN)
  - `packages/shared/services/georisques.ts` (API Géorisques)
  - `packages/shared/services/insee-sirene.ts` (API Sirene)
  - `apps/web/src/app/missions/page.tsx`, `apps/web/src/app/missions/[id]/page.tsx`
  - `apps/mobile/src/app/(missions)/index.tsx`, `apps/mobile/src/app/(missions)/[id]/index.tsx`
- **Contracts** :
  - Type `Mission` shared package (cf. schéma 1.2)
  - Auto-complétion BAN debounced 300ms
  - Cadastre récupéré async post-création mission (job queue)
- **Acceptance Criteria** :
  - [ ] CRUD missions/clients/biens fonctionnel mobile + web
  - [ ] Auto-complétion adresse BAN : 5+ suggestions par requête, sélection auto-fill (adresse, code postal, ville, INSEE)
  - [ ] Cadastre IGN : récupération parcelle + surface + année construction (si dispo)
  - [ ] ERP Géorisques : récupération risques (sismique, radon, inondation, etc.)
  - [ ] Validation SIRET INSEE Sirene au signup utilisateur (anti-abus essai)
- **Testing** :
  - [ ] 5 missions créées avec adresses variées (Paris, rural, île)
  - [ ] Validation cadastre OK sur ≥ 80% des cas (échec acceptable sur adresses récentes/atypiques)
  - [ ] E2E Playwright : signup → SIRET validation → création mission → cadastre récupéré
- **Skills** : `kovas-supabase-rls`
- **Research** : `research/supabase-architecture.md` §3

### Task 1.R : Phase 1 Regression
- **Objective** : Vérifier l'ensemble Phase 1 fonctionne end-to-end
- **Dependencies** : Tasks 1.1-1.4
- **Testing** :
  - [ ] Deploy preview Vercel
  - [ ] Test signup full → création organisation auto → création mission → cadastre auto
  - [ ] RLS test : 2 users dans 2 orgs différentes ne voient pas les missions de l'autre
  - [ ] Sentry : 0 errors sur 30 minutes d'usage manuel
  - [ ] PostHog : events principaux trackés (signup, mission_created)
  - [ ] Screenshot des écrans clés

---

## Phase 2 : Field capture mobile (Sprint J4-J6 + checkpoint J7)

**Goal** : Photos géolocalisées + saisie vocale Whisper + structuration Claude fonctionnels sur iPad/iPhone.

### Task 2.1 : Setup mobile EAS dev client + Vision Camera + Skia (J4 matin)
- **Objective** : Setup Expo dev client (no Expo Go) + Vision Camera 4 + Skia + permissions iOS
- **Dependencies** : Tasks 0.2 (Apple Developer), 1.1 (monorepo)
- **Files** : `apps/mobile/app.json` (config), `apps/mobile/ios/Info.plist` (permissions strings FR), `eas.json` (build profiles)
- **Acceptance Criteria** :
  - [ ] EAS Build dev client iOS opérationnel
  - [ ] Vision Camera 4 + Skia + ble-plx + MMKV installés (dev client requis)
  - [ ] Permissions iOS justifiées (Camera, Microphone, Photo Library, Location, Bluetooth) — strings FR
  - [ ] Bundle ID : `com.nexus1993.kovas`
- **Testing** :
  - [ ] Build EAS dev client réussit
  - [ ] App s'installe sur iPad Pro physique de Benjamin
- **Skills** : `kovas-mobile-offline-sync` (config foundations)

### Task 2.2 : Photos géolocalisées + annotations Apple Pencil (J4)
- **Objective** : Capture photos via Vision Camera 4 + EXIF GPS auto + upload Supabase Storage + annotations Apple Pencil via Skia
- **Dependencies** : Task 2.1 (Vision Camera + Skia)
- **Files** :
  - `apps/mobile/src/features/photos/CapturePhoto.tsx`
  - `apps/mobile/src/features/photos/AnnotatePhoto.tsx` (Skia canvas)
  - `apps/mobile/src/features/photos/usePhotoUpload.ts` (Supabase Storage)
  - `supabase/functions/image-thumb/index.ts` (génération 256px + 1024px à l'upload)
- **Contracts** :
  - Photo HEIF originale + JPEG 1024px preview
  - Path Supabase : `photos/{org_id}/{mission_id}/{photo_id}.heic` + `.thumb.jpg`
  - EXIF GPS + timestamp + watermark mission_id en bas-droite
- **Acceptance Criteria** :
  - [ ] Capture photo HEIF (12MP iPad Pro M2)
  - [ ] EXIF GPS auto-embedded
  - [ ] Preview JPEG 1024px généré device-side
  - [ ] Upload Supabase Storage avec préview-first cellular
  - [ ] Annotations Skia : cercle, flèche, texte (3 outils minimum)
  - [ ] Watermark mission_id + timestamp brûlé en bas-droite
- **Testing** :
  - [ ] 20 photos capturées + sync via Claude_in_Chrome MCP
  - [ ] EXIF GPS vérifié via `exiftool` sur 3 photos
  - [ ] Storage Supabase : structure path correcte
- **Skills** : `kovas-mobile-offline-sync`
- **Research** : `research/mobile-stack.md` §6

### Task 2.3 : Capture audio + upload Whisper API (J5)
- **Objective** : Capture audio m4a 16kHz mono + VAD trim + upload Edge Function + appel OpenAI Whisper `gpt-4o-mini-transcribe` + retour transcript FR
- **Dependencies** : Task 2.1
- **Files** :
  - `apps/mobile/src/features/voice/CaptureVoice.tsx` (UI mic-tap-record-tap-stop)
  - `apps/mobile/src/features/voice/useVoiceCapture.ts` (expo-audio)
  - `supabase/functions/transcribe-voice-note/index.ts` (Edge Function)
  - `packages/ai/whisper.ts` (wrapper OpenAI + fallback Deepgram)
  - `packages/ai/dictionaries/diag-fr.ts` (200 termes glossary)
- **Contracts** :
  - Audio capturé AAC m4a 16kHz mono 32kbps (~30s typique, 60s hard cap)
  - VAD trim client-side (silence < -40dB > 1.5s)
  - Upload via Edge Function (jamais API key exposée mobile)
  - Réponse : `{ transcript: string, provider: 'openai' | 'deepgram', latency_ms: number, cost_eur: number }`
- **Acceptance Criteria** :
  - [ ] 10 clips de 15s transcrits avec p95 < 5s end-to-end
  - [ ] Précision Whisper brut ≥ 88% sur dataset test 30 clips métier
  - [ ] Fallback Deepgram Nova-3 EU activé si OpenAI 5xx ou > 8s
  - [ ] VAD trim opérationnel (clip silencieux < 0.5s rejeté)
  - [ ] PostHog event `voice.transcribe.completed` instrumenté
- **Testing** :
  - [ ] 30 clips test métier (dictés par Benjamin) : précision ≥ 88%
  - [ ] Mode avion → enregistrement → reconnect → transcription effective
  - [ ] Coût moyen tracké < 0,02€/clip
- **Skills** : `kovas-whisper-api`
- **Research** : `research/whisper-transcription.md` complet

### Task 2.4 : Structuration vocale Claude + tool use (J6)
- **Objective** : Edge Function `structure-voice-note` Claude Haiku 4.5 + tool use Zod + diag glossary FR 200 termes en system prompt cached 1h + écriture champs mission
- **Dependencies** : Task 2.3 (transcript disponible)
- **Files** :
  - `supabase/functions/structure-voice-note/index.ts`
  - `packages/ai/claude.ts` (wrapper Anthropic SDK + caching)
  - `packages/ai/prompts/voice-structurer.ts` (system prompt cached 1h TTL)
  - `packages/ai/schemas/mission-fields.ts` (Zod schema → JSON schema tool)
- **Contracts** :
  - Tool `extract_mission_fields(surface_m2, nb_pieces, type_chauffage, annee_construction, observations, confidence: Record<string, number>)`
  - `tool_choice: { type: "tool", name: "extract_mission_fields" }` forcé
  - 1 retry sur Zod validation failure avec error feedback
- **Acceptance Criteria** :
  - [ ] Pipeline complet : audio → transcript Whisper → Claude structuration → champs mission écrits
  - [ ] Précision pipeline complet ≥ 93% sur dataset 30 clips métier
  - [ ] Prompt cache hit rate > 80% après 100 appels
  - [ ] PostHog event `voice.structure.completed` + `ai.claude.cost_eur`
- **Testing** :
  - [ ] 30 clips test → champs structurés vérifiés manuellement
  - [ ] Cas où transcript ambigu → Claude retourne `null` + `confidence: 0.X` (pas d'invention)
  - [ ] Coût moyen tracké < 0,001€/clip après caching
- **Skills** : `kovas-claude-api`
- **Research** : `research/anthropic-claude.md` §5, §12.1

### Task 2.5 : Checkpoint mi-parcours + démo terrain réelle (J7)
- **Objective** : Démo terrain réelle Benjamin sur 1 mission DPE complète (vocal + photos + structuration) — validation produit avant J8-J14
- **Dependencies** : Tasks 2.1-2.4
- **Files** : `docs/checkpoints/sprint-j7-checkpoint.md` (compte-rendu + vidéo Loom)
- **Acceptance Criteria** :
  - [ ] 1 mission DPE complète saisie sur le terrain (chez un ami / résidence parents / bien partenaire)
  - [ ] 15 photos capturées + 8 clips vocaux transcrits + champs mission remplis
  - [ ] Vidéo Loom 60s démontrant le flow
  - [ ] 5 issues identifiées notées dans Linear/GitHub Issues
  - [ ] Décision GO/NO-GO sur la suite du sprint (J8-J14)
- **Testing** :
  - [ ] Crash-free pendant la démo
  - [ ] PostHog tracks tous les events
  - [ ] Aucune fuite de PII dans Sentry/PostHog logs
- **Skills** : aucune

### Task 2.R : Phase 2 Regression
- **Objective** : Vérifier capture mobile end-to-end + pipeline IA opérationnels
- **Testing** :
  - [ ] 30 captures photos + 30 captures voice sur iPad Pro physique
  - [ ] p95 latence vocal < 5s confirmé
  - [ ] p95 latence photo upload < 3s sur 4G
  - [ ] Sentry : 0 crashes sur 1h d'usage continu
  - [ ] PostHog : funnel mission_created → photo_captured → voice_captured → mission_synthese visible

---

## Phase 3 : Croquis + Sync + Offline (Sprint J8-J10)

**Goal** : Croquis 2D Apple Pencil + symboles + calcul Carrez/Boutin + dashboard web + Realtime + offline complet.

### Task 3.1 : Croquis 2D Apple Pencil + symboles + Carrez/Boutin (J8)
- **Objective** : Skia canvas + strokes JSON + symboles pré-définis (porte, fenêtre, prise, radiateur, chaudière) + calcul automatique surface Carrez (vente) + Boutin (location)
- **Dependencies** : Task 2.1 (Skia setup)
- **Files** :
  - `apps/mobile/src/features/sketches/SketchCanvas.tsx` (Skia + Apple Pencil)
  - `apps/mobile/src/features/sketches/Symbols.tsx` (palette symboles)
  - `apps/mobile/src/features/sketches/surface-calc.ts` (Carrez + Boutin algos)
  - `packages/shared/sketch-types.ts` (Stroke, Symbol, SketchGeometry)
- **Contracts** :
  - Sketch geometry stockée JSONB : `{ strokes: [...], symbols: [...], walls: [...] }`
  - Calculs surface : algo polygon area + déductions (h < 1.80m exclu Boutin)
- **Acceptance Criteria** :
  - [ ] 5 symboles pré-définis (porte, fenêtre, prise, radiateur, chaudière)
  - [ ] Calcul Carrez auto (toutes surfaces fermées)
  - [ ] Calcul Boutin auto (exclusion < 1.80m sous plafond)
  - [ ] Précision dimensions ± 10cm sur pièces 10-30m² standards
  - [ ] Sauvegarde sketch JSONB dans `sketches` table
- **Testing** :
  - [ ] 5 croquis dessinés + surfaces calculées vérifiées manuellement
  - [ ] Précision ± 10cm validée sur 3 pièces réelles mesurées au télémètre
- **Skills** : `kovas-design-system`
- **Research** : `research/mobile-stack.md` §3

### Task 3.2 : Dashboard web + sync Realtime mobile↔web (J9)
- **Objective** : Dashboard web Next.js 15 (KPI semi-circles via Skia ou Recharts, missions du jour/semaine/mois, CA, marge) + Supabase Realtime subscription mobile + propagation temps réel
- **Dependencies** : Tasks 1.2, 1.3
- **Files** :
  - `apps/web/src/app/(dashboard)/page.tsx`
  - `apps/web/src/components/dashboard/KPISemiCircle.tsx`
  - `apps/web/src/components/dashboard/MissionsList.tsx`
  - `packages/shared/realtime/subscribe.ts` (Supabase Realtime wrapper)
- **Contracts** :
  - Realtime channel par mission : `mission:{mission_id}` (postgres_changes filter)
  - Propagation : mission créée iPad → visible web < 2s
- **Acceptance Criteria** :
  - [ ] Dashboard affiche KPI agrégés (missions complétées, CA mois, marge mois)
  - [ ] Mission créée iPad apparait Web < 2s
  - [ ] Photos uploadées iPad apparaissent dans gallery web < 3s
  - [ ] `REPLICA IDENTITY FULL` sur missions, photos, voice_notes
- **Testing** :
  - [ ] E2E Claude_in_Chrome MCP : 2 fenêtres ouvertes (mobile sim + web) → action mobile → propagation web
- **Skills** : `kovas-supabase-rls`
- **Research** : `research/supabase-architecture.md` §5

### Task 3.3 : Mode offline complet + queue mutations (J10)
- **Objective** : op-sqlite + Drizzle ORM + outbox + tombstones + LWW conflict resolution + auto-sync on reconnect
- **Dependencies** : Tasks 1.2, 2.2, 2.3, 3.1, 3.2
- **Files** :
  - `apps/mobile/src/lib/db/schema.ts` (Drizzle mirrors Supabase tables)
  - `apps/mobile/src/lib/db/sync-worker.ts` (outbox drain + reconnect handler)
  - `apps/mobile/src/lib/db/conflict-resolver.ts` (LWW logic)
- **Contracts** :
  - Outbox table : `id, op, table, row_id, payload, created_at, retries`
  - Conflict resolution : LWW par défaut, server `updated_at` arbitre
  - Backoff retry : 1s, 2s, 4s, 8s, 16s, 60s, 5min, 30min, 1h (cap 1h)
- **Acceptance Criteria** :
  - [ ] Mode avion → 5 missions créées + 30 photos + 10 voice notes → sync à reconnect sans perte
  - [ ] Conflit (mission modifiée mobile + web) → LWW résout via server updated_at
  - [ ] Backoff exponentiel implémenté
  - [ ] Stockage local plafonné : alerte < 500 MB, hard-stop captures < 100 MB
- **Testing** :
  - [ ] Test mode avion : 30 min usage offline + sync OK
  - [ ] Test conflit : modif mobile + web simultanée → résolution déterministe
  - [ ] Sentry : 0 erreur sync
- **Skills** : `kovas-mobile-offline-sync`
- **Research** : `research/mobile-stack.md` §2

### Task 3.R : Phase 3 Regression
- **Testing** :
  - [ ] 1h usage offline + reconnect → sync 100%
  - [ ] Realtime mobile↔web propagation OK sur 3 cas
  - [ ] Croquis 5 pièces validés au télémètre

---

## Phase 4 : Exports + Stripe (Sprint J11-J13)

**Goal** : Export multi-format (PDF + Word + CSV + JSON + ZIP Liciel) + Stripe 4 tiers + widget transparence + tests E2E Playwright.

### Task 4.1 : Exports PDF + Word + CSV + JSON (J11)
- **Objective** : Edge Functions générant 4 formats avec branding logo cabinet (footer "Essai KOVAS" si essai)
- **Dependencies** : Tasks 1.4, 2.x, 3.x
- **Files** :
  - `supabase/functions/export-pdf/index.ts` (pdf-lib)
  - `supabase/functions/export-docx/index.ts` (docx.js)
  - `supabase/functions/export-csv/index.ts`
  - `supabase/functions/export-json/index.ts`
  - `supabase/functions/export-unified/index.ts` (endpoint `/export/{format}`)
- **Contracts** :
  - Endpoint unifié : `POST /functions/v1/export?missionId=...&format=pdf|docx|csv|json`
  - PDF : conforme charte Glassmorphism (light only), Manrope embedded
  - Word : structuré pour copy-paste dans Liciel/concurrents
- **Acceptance Criteria** :
  - [ ] 4 missions test exportées dans 4 formats chacune (16 exports)
  - [ ] Branding logo cabinet sur PDF (sauf essai → "Essai KOVAS" footer)
  - [ ] Word importable dans Liciel pour vérification fields
- **Testing** :
  - [ ] Diff visuel PDF avant/après dark mode toggle UI (PDF doit rester en clair)
  - [ ] Word importable dans Word/Pages/LibreOffice
  - [ ] CSV ouvre dans Excel/Numbers correctement
- **Skills** : `kovas-design-system`

### Task 4.2 : Export ZIP Liciel — microservice Java/Jackcess + tests (J12)
- **Objective** : Microservice Java Jackcess sur Railway Linux génère `.mdb` Jet 4.0 + XML CII pour Imports spécifiques + assemblage ZIP via Node + tests sur fixtures Liciel
- **Dependencies** : Task 0.7 (corpus Liciel fixtures), Task 4.1
- **Files** :
  - `services/mdb-writer/src/main/java/fr/kovas/MdbWriterController.java`
  - `services/mdb-writer/build.gradle`
  - `services/mdb-writer/Dockerfile`
  - `supabase/functions/liciel-export-zip/index.ts` (Node orchestrator)
  - `packages/liciel-bridge/schema/liciel-schema.json` (single source of truth)
- **Contracts** :
  - Microservice Java endpoint : `POST /api/build-liciel-zip` (Bearer token)
  - Response : `application/zip`
  - ZIP structure : `LICIEL_Dossiers.mdb` + `Dossiers_2026/{nom}/*.xml` + `Photos/*`
- **Acceptance Criteria** :
  - [ ] Microservice Java déployé Railway Linux
  - [ ] 20+ exports ZIP générés
  - [ ] **Tests intégration Liciel** : 20/20 importés sans erreur dans Liciel V4 démo (sur VM Windows)
  - [ ] Tests parallèles **Piste A (Imports spécifiques XML/Excel)** : ≥ 5 imports XML réussis
  - [ ] Encoding CP1252 correct sur tests `Mathéu Çaño-Drüber-€`
- **Testing** :
  - [ ] Pour chaque fixture corpus : générer ZIP KOVAS → importer Liciel V4 → vérifier 100% champs reconnus
  - [ ] Diff `mdb-schema` KOVAS vs Liciel natif : structures alignées
  - [ ] CI nightly Liciel import régression configurée
- **Skills** : `kovas-liciel-bridge`, `kovas-defense-strategy`
- **Research** : `research/liciel-format.md` §4-7

### Task 4.3 : Stripe abonnements 4 tiers + métering + webhooks (J13 matin)
- **Objective** : 4 produits Stripe (Découverte 29€ / Standard 59€ / Volume 99€ / Cabinet 199€ Phase 2) + métering missions + webhook subscription.updated + page pricing kovas.fr
- **Dependencies** : Tasks 0.1 (Stripe account), 1.4 (CRUD missions)
- **Files** :
  - `supabase/functions/stripe-webhook/index.ts`
  - `supabase/functions/stripe-checkout/index.ts`
  - `supabase/functions/stripe-metering/index.ts` (rapport mission → Stripe metered usage)
  - `apps/web/src/app/pricing/page.tsx`
  - `packages/shared/stripe.ts`
- **Contracts** :
  - 4 produits Stripe avec métadonnées (`tier_name`, `included_missions`, `overage_price`)
  - Webhook idempotency via `stripe_webhook_events(event_id UNIQUE)`
  - Métering : à chaque mission complétée → POST Stripe `usage_records`
- **Acceptance Criteria** :
  - [ ] 4 produits Stripe créés en test mode + prod (clone)
  - [ ] Stripe Tax activé (TVA 20% FR)
  - [ ] SEPA + CB acceptés
  - [ ] Webhook subscription.updated → flip `organizations.plan_status`
  - [ ] Page pricing kovas.fr cohérente CLAUDE.md §4 + pricing-strategy.md
- **Testing** :
  - [ ] `stripe listen` local → trigger événements → DB mise à jour OK
  - [ ] Test signup → checkout → activation paying user en E2E Claude_in_Chrome MCP
- **Skills** : `kovas-stripe-billing`
- **Research** : `research/stripe-facturx-signature.md` §7-9

### Task 4.4 : Widget transparence + plafond + emails récap (J13 après-midi)
- **Objective** : Widget temps réel dashboard + plafond mensuel auto-protecteur + email récap mensuel transparent + email "Tu paies trop" auto
- **Dependencies** : Task 4.3
- **Files** :
  - `apps/web/src/components/billing/TransparencyWidget.tsx`
  - `apps/mobile/src/components/billing/TransparencyWidget.tsx`
  - `supabase/functions/cron-monthly-recap/index.ts` (28 du mois)
  - `supabase/functions/cron-tu-paies-trop/index.ts` (mensuel, scan dépassements)
- **Acceptance Criteria** :
  - [ ] Widget affiche live : `Ce mois : X missions • Y au-delà — Estimation : Z€`
  - [ ] Plafond configurable user : au-delà, branding KOVAS revient sur PDF
  - [ ] Email récap mensuel envoyé 28 du mois (cron pg_cron + Edge Function)
  - [ ] Email "Tu paies trop" déclenché si dépassement 3 mois consécutifs
- **Testing** :
  - [ ] Simulation 100 missions dans un compte test → widget reflète temps réel
  - [ ] Email rendu correct dans Gmail/Outlook (Resend test)
- **Skills** : `kovas-stripe-billing`

### Task 4.5 : Tests E2E Playwright complets (J13 soir)
- **Objective** : Suite E2E Playwright sur full flow signup → essai 14j → conversion → dépassement
- **Dependencies** : Toutes Phase 1-4
- **Files** : `tests/e2e/signup-flow.spec.ts`, `tests/e2e/mission-capture.spec.ts`, `tests/e2e/export-flow.spec.ts`, `tests/e2e/billing-flow.spec.ts`
- **Acceptance Criteria** :
  - [ ] 4 spec files E2E couvrant les 4 flux critiques
  - [ ] Suite passe à 100% sur preview Vercel
  - [ ] CI GitHub Actions : E2E sur chaque PR
- **Testing** :
  - [ ] Suite passe localement + sur CI
- **Skills** : `kovas-playwright-testing`

### Task 4.R : Phase 4 Regression
- **Testing** :
  - [ ] 4 exports formats × 4 missions test = 16 OK
  - [ ] 20 ZIP Liciel importés Liciel V4 sans erreur
  - [ ] Suite E2E Playwright 100%
  - [ ] Stripe webhook idempotency OK (replay event)

---

## Phase 5 : Build prod + onboarding bêta (Sprint J14)

**Goal** : Vercel deploy production kovas.fr + Expo EAS build iOS + TestFlight 10 bêta-testeurs invités + KB 20 articles publiés + onboarding emails séquence ready.

### Task 5.1 : Deploy production Vercel + Expo EAS iOS
- **Objective** : Production deploy web sur kovas.fr + build iOS production sur EAS + TestFlight invité 10 bêta-testeurs initiaux
- **Dependencies** : Toutes Phase 1-4
- **Files** : `vercel.json`, `eas.json` (production channel), `apps/mobile/app.json` (versioning 1.0.0)
- **Acceptance Criteria** :
  - [ ] kovas.fr deploy production (Vercel)
  - [ ] iOS build production EAS uploaded App Store Connect
  - [ ] TestFlight beta external 10 testeurs invités
  - [ ] App s'installe sur 5 iPads différents (modèles M1 / M2 / iPad 9th gen / iPad Air / iPhone 13+)
- **Testing** :
  - [ ] Smoke test sur prod : signup + 1 mission + export
  - [ ] Sentry source maps uploadées

### Task 5.2 : KB 20 articles publiés
- **Objective** : 20 articles KB rédigés via Claude + relecture + publiés site
- **Dependencies** : Task 0.4 (Claude Max workflow)
- **Files** : `apps/web/src/content/kb/*.mdx` (20 articles)
- **Acceptance Criteria** :
  - [ ] 20 articles couvrant features P0 (cf. CLAUDE.md §16, planning-14-jours.md §J14)
  - [ ] Indexés via pgvector pour RAG chat IA
  - [ ] Navigation KB intégrée site (`kovas.fr/aide`)

### Task 5.3 : Onboarding 10 bêta-testeurs + séquence emails
- **Objective** : 10 bêta-testeurs initiaux onboardés + séquence emails J+1/J+4/J+8/J+11/J+13 active via Resend
- **Dependencies** : Tasks 5.1, 5.2
- **Files** : `supabase/functions/cron-onboarding-emails/index.ts`, `apps/web/src/content/emails/*.tsx`
- **Acceptance Criteria** :
  - [ ] 10 bêta-testeurs créent leur compte + 1ère mission test
  - [ ] Emails J+1/J+4/J+8/J+11/J+13 envoyés selon timing user
  - [ ] PostHog tracks funnel signup → activation 7j

### Task 5.R : Phase 5 Regression (=Phase A bêta launch)
- **Testing** :
  - [ ] 10 bêta-testeurs actifs J0-J7
  - [ ] Activation rate 7j ≥ 60% (au moins 6/10)
  - [ ] 0 crash bloquant
  - [ ] Sentry + PostHog dashboards verts

---

## Phase 6 : Bêta validation (M6-M9)

**Goal** : Phase A gratuite (M6-M7) puis Phase B 29€ (M7-M9) + 30-50 bêta-testeurs au total + remontée bugs intensive + validation économique.

### Task 6.1 : Onboarding 30-50 bêta-testeurs (M6-M7)
- **Objective** : Onboarder cohorte complète 30-50 bêta-testeurs sélectionnés via LinkedIn outreach + ADEME (Persona 1 Maxime prioritaire)
- **Acceptance Criteria** :
  - [ ] 30-50 comptes créés
  - [ ] Charte bêta-testeurs signée (cf. CLAUDE.md §17)
  - [ ] 1 visio mensuelle obligatoire planifiée

### Task 6.2 : Bug bash + qualité produit (M6-M7)
- **Objective** : Identifier et fixer les bugs critiques avant Phase B payante
- **Acceptance Criteria** :
  - [ ] ≤ 5 bugs critiques ouverts à M7
  - [ ] Crash-free > 99%
  - [ ] NPS interne bêta ≥ 40

### Task 6.3 : Bascule Phase B 29€/mo (M7)
- **Objective** : Bêta-testeurs passent à tier Découverte 29€/mo (validation économique willingness-to-pay)
- **Acceptance Criteria** :
  - [ ] Conversion ≥ 60% des bêta-testeurs à Phase B
  - [ ] Cash-flow positif dès M7

### Task 6.4 : Préparation lancement public (M8-M9)
- **Objective** : Préparation campagne teasing LinkedIn + Product Hunt + presse + assets com de crise publiés
- **Acceptance Criteria** :
  - [ ] Page "Pourquoi KOVAS" publiée site
  - [ ] FAQ technique publiée
  - [ ] Communiqué presse de réponse prêt
  - [ ] Liste 500-1 000 leads accumulés depuis M3 (essai 14j)

### Task 6.R : Phase 6 Regression
- **Testing** :
  - [ ] 30-50 bêta-testeurs actifs et payants J0 Phase B
  - [ ] Cohorte M9+ : Founders bascule au tarif Founder à vie 49€/mo

---

## Phase 7 : Lancement public + V1 polish (M9-M12)

**Goal** : Ouverture inscription publique + V1 polish (streaks, plafond, custom status page) + KB +30 articles + 100+ abonnés payants à M12.

### Task 7.1 : Lancement public J0 (M9)
- **Acceptance Criteria** : annonce LinkedIn + Product Hunt + presse spécialisée + 200+ signups premières 48h

### Task 7.2 : Onboarding tour interactif amélioré
- **Acceptance Criteria** : Activation rate 7j passe à ≥ 65%

### Task 7.3 : Streaks + stats valorisées (cf. D403)
- **Acceptance Criteria** : Stats dashboard + email récap valorisés

### Task 7.4 : Plafond mensuel auto-protecteur + email "Tu paies trop"
- **Acceptance Criteria** : Plafond opérationnel, email auto trigger 3 mois consécutifs

### Task 7.5 : Status page custom Supabase
- **Acceptance Criteria** : Banner in-app + page `/status` + table `incidents` opérationnels

### Task 7.6 : KB +30 articles bonus
- **Acceptance Criteria** : 50 articles totaux, indexés RAG, calibrés sur tickets bêta

### Task 7.R : Phase 7 Regression (M12 checkpoint)
- **Testing** :
  - [ ] 100+ abonnés payants
  - [ ] Churn mensuel < 7% (cible M1-6)
  - [ ] NPS ≥ 40
  - [ ] Crash-free > 99%

---

## Phase 8 : E2E Comprehensive Testing (continu + audit M11)

**Goal** : Tests multi-angle e2e sur live software, edge cases, performance, régressions automatisées.

### Task 8.1 : E2E flux critique signup → essai → conversion → mission complète → export
- **Testing** :
  - [ ] Playwright suite full sur kovas.fr prod
  - [ ] Chaque PR déclenche E2E sur preview
  - [ ] Nightly E2E sur prod (Cron GitHub Actions)

### Task 8.2 : E2E robustesse offline + sync
- **Testing** :
  - [ ] Test mode avion 2h sur iPad réel + sync à reconnect : 100% missions sync
  - [ ] Test photos 100+ stockées localement + sync : 100% uploadées

### Task 8.3 : E2E Liciel intégration multi-version
- **Testing** :
  - [ ] CI nightly Windows VM Liciel V4 import KOVAS ZIP : 100% réussite
  - [ ] Test sur 3 versions Liciel (last 3 minors) : compatibilité OK
  - [ ] Test Piste A (Imports spécifiques XML) en parallèle : OK

### Task 8.4 : E2E performance + cost
- **Testing** :
  - [ ] Latence p95 vocal < 5s, vision < 4s (Phase 2)
  - [ ] Coût AI par utilisateur < 4€/mois (Phase 1)
  - [ ] Crash-free > 99% sur 30 jours glissants
  - [ ] DAU/MAU > 35%
  - [ ] Marge brute moyenne ≥ 77%

---

## Dependency Graph

```
Phase 0 (M0-M5) — Parallel pre-sprint setup
├── 0.1 Comptes services M0 ──┐
├── 0.2 Apple Dev (post-DUNS) │
├── 0.3 INPI marque           │
├── 0.4 Docs légaux Claude    │
├── 0.5 50 entretiens ───────┤── advisor identified M3-M4
├── 0.6 Recrutement advisor   │
├── 0.7 Fixtures Liciel + GPG │
├── 0.8 Com de crise + runbook│
└── 0.9 Hiscox M5             │
                              ▼
                     0.R Phase 0 Regression (M5)
                              │
                              ▼
Phase 1 (Sprint J1-J3) — Foundation
├── 1.1 Monorepo ──► 1.2 Supabase ──► 1.3 Design system ──► 1.4 CRUD + APIs
└── 1.R Phase 1 Regression (J3 fin)
                              │
                              ▼
Phase 2 (Sprint J4-J7) — Field capture
├── 2.1 EAS dev client ──► 2.2 Photos ──► 2.3 Voice Whisper ──► 2.4 Structuration Claude
└── 2.5 Checkpoint J7 démo terrain ──► 2.R Phase 2 Regression
                              │
                              ▼
Phase 3 (Sprint J8-J10) — Croquis + Sync + Offline
├── 3.1 Croquis Skia ──► 3.2 Dashboard + Realtime ──► 3.3 Offline complet
└── 3.R Phase 3 Regression (J10 soir)
                              │
                              ▼
Phase 4 (Sprint J11-J13) — Exports + Stripe
├── 4.1 Exports 4 formats ──► 4.2 ZIP Liciel + tests ──► 4.3 Stripe 4 tiers ──► 4.4 Widget transparence ──► 4.5 E2E Playwright
└── 4.R Phase 4 Regression (J13 soir)
                              │
                              ▼
Phase 5 (Sprint J14) — Build prod + bêta initial
├── 5.1 Deploy prod ──► 5.2 KB 20 articles ──► 5.3 Onboarding 10 bêta-testeurs
└── 5.R Phase 5 Regression = Phase A bêta launch (J14 fin)
                              │
                              ▼
Phase 6 (M6-M9) — Bêta validation
├── 6.1 30-50 bêta-testeurs ──► 6.2 Bug bash ──► 6.3 Bascule Phase B 29€ ──► 6.4 Préparation lancement public
└── 6.R Phase 6 Regression (M9 launch ready)
                              │
                              ▼
Phase 7 (M9-M12) — Lancement public + V1 polish
├── 7.1 Launch J0 ──► 7.2 Onboarding ──► 7.3 Streaks ──► 7.4 Plafond + emails ──► 7.5 Status page ──► 7.6 KB +30
└── 7.R Phase 7 Regression (M12 : 100+ payants)
                              │
                              ▼
Phase 8 (continu + M11 audit) — E2E Comprehensive Testing
├── 8.1 Flux critique signup→export
├── 8.2 Robustesse offline + sync
├── 8.3 Liciel intégration multi-version
└── 8.4 Performance + cost
```

---

## Task Execution Protocol

### Pour chaque task

1. **Orient** : Lire la task file détaillée dans `tasks/phase-N/task-N-M.md` (Phase 10 sharding) + skills référencées + DISCOVERY.md + CLAUDE.md
2. **Plan** : Explorer codebase, planifier approche, créer feature branch `feature/task-N-M-<short>`
3. **Implement** : Code + tests unitaires + integration tests
4. **Test local** : `pnpm -r typecheck`, `pnpm -r test`, `pnpm -F web test:e2e` (si UI touchée)
5. **Commit** : Conventional Commits, signed if part of `kovas-discovery-log` repo (Liciel work)
6. **PR + review** : `gh pr create`, CI verte requise
7. **Complete** : Update `PROGRESS.md`, merge to `main` (branch protection automatique squash merge)

### Pour les regression tasks (X.R)

1. Deploy preview Vercel + EAS preview channel
2. Run ALL tests from the phase
3. Full e2e testing from every angle (Playwright suite)
4. External services verification (Stripe webhook, Resend send, Supabase RLS)
5. Fix failures, redeploy, retest
6. Merge to `main` après green CI

### Pour Phase 8 (e2e final continu)

1. Toutes les Phase 8 tasks tournent sur **live software production**
2. Chaque user path + edge case couvert
3. Chaque testing method appliqué
4. Iteration directe sur `main` jusqu'à 100% green
5. Audit complet M11 (avant Phase 7.R M12 checkpoint)

---

## Status tracking

- Tracking dans **`PROGRESS.md`** (à créer Phase 12 m2c1) au format :
  ```
  | Task | Status | Branch | PR | Notes |
  |---|---|---|---|---|
  | 0.1 | completed | feature/0-1-comptes | #12 | D-U-N-S en cours, ETA 14j |
  | 1.1 | in_progress | feature/1-1-monorepo | - | - |
  | 1.2 | pending | - | - | blocked by 1.1 |
  ```
- Update **temps réel** par l'agent exécutant chaque task

---

## Anti-patterns critiques à éviter

- ⛔ Démarrer une task sans lire CLAUDE.md + DISCOVERY.md + task file complet
- ⛔ Skip les regression tasks (X.R) à la fin de chaque phase
- ⛔ Ajouter features hors MVP (cf. Scope Constraints) — Vision IA / Croquis IA / Recos F/G repoussés
- ⛔ Over-engineer sync layer (LWW simple suffit Phase 1, pas de CRDT)
- ⛔ Tester directement sur prod sans preview Vercel intermédiaire
- ⛔ Désactiver branch protection main pour aller plus vite
- ⛔ Skipper les tests E2E "parce que ça compile"
- ⛔ Embaucher un ex-Liciel (concurrence déloyale)
- ⛔ Désassembler Liciel.exe (sort du périmètre L122-6-1 III)
