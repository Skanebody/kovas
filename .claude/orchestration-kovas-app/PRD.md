# KOVAS App — Product Requirements Document

**Created**: 2026-05-13
**Updated**: 2026-05-18 — **REFONTE STRUCTURELLE MAJEURE** (MVP 6 features + pricing 4 tiers + planning 14j + Phase 4 vision)
**Status**: v3 — actif, authority PRD
**Source**: Brain dump fondateur + retour structurel + analyse mercenaire + audit externe Benjamin Bel
**Target launch**: Septembre-Octobre 2026
**Editor company**: SASU Nexus 1993 (siège 66 Av Champs Elysées Paris 8, SIREN 982 786 154, D-U-N-S 281515446, APE 58.29C)
**Founder location**: Benjamin Bel — Normandie (lieu de travail perso, hors siège société)
**Domain**: kovas.fr

> **⚠️ Authority order** : CLAUDE.md (racine) > DISCOVERY.md > ce PRD > recherches.
> En cas de conflit avec le contenu ci-dessous, le CLAUDE.md et DISCOVERY.md font foi.
>
> **Refonte 18/05 — points clés** :
> - **MVP réduit à 6 features cœur** (vocal structuré, photos géo, croquis manuel, auto-complétion adresse, exports multi-format, sync offline)
> - **Vision IA + Croquis IA + Recos F/G repoussés V2/V3** (pas dans MVP Phase 1)
> - **Pricing 4 tiers à l'usage** : Découverte 29€ / Standard 59€ / Volume 99€ / Cabinet 199€ Phase 2 (vs structure 59€/89€ initiale)
> - **Différenciateurs Phase 1 = 3 piliers** : vocal IA + exports universels + croquis manuel rapide
> - **Planning 14 jours sprint intensif** (vs Q2-Q4 2026)
> - **Marge brute 77%** + ARR M24 1M€ + ARR M36 2,77M€ (réajusté à la hausse)
> - **Nouvelle vision Phase 4** : "KOVAS Field Compliance OS" (TAM cumulé ~170M€/an)

**Convention de marquage** : `[À DÉCIDER → DISCOVERY:DX]` indique une décision à valider en Phase 3 Discovery. Les autres énoncés sont des hypothèses de travail issues du brain dump à confirmer.

---

## 1. Vision & Mission

**Mission** : Donner aux ~13 000 diagnostiqueurs immobiliers indépendants français la pile mobile + web IA-first qui les libère de Liciel + Word + tablette de notes + appareil photo + dictaphone. Une seule app, conçue par et pour les <40 ans qui n'acceptent plus de coder leur travail sur Windows 98.

**Vision 36 mois** : Devenir le challenger crédible d'Enersweet/Liciel sur le diagnostic immobilier français, en solopreneur, sans levée, propulsé par l'IA pour le dev, le support et l'acquisition.

**Promesse client mesurable** : 3h → 30min par mission DPE typique grâce à l'IA terrain (vocal Whisper, vision Claude, génération auto).

**Mission éditeur** : SASU Nexus 1993 (déjà existante, Dieppe, Qonto actif).

---

## 2. Marché & Concurrence

### 2.1 Taille du marché
- ~13 000 diagnostiqueurs immobiliers indépendants en France (source : fédérations métier, COFRAC certifications actives).
- TAM logiciels SaaS B2B vertical : ~15-20M€/an (13 000 utilisateurs × 1 200-1 500€/an avg).
- Marché en croissance (loi Climat, audit énergétique obligatoire, durcissement réglementaire).

### 2.2 Concurrents directs

| Acteur | PdM | Stack | Forces | Faiblesses |
|---|---|---|---|---|
| **Liciel Environnement** (groupe Enersweet, financé Pictet AM) | 40-52% | Windows desktop, Word, Access | Référence métier, certifié, support installé | Tech 2007-2012, UX 6-7,5/10, bug Aug 2024 (17j ADEME) |
| **AnalysImmo** | 11-15% | Windows desktop | Tarif compétitif, base certifiée | Pas d'IA, UX datée |
| **OBBC** (racheté Enersweet/Sept 2025) | 10% | Windows desktop | - | Consolidation en cours |
| **Imm'PACT, Distotablet, ORIS, Domofit** | < 5% chacun | Windows / hybride | Niches verticales | Trop petits pour investir IA |

### 2.3 Dynamique de marché
- **Enersweet (Pictet AM) contrôle 60-65%** après consolidation. Stratégie : monopole tarifaire.
- **Bug Liciel Aug 2024** (17 jours ADEME bloquée) → fissure dans la confiance utilisateur.
- **Captivité forte** : impossible de changer de logiciel en pleine activité (raison de la stratégie KOVAS Compagnon Phase 1).
- **Tous les concurrents** : Windows desktop, génération Word, zéro IA, mises à jour réglementaires en retard.

### 2.4 Différentiation KOVAS
- Premier acteur **mobile-first iPad + web PWA**.
- Premier acteur **IA-native** (Vision + Whisper + Claude génération).
- Premier acteur **glassmorphism premium SaaS 2026**, rupture esthétique nette.
- Phase 1 sans barrière réglementaire → time-to-revenue rapide.

---

## 3. Personas & Jobs-To-Be-Done

### Persona 1 — "Maxime, 32 ans, solopreneur frustré" *(early adopter prioritaire)*
- 4-7 ans d'expérience, ~250-400 missions/an, CA 80-150 k€
- Travaille sur iPad Pro, déteste Surface Pro
- Critique active de Liciel sur LinkedIn, partagerait KOVAS volontiers
- **JTBD** : "Quand je suis sur le terrain, je veux finir la mission sur place sans devoir retourner 2h au bureau, pour rentrer chez moi à 18h et pas à 21h."

### Persona 2 — "Sophie, 38 ans, gérante de petit cabinet 3 personnes"
- Gestion mixte terrain + admin, multi-diagnostiqueurs, 600-900 missions/an
- Utilise Liciel mais paie aussi un comptable + assistant
- Sensible au ROI (gain temps × tarif horaire)
- **JTBD** : "Quand un de mes diagnostiqueurs rentre du terrain, je veux que la facture, le rapport et la transmission ADEME soient déjà 80% fait pour ne pas perdre 1h de re-saisie."

### Persona 3 — "Pierre, 47 ans, diagnostiqueur historique conservateur"
- 15-25 ans de métier, fidèle à Liciel, méfiant face au changement
- Pas une cible Phase 1 mais à convertir Phase 2 quand certification ADEME obtenue
- **JTBD** : "Quand je dois changer d'outil, je veux la garantie zéro perte de productivité et zéro risque réglementaire."

### Hypothèse de cohorte M12
- 80% Persona 1 (Maxime)
- 15% Persona 2 (Sophie)
- 5% early Persona 3 (Pierre)

---

## 4. Proposition de valeur

### 4.1 Promesse globale
> *"L'app iPad qui transforme 3 heures de DPE en 30 minutes, sans Word, sans Liciel, sans bureau."*

### 4.2 Par persona

| Persona | Promesse spécifique | Métrique de valeur |
|---|---|---|
| **Maxime** | Rentrer chez toi 2h plus tôt chaque jour | Temps moyen par mission < 30min |
| **Sophie** | Doubler la capacité de ton cabinet sans embaucher | CA/diagnostiqueur × 1,5 sur 12 mois |
| **Pierre** | Migration en douceur via KOVAS Compagnon, sans risque réglementaire | Compatibilité 100% export Liciel |

### 4.3 Top 5 différenciateurs (cœur de l'avantage concurrentiel)
1. **Saisie vocale terrain FR** (Whisper API + structuration Claude)
2. **Reconnaissance photo équipements** (Claude Vision : chaudières, chauffe-eau, étiquettes A-G)
3. **Croquis automatique depuis photos** (Claude Vision + algo géométrique + LiDAR iPad Pro)
4. **Génération auto recommandations post-DPE F/G** (3 scénarios chiffrés + aides MaPrimeRénov'/CEE/éco-PTZ)
5. **Assistant IA conversationnel métier** (Claude + base connaissances réglementaires ADEME/DHUP)

---

## 5. Métriques de succès produit

Toutes ces métriques sont **instrumentées dans PostHog dès le jour 1** (event tracking complet sur funnel d'inscription, première mission, rétention).

### 5.1 Activation
- **Time-to-first-value (TTFV)** : < 15 minutes entre signup et 1ère synthèse mission générée `[À DÉCIDER → DISCOVERY:D101 — cible exacte]`
- **Activation rate 7j** : ≥ 60% des inscrits complètent leur première mission dans les 7 jours `[D102]`
- **Activation rate 30j** : ≥ 80% des inscrits complètent ≥ 3 missions dans les 30 jours `[D103]`

### 5.2 Rétention
- **Churn mensuel cible** : < 3% en régime stationnaire `[D104]`
- **Churn 90j post-activation** : < 10% `[D105]`
- **Rétention cohorte M6** : > 75% des cohortes mois N actives au mois N+6 `[D106]`

### 5.3 Engagement
- **DAU/MAU ratio** : > 50% (cible "stickiness" SaaS B2B haute) `[D107]`
- **Missions/utilisateur actif/mois** : ≥ 15 en moyenne `[D108]`
- **Sessions/jour** : ≥ 3 (typique d'un diag : matin planning, terrain, soir admin) `[D109]`

### 5.4 Satisfaction
- **NPS** : ≥ 50 à M6, ≥ 60 à M12 (benchmark SaaS B2B premium = 40-60) `[D110]`
- **CSAT support** : ≥ 4,5/5 sur les conversations chat IA `[D111]`
- **Taux escalation IA → humain** : < 15% (objectif : Claude résout 85%+ tickets) `[D112]`

### 5.5 Business
- **MRR / Net New MRR mensuel** (PostHog ↔ Stripe)
- **ARR cumulé** (cible M12 : 50-65 k€ ; M24 : 500-600 k€ ; M36 : 1,5-2 M€)
- **CAC blended cible** : < 250€ (i.e. payback < 5 mois sur 59€/mois) `[D113]`
- **LTV cible** : > 2 500€ (LTV/CAC ratio > 10) `[D114]`
- **Marge brute** : 60-65% (discipline coûts API)

### 5.6 Performance technique
- **Latence vocal (capture → texte structuré)** : p95 < 5s `[D115]`
- **Latence vision (photo → équipement identifié)** : p95 < 4s `[D116]`
- **Disponibilité backend** : 99,5% (Supabase EU SLA)
- **Crash-free rate mobile** : > 99% `[D117]`
- **Sync offline → online** : 100% des missions sync sans perte de données

---

## 6. Plan produit en phases (avec gates de validation) — révisé 18/05

> **Voir CLAUDE.md §3 et `features-roadmap.md` pour le détail complet par version.**

### 6.1 Phase 1 — KOVAS Compagnon (M1-M9, pricing 4 tiers 29€/59€/99€)

**Scope MVP V0.5 (6 features cœur uniquement)** :
1. Saisie vocale terrain structurée par pièce (Whisper + Claude)
2. Photos géolocalisées + annotations Apple Pencil
3. Croquis 2D manuel rapide (PAS de Vision IA, PAS de LiDAR)
4. Auto-complétion adresse + cadastre (API BAN + IGN + Géorisques)
5. Export multi-format universel (PDF + Word + CSV + JSON + ZIP Liciel)
6. Sync mobile/web + mode offline complet

**Effort dev total** : 25 j → 17-18 j intensifs avec Cursor + Claude Code + buffer J15-J18.

**Gain utilisateur** : 1h30 par mission DPE typique.
**Barrière réglementaire** : aucune.

**Gate de passage à la commercialisation** (déblocage M9 launch public) :
- ✅ Export ZIP Liciel testé fonctionnel sur ≥ 5 missions réelles diverses (vente/location/copro)
- ✅ Cohorte bêta privée (30-50 utilisateurs) sur 60 jours avec NPS ≥ 40
- ✅ Activation rate 7j ≥ 50% sur bêta
- ✅ Tous les blocs P0 couverts par tests automatisés + e2e
- ✅ Onboarding < 15min validé qualitativement avec 10+ users
- ✅ ToS / CGU / DPA / mentions légales validés par avocat

### 6.2 Phase 2 — KOVAS Complet (M10-18, 89€ HT/mo)

**Scope** : KOVAS remplace 100% Liciel. Calcul DPE 3CL-2021 certifié ADEME, transmission directe, modules amiante/plomb/gaz/élec/termites/Carrez-Boutin/ERP, génération PDF native sans Word.
**Préparation** : dossier de validation ADEME démarré M4.
**Gain utilisateur** : 3h → 30min total (plus de retour bureau).

**Gate de passage** :
- ✅ Méthode 3CL-2021 validée par ADEME (numéro de validation officiel)
- ✅ Transmission ADEME automatique testée sur ≥ 50 DPE
- ✅ Migration en douceur depuis Liciel testée avec ≥ 20 utilisateurs (sans perte donnée historique)
- ✅ Modules amiante/plomb/gaz/élec/termites validés métier (10+ utilisateurs par module)
- ✅ Rapports PDF natifs validés mise en page sur ≥ 50 exemplaires
- ✅ NPS ≥ 50 sur cohorte Compagnon (signal force du produit)

### 6.3 Phase 3 — KOVAS Augmenté (M19+, 149€ HT/mo)

**Scope** : Assistant IA conversationnel métier, audit énergétique complet, marketplace MAR + RGE avec commissions.
**Modèle économique** : SaaS + commission rénovation (modèle hybride).

**Gate de passage** :
- ✅ Audit énergétique conforme cahier des charges DHUP
- ✅ Marketplace MAR/RGE : ≥ 50 partenaires onboardés, 1 lead test converti
- ✅ Base de connaissances réglementaires validée (couverture ≥ 95% questions fréquentes ADEME/DHUP/DGCCRF)
- ✅ ARR > 500 k€ (consolidation produit + équipe support de 1)

---

## 7. Inventaire features avec Definition of Done

### 7.1 Tableau récap des 19 blocs (85+ features)

Cf. brain dump pour le tableau exhaustif. Synthèse priorité par bloc :

| Bloc | Domaine | P0 | P1 | P2 |
|---|---|---|---|---|
| 1 | Missions / Clients | 7 | 3 | - |
| 2 | Saisie terrain IA-first | 9 | 2 | - |
| 3 | Croquis et plans | 5 | 1 | 1 |
| 4 | Synthèse / export Liciel | 5 | 1 | - |
| 5 | Recommandations post-DPE | 4 | 2 | - |
| 6 | Devis / factures / paiement | 6 | 3 | 1 |
| 7 | Communication clients | 4 | 2 | - |
| 8 | Dashboard / analytics | 2 | 4 | - |
| 9 | Moteur diagnostics ADEME | - | - | 12 |
| 10 | Rapports natifs | - | - | 7 |
| 11 | Espace pro avancé | - | - | 5 |
| 12 | API publique | - | - | 4 |
| 13 | Assistant IA conversationnel | - | - | 5 |
| 14 | Modules métier avancés | - | - | 5 |
| 15 | Drones / IoT | - | - | 4 |
| 16 | Marketplace prestations | - | - | 5 |
| 17 | Sécurité / conformité | 8 | - | - |
| 18 | Support / accompagnement | 3 | 1 | 2 |
| 19 | Multi-device / sync | 5 | 2 | - |

### 7.2 Definition of Done — Top 5 différenciateurs (P0 critiques)

#### DoD F1 — Saisie vocale terrain FR
- ✅ Whisper API intégrée, transcription < 3s sur clip ≤ 30s
- ✅ Précision ≥ 92% sur jargon métier (dataset test 200 clips réels diagnostic) `[D201]`
- ✅ Latence end-to-end (capture → texte structuré dans le bon champ) p95 < 5s
- ✅ Mode offline : queue locale puis sync différée à la reconnexion
- ✅ Coût API < 0,03€ par mission en moyenne `[D202]`
- ✅ Reprise après interruption (appel téléphone) sans perte du clip
- ✅ Test e2e Playwright simulant capture → champs remplis
- ✅ Bouton "rejouer audio" + édition manuelle du texte avant validation

#### DoD F2 — Reconnaissance photo équipement
- ✅ Claude Vision identifie marque, modèle, classe énergétique
- ✅ Précision ≥ 85% sur identification marque chaudière `[D203]`
- ✅ Dataset de validation : 200 photos d'équipements terrain réels couvrant 30+ marques principales `[D204]`
- ✅ Latence p95 < 4s par photo
- ✅ Coût API < 0,05€ par analyse
- ✅ Fallback "non reconnu" → champ libre + retour utilisateur (apprentissage continu)
- ✅ Indication confiance (high/medium/low) pour l'utilisateur

#### DoD F3 — Croquis automatique depuis photo
- ✅ Photo panoramique pièce → plan 2D dimensionné en < 10s `[D205]`
- ✅ Précision dimensions ± 10cm sur pièces standards (10-30m²) `[D206]`
- ✅ Mode LiDAR iPad Pro : ± 2cm (P2)
- ✅ Édition manuelle des points du plan possible (Apple Pencil)
- ✅ Calcul Carrez/Boutin auto depuis le plan validé
- ✅ Export PDF avec cotations

#### DoD F4 — Recommandations post-DPE F/G
- ✅ Pour tout DPE F/G, génération automatique de 3 scénarios (gestes simples / BBC compatibles / performance max)
- ✅ Chiffrage travaux ± 20% par rapport au marché `[D207]`
- ✅ Calcul aides MaPrimeRénov' / CEE / éco-PTZ exact selon ressources client
- ✅ ROI 5 ans calculé pour chaque scénario
- ✅ PDF Plan d'action 4-6 pages, design conforme charte KOVAS
- ✅ Validation manuelle du diagnostiqueur avant remise au client

#### DoD F5 — Assistant IA conversationnel (P2)
- ✅ Base de connaissances ADEME + DHUP + DGCCRF indexée (≥ 95% couverture FAQ métier)
- ✅ Sourcing systématique des réponses (lien direct vers texte officiel)
- ✅ Latence p95 < 4s par réponse
- ✅ Escalade au fondateur si IA "incertaine" ou si user demande humain
- ✅ Coût API < 0,02€ par échange

### 7.3 Definition of Done — Bloc 4 Export Liciel (P0 BLOQUANT business)

- ✅ Structure ZIP identique à un export Liciel natif (validation byte-level sur ≥ 5 exemples Liciel réels)
- ✅ Import dans Liciel via "Fichier → Importer format ZIP" : 100% des champs reconnus
- ✅ Test sur missions vente, location, copro, audit (4 types couverts)
- ✅ Photos intégrées avec géolocalisation et horodatage
- ✅ Régression suite à chaque mise à jour Liciel (monitoring tournant)
- ✅ Documentation interne du mapping des 8 000+ champs WikiLiciel

### 7.4 DoD pour les autres P0
Cf. PHASES.md pour le DoD détaillé des P0 restants (sera produit en Phase 9 du workflow d'orchestration). Critères génériques applicables :
- Code TypeScript strict, zéro `any`
- Tests unitaires Jest/Vitest ≥ 80% couverture
- Tests e2e Playwright sur les flux critiques
- Performance : pas de blocage UI > 100ms
- Conformité design system (palette, typo, composants)
- Accessibilité WCAG AA minimum
- i18n FR uniquement Phase 1 (préparation hooks pour i18n future, cf. §13.4)

---

## 8. Architecture technique

### 8.1 Stack (figée par fondateur)

#### Frontend mobile
- **React Native + Expo SDK 52** + TypeScript strict
- **NativeWind 4** (Tailwind sur RN)
- **expo-blur** (glassmorphism)
- **react-native-svg**, **Lucide React Native**
- **React Native Skia** (graphiques demi-cercle KPI, animations)
- **Reanimated 3** (transitions)
- **Zustand** (state), **TanStack Query** (cache + offline-first)

#### Frontend web
- **Next.js 15 App Router** + TypeScript strict
- **Tailwind CSS** + **shadcn/ui** + **Lucide React**
- **Framer Motion**, **Recharts** ou **Visx**
- Glassmorphism via `backdrop-filter` CSS

#### Backend / Data
- **Supabase complet** : PostgreSQL + Auth + Storage + Realtime + Edge Functions + RLS
- Hébergement **EU** (Paris ou Frankfurt) `[D301]`
- Row-Level Security multi-tenant dès le démarrage

#### IA
- **Anthropic Claude Sonnet 4.6** (Vision + génération) `[D302 — confirmer choix modèle vs Opus 4.7 pour cas critiques]`
- Prompt caching activé (réduction coûts × 5)
- **OpenAI Whisper** (transcription vocale FR) `[D303 — confirmer vs alternatives type Deepgram]`

#### Paiement / Comm
- **Stripe** : SEPA priorité (frais réduits), Factur-X conforme
- **Resend** : emails transactionnels
- **DocuSeal** self-hosted (signature simple), **Yousign** option premium eIDAS qualifiée
- **SMS provider** : `[D304 — Twilio / OVHcloud SMS / OctoPush]`

#### Hosting / DevOps
- **Vercel** (web EU)
- **Expo EAS** (builds mobile + OTA)
- **Railway** (agents IA secondaires, ex: LinkedIn outreach automation)
- **GitHub Actions** CI/CD
- **pnpm workspaces** (monorepo)

#### Monitoring
- **Sentry** (error tracking)
- **PostHog** (analytics produit, funnel, A/B tests, feature flags)

### 8.2 Structure monorepo cible
```
kovas-app/
├── apps/
│   ├── mobile/        # React Native + Expo (iPad + iPhone)
│   └── web/           # Next.js 15 (PWA + dashboard)
├── packages/
│   ├── shared/        # types TypeScript, enums, utilitaires
│   ├── database/      # client Supabase, types générés
│   └── ai/            # wrappers Claude + Whisper réutilisables
├── supabase/
│   ├── migrations/    # schéma SQL versionné
│   └── seed.sql       # données test
├── pnpm-workspace.yaml, package.json, tsconfig.json, .env.example
└── CLAUDE.md, README.md
```

### 8.3 Sync offline-first
- **Mobile** : SQLite local (op-sqlite ou WatermelonDB) `[D305]` + queue de mutations
- **Détection connexion** : tentative de sync à chaque reconnexion + push notifications de fin
- **Conflit résolution** : last-write-wins par défaut + version vector pour cas critiques
- **Realtime** : Supabase Realtime pour propagation mobile ↔ web temps réel

### 8.4 Sécurité & RLS
- RLS sur toutes les tables : `auth.uid()` = `user_id` ou appartenance organisation
- Chiffrement TLS in-transit + at-rest (Supabase managé)
- Audit logs : table `events` immuable, append-only, conservation 24 mois
- 2FA TOTP (Authy/Google Authenticator) + fallback SMS

### 8.5 Préparation internationalisation `[D306]`
Décision à prendre : préparer i18n dès le départ (coût ~10-15% du scope initial) ou rester FR pur Phase 1 ?
**Recommandation par défaut** : architecture multi-locale prête (clés i18n + namespacing par module métier) mais une seule locale FR active. Coût technique faible si fait dès le jour 1.

---

## 9. Identité visuelle & Design System

### 9.1 Style global
**Glassmorphism Premium Soft UI** inspiré de Linear, Vercel, Stripe, SugarCRM, Notion 2024-2026.
Rendu cible : produit moderne, premium, épuré, dominante claire + accents noirs CTA.

### 9.2 Palette

**Light (par défaut)** :
| Élément | Code | Usage |
|---|---|---|
| Fond principal | `#F4F4F5` | Background dashboard |
| Cartes | `#FFFFFF` | Conteneurs contenu |
| Texte principal | `#0A0A0A` | Titres, données |
| Texte secondaire | `#404040` | Sous-titres |
| Texte tertiaire | `#737373` | Labels |
| Bordures | `#D4D4D8` | 1px max |
| CTA | `#0A0A0A` | Noir massif arrondi |
| Hover CTA | `#262626` | - |

**Dark** :
| Élément | Code | Usage |
|---|---|---|
| Fond principal | `#0A0A0A` | - |
| Cartes | `#171717` | - |
| Texte principal | `#FAFAFA` | - |
| Texte secondaire | `#A1A1A9` | - |
| Bordures | `#27272A` | - |
| CTA | `#FFFFFF` | Inversé |

**Accents délavés** (pills/badges seulement, jamais surface large) :
- Bleu doux `#7B96C4` (info, mission planifiée)
- Rouge doux `#C46969` (alerte, DPE F/G)
- Vert doux `#8AB57B` (validation, DPE A-C)
- Orange doux `#D4A574` (DPE D/E)

### 9.3 Typographie
**Manrope** (gratuite Google Fonts) au démarrage, migration possible **Lufga** si licence acquise.

| Élément | Taille | Graisse |
|---|---|---|
| H1 | 32-40px | Bold 700 |
| H2 | 24-28px | Semibold 600 |
| H3 | 18-22px | Semibold 600 |
| Body large | 16px | Regular 400 |
| Body | 14px | Regular 400 |
| Label/meta | 12-13px | Medium 500 |
| Caption | 11px | Regular 400 |

### 9.4 Composants signature
- Border-radius 16-24px cartes, 12px boutons, 100px pills
- Cartes blanches sur fond gris, séparation par contraste subtil
- `backdrop-blur-md` + opacité 70-90% pour overlays
- Boutons icônes circulaires 40-44px, fond blanc, stroke 1.5-2px
- CTA noir massif unique sur l'écran
- Sidebar étroite 60-72px icônes seules + tooltips
- Demi-cercles KPI (plus moderne que barres/camemberts)
- Flux pointillés colorés pour pipelines

### 9.5 Règles strictes (non négociables)
- Pas de gradients colorés vifs (sauf noir→gris ou blanc→transparent glassmorphism)
- Pas de shadow-lg ou shadow-2xl (max shadow-sm / shadow-md)
- Pas de couleurs saturées en surface large
- Bordures 1px max
- Cohérence des border-radius dans tout le produit
- Dark + Light supportés avec switch utilisateur
- Mode `[D307]` : auto-suivi système ou toggle manuel uniquement ?

### 9.6 Icônographie
- **Lucide React** (web) et **Lucide React Native** (mobile)
- Style line minimaliste, stroke 1.5-2px
- Tailles : 20px boutons, 16px inputs, 24px headers/navigation

### 9.7 Références visuelles
**Inspirations** : SugarCRM Customer Journeys, Linear, Vercel, Stripe, Notion.
**À éviter absolument** : Liciel/AnalysImmo/OBBC (Windows 2008), Material Design Google chargé, apps SaaS aux couleurs vives, illustrations cartoon "fun".

---

## 10. User Onboarding Flow

### 10.1 Objectifs
- **Time-to-first-value < 15min** entre signup et 1ère synthèse mission
- **Activation rate 7j ≥ 60%** (cible §5.1)
- **Zéro escalade humaine** dans la première semaine pour 90%+ des users

### 10.2 Décision essai gratuit `[D401]`
Trois options à arbitrer en Discovery :
- A) Essai 30 jours sans CB (large funnel, mais churn déclic vs. paiement risqué)
- B) Essai 30 jours avec CB (qualifie mieux, friction signup)
- C) Pas d'essai gratuit, mais offre "satisfait ou remboursé 30j" `[recommandation à valider]`

### 10.3 Flow détaillé J0 → J7

#### Étape 1 — Signup (J0, 0-3min)
1. Landing kovas.fr → "Essayer gratuitement"
2. Email + mot de passe `[ou Magic link / OAuth Apple+Google, à décider D402]`
3. Confirmation email
4. Premier login → questionnaire 3 questions :
   - "Quel logiciel utilises-tu aujourd'hui ?" (Liciel / AnalysImmo / OBBC / Autre)
   - "Combien de missions par mois en moyenne ?"
   - "Quel iPad utilises-tu ?" (modèle pour optimiser UI)

#### Étape 2 — Tour produit guidé (J0, 3-10min)
- Modal de bienvenue avec vidéo 90s "Comment KOVAS te fait gagner 2h par mission"
- Tour interactif (Intro.js style) sur 5 écrans clés :
  1. Création de mission
  2. Saisie vocale terrain
  3. Reconnaissance photo
  4. Synthèse + export Liciel
  5. Tableau de bord
- À chaque étape, possibilité de skip
- État final : "Tu es prêt. Crée ta première mission."

#### Étape 3 — Première mission test (J0, 10-15min)
- Données fictives pré-remplies : adresse Paris, type DPE vente, surface 65m²
- Tooltips contextuels guidant chaque action
- "Champion mode" : célébration visuelle à chaque étape complétée
- À la fin : génération ZIP Liciel test + PDF récap → email envoyé

#### Étape 4 — Première mission réelle (J0-J2)
- Si user crée une vraie mission dans les 48h → activation réussie
- Si pas de mission créée à J+2 → email automatique "Besoin d'aide ?"

### 10.4 Sequence emails onboarding

| Quand | Sujet | Contenu | CTA |
|---|---|---|---|
| J0 (signup) | "Bienvenue sur KOVAS — Démarre en 10min" | Vidéo + lien 1ère mission test | Lancer mission test |
| J+1 | "Comment vont tes premières missions ?" | Tips, lien chat support | Ouvrir l'app |
| J+3 | "5 astuces pour gagner 2h par jour" | Astuces vocal + photo | - |
| J+7 | "Tu as économisé X heures cette semaine" | Stats personnalisées | Discover analytics |
| J+15 | "Tu n'as plus que 15j d'essai" *(si pas converti)* | Témoignage user + offre | Activer abonnement |
| J+25 | "Ton essai se termine bientôt" | Récap valeur générée | Activer abonnement |

### 10.5 Empty states
- **Pas de mission** : illustration douce + CTA "Créer ma première mission" + suggestion "Ou essaie avec des données de démo"
- **Pas de client** : "Importe ton carnet depuis Liciel ou ajoute manuellement"
- **Pas de devis** : "Génère un devis à partir d'une mission acceptée"

### 10.6 Gamification `[D403]`
**Décision** : intégrer ou pas ?
**Recommandation** : pas de badges/points "ludiques" (incohérent avec persona B2B pro). Mais oui à :
- Stats personnalisées valorisées ("Tu as économisé 32h ce mois-ci")
- Streaks ("12 missions consécutives sans retour bureau")
- Comparaison anonyme ("Tu es dans le top 20% de productivité")

### 10.7 Conversion essai → payant
- Email J+25 + J+28 + bandeau in-app
- Conversion automatique J+30 SI CB renseignée (option B) ou opt-in manuel
- Si conversion ratée : downgrade en mode "lecture seule" 30j (pas de suppression données)

---

## 11. Go-to-Market Plan

### 11.1 Funnel cible M0-M12

| Étape | Volume cible M12 | Conversion |
|---|---|---|
| Impressions LinkedIn + SEO + ads | 1 000 000 | - |
| Visites kovas.fr | 30 000 | 3% |
| Signups essai gratuit | 1 500 | 5% des visites |
| Activation (1ère mission complète) | 900 | 60% des signups |
| Conversion essai → payant | 90-100 | 10-12% des signups (60% activation × ~17% des activés) `[D501]` |

### 11.2 Canaux d'acquisition prioritaires

#### Canal 1 — LinkedIn outreach automatisé (cœur stratégie M0-M6)
- Outils : agent IA propre (Railway) + LinkedIn Sales Navigator `[D502 — budget Sales Nav 99€/mo]`
- Cible : profils "Diagnostiqueur immobilier" en France, < 40 ans
- Volume : 100 connexions/jour × 22 jours = 2 200 nouveaux contacts/mois
- Séquence : connexion + message 1 (problème Liciel) + message 2 (démo KOVAS)
- **CAC cible canal LinkedIn** : ~80€

#### Canal 2 — SEO + content marketing (long-terme M3+)
- Stratégie : ranker sur ~30 requêtes métier ("alternative Liciel", "logiciel DPE iPad", "DPE en moins de 30 minutes", etc.)
- Rythme : 2 articles/semaine, 1 500-2 500 mots, écrits via Claude + relecture fondateur
- Backlinks : posts forum diagnostic, fédérations, échange avec blogs tech immo
- **Trafic SEO cible M12** : 5 000 visites/mois

#### Canal 3 — Partenariats fédérations (M2+)
- Cibles : Fédération SIDIANE, FIDI, autres syndicats métier
- Format : webinaire mensuel co-organisé "Comment l'IA transforme le métier de diagnostiqueur"
- Code promo dédié -20% 1ère année pour membres

#### Canal 4 — Programme de parrainage `[D503]`
- 1 mois gratuit pour parrain + 1 mois gratuit pour filleul
- Cohérent avec marché niche très connecté (les diagnostiqueurs se connaissent en région)
- **Activation prévue M3**

#### Canal 5 — Salons métier (M6+)
- SIDIANE annuel (octobre), FIDI events, salons régionaux
- Démo iPad + offre salon -30% 6 mois

#### Canal 6 — Ambassadeurs (M4+) `[D504]`
- 10-15 power users sélectionnés
- Bénéfices : early access features, badge "KOVAS Ambassadeur" sur LinkedIn, commission 10% sur referrals payants
- Engagement : 1 témoignage vidéo/an + active sur forums métier

### 11.3 CAC par canal (cibles)

| Canal | Coût/mois M6 | Volume signups | CAC effectif |
|---|---|---|---|
| LinkedIn outreach | 800€ (agent + Sales Nav) | 60-80 | 80-110€ |
| SEO/content | 0€ (fait par fondateur + Claude) | 30-50 (M6) | ~0€ |
| Partenariats fédérations | 0€ (échange visibilité) | 10-20 | ~0€ |
| Référral | 0€ (récompenses produit) | 5-10 | ~30€ (coût mois gratuit) |
| Ads (Google + Meta) | 500€ (test) | 20-30 | 200-250€ |

**CAC blended cible** : < 250€ (payback < 5 mois)

### 11.4 Roadmap content marketing

| Mois | Articles SEO | Webinars | Posts LinkedIn fondateur |
|---|---|---|---|
| M0-M3 | 8 articles socle (alternatives Liciel, audit énergétique, DPE, etc.) | - | 3/sem (build in public) |
| M3-M6 | +8 articles (cas d'usage, comparatifs, tutos) | 1 webinar test | 3/sem |
| M6-M9 | +16 articles (longue traîne, ranking) | 2 webinars co-orga | 5/sem |
| M9-M12 | Régime de croisière 4/mois | 1/mois | 5/sem |

### 11.5 Plan de lancement public M9
- **T-30 jours** : campagne teasing LinkedIn fondateur + emails listes acquises
- **J0 (lancement)** : annonce LinkedIn + Product Hunt + presse spécialisée (Le Mag de l'Immo, etc.)
- **T+30 jours** : campagne paid LinkedIn + Google Ads test (1 000€ budget)
- **T+60 jours** : 1er webinaire grand public

### 11.6 Mode bêta privée `[D505]`
**Recommandation** : oui, fermée à 30-50 utilisateurs sur M6-M9.
- Sélection LinkedIn outreach prioritaire (early adopters Persona 1)
- Gratuit pendant bêta, ensuite -50% 1ère année si conversion
- Engagement : 1 call mensuel feedback, accès Slack/Discord direct fondateur

---

## 12. Pricing & Packaging — RÉVISÉ 18/05 (4 tiers à l'usage)

> **Voir `pricing-strategy.md` pour le détail complet + mécaniques anti-friction paiement.**
> **Voir CLAUDE.md §4 pour résumé.**

### 12.1 Pricing officiel révisé — 4 tiers Phase 1

| Phase | Tier | Prix HT/mo | Missions inclus | Surplus | Users |
|---|---|---|---|---|---|
| **Phase 1 Compagnon (M1-M9)** | Découverte | **29€** | 20 | 2€/mission | 1 |
| Phase 1 Compagnon | **Standard (recommandé)** | **59€** | 60 | 1,50€/mission | 1 |
| Phase 1 Compagnon | Volume | **99€** | 150 | 1€/mission | 1 |
| **Phase 2 Complet (M10-M18)** | Standard Complet | **99€** | 60 | 1,50€ | 1 |
| Phase 2 Complet | Volume Complet | **149€** | 150 | 1€ | 1 |
| Phase 2 Complet | **Cabinet** | **199€** | 400 | 0,80€ | jusqu'à 3 |
| **Phase 3 Augmenté (M19+)** | Standard Augmenté | **149€** | - | - | 1 |
| Phase 3 Augmenté | Volume Augmenté | **199€** | - | - | 1 |
| Phase 3 Augmenté | Cabinet Augmenté | **299€** | - | - | jusqu'à 3 |
| Phase 3 Augmenté | **Enterprise** | **499€** | - | - | 4-10 |

**Tarif Founder (40-50 bêta-testeurs M6-M9)** :
- M6-M7 : gratuit
- M7-M9 : Découverte 29€/mo
- M9+ à vie : Standard Founder 49€/mo (70 missions, surplus 1€/mission)
- Cabinet Phase 2 Founder à vie : 169€/mo

**Annuel** : 2 mois offerts (10 mois payés / 12) sur tous les tiers.

**Options ponctuelles** (paiement à l'usage, AUCUN pack mensuel) :
- Signature eIDAS Yousign : 2€/signature
- Rapport bilingue FR/EN : 5€/rapport
- SMS rappel client J-1 : 0,15€/SMS

### 12.2 Rationale
- 59€ : prix d'entrée bas pour casser objection initiale + générer du volume bêta rapidement
- 89€ : prix de marché vs Liciel ~120€/mois moyenné, positionnement clair "premium moins cher"
- 149€ : prix premium aligné sur valeur ajoutée Phase 3 (audit + marketplace)
- Modèle **hybride à terme** : forfait + 1€/mission additionnelle au-delà du quota inclus `[D601 — définir quota inclus par phase]`

### 12.3 Tests pricing A/B prévus
- **Test 1 (M3)** : 49€ vs 59€ vs 69€ Phase 1 sur cohorte LinkedIn outreach
- **Test 2 (M6)** : tier "Solo" 39€ (limité 50 missions/mois) vs tier "Pro" 59€ illimité
- **Test 3 (M12)** : annuel -2 mois (10 mois payés) vs mensuel
- **Test 4 (M15)** : Compagnon à 49€ pour conversion churn potentiel

### 12.4 Packaging (Phase 1)
- **Inclus dans 59€** : utilisateur unique, missions illimitées, support chat IA, mises à jour
- **Non inclus** : eIDAS Yousign (option +10€/mo) `[D602]`
- **Surcoût** : multi-utilisateurs cabinet (Phase 2, +20€/utilisateur additionnel)

### 12.5 Marge brute cible 60-65%
Coûts variables par abonné/mois (estimation Phase 1) :
- Claude API (Vision + texte) : 4-7€ (avec prompt caching)
- Whisper API : 1-2€
- Stripe fees : ~1,2€ (2% sur 59€)
- Supabase (storage + bandwidth) : ~1€
- Resend + SMS provider : ~0,5€
- DocuSeal hosting (Railway) : ~0,2€ par abonné amorti
- **Total coûts variables** : ~8-12€ → marge brute 79-86% bien au-dessus de la cible

### 12.6 SEPA priorité paiement récurrent
- SEPA Direct Debit : frais ~0,35€ flat (vs 2% CB)
- Cible : 70%+ des abonnés en SEPA d'ici M12
- Économie : ~0,5-1€/abonné/mois à 100 abonnés = 50-100€/mois

---

## 13. Légal & Conformité

### 13.1 Documents légaux à produire

| Document | Quand | Producteur | Validation |
|---|---|---|---|
| ToS / CGU B2B | Avant lancement bêta | Avocat `[D701]` | Conforme RGPD |
| DPA (Data Processing Agreement) | Avant lancement bêta | Avocat | Pour clients pro |
| Politique cookies | Dès web public | Fondateur + Cookiebot/Iubenda | Conforme CNIL |
| Mentions légales | Dès web public | Fondateur | Standard SASU |
| Politique de confidentialité | Avant lancement bêta | Avocat | RGPD |
| Politique d'assurance RC pro | Avant lancement bêta | Courtier `[D702]` | Coverage défaillance logicielle |

### 13.2 RGPD (P0 transversal, déjà au PRD initial)
- Hébergement EU (Supabase Paris/Frankfurt)
- Chiffrement TLS + at-rest
- Audit logs complets (qui a fait quoi)
- Export RGPD utilisateur en 1 clic (UX dédié dans profil)
- Droit à l'oubli : suppression complète sur demande (workflow 30j de grâce avant deletion)
- Consentement cookies + tracking explicite
- Sous-traitants documentés (Anthropic, OpenAI, Supabase, Stripe, Resend, Sentry, PostHog)

### 13.3 Factur-X (conformité 2026-2027 obligatoire FR)
- Génération auto à partir des factures KOVAS
- Format XML + PDF combiné
- Transmission via PPF (Portail Public de Facturation) `[D703]`
- Tests réception côté clients B2B (notaires, agences) dès M3

### 13.4 Internationalisation `[D704]`
**Décision** : préparer ou pas l'expansion BE/LU/CH ?
**Argument pour** : architecture découplée locale coûte ~10-15% mais évite refonte. Le marché diag immobilier existe partout en Europe.
**Argument contre** : focus FR pure Phase 1, étendre uniquement si traction FR validée.
**Recommandation** : architecture i18n prête (clés + namespace) mais une seule locale FR active jusqu'à validation M12.

### 13.5 Assurance responsabilité civile pro
- Coverage : bug KOVAS → perte DPE utilisateur → perte CA pour le diagnostiqueur
- Souscription : avant lancement bêta `[D705]`
- Montant assuré recommandé : 500 k€

### 13.6 Conservation légale rapports diagnostics
- DPE : 10 ans conservation obligatoire
- KOVAS doit garantir l'accès et la lisibilité des rapports archivés
- Stratégie : Supabase Storage + backup hebdo S3 EU `[D706]`

### 13.7 Validation ADEME 3CL-2021 (Phase 2)
- Dossier démarré M4 (10-12 mois en parallèle dev Phase 2)
- Validation officielle attendue M14-M18
- Cf. §6.2 pour gate Phase 2

---

## 14. Support & Operations

### 14.1 Philosophie support
**IA-first** : Claude répond en chat, escalation au fondateur si Claude incertain ou user demande humain.

### 14.2 Canaux supportés Phase 1
- **Chat in-app** (Claude + escalation) — canal principal
- **Email** : support@kovas.fr (réponse < 24h)
- Pas de téléphone Phase 1 (réservé Phase 3 / cabinets premium)

### 14.3 SLA cibles
- **Première réponse IA** : < 60s
- **Première réponse humaine** (si escalation) : < 4h jours ouvrés, < 24h weekend/jours fériés
- **Résolution incident bloquant prod** : < 4h
- **Résolution incident dégradé** : < 24h
- **Résolution question UX** : < 48h

### 14.4 Base de connaissances (KB) Phase 1
- **Dès le jour 1** : ≥ 50 articles couvrant features P0
- Format : articles structurés (titre, intro, étapes, captures, FAQ liée)
- Indexée pour recherche IA (RAG sur embeddings)
- Mise à jour continue par fondateur après chaque ticket récurrent

### 14.5 Outils support
- **Ticketing** : `[D801 — Plain.com, Pylon, Intercom, ou solution custom Supabase]`
- **Status page** : status.kovas.fr (Better Stack ou équivalent)
- **Postmortems publics** : pour incidents > 2h downtime

### 14.6 Escalade IA → humain
- Trigger automatique : confidence IA < 70% ou mot-clé "humain"/"agent"/"personne"
- Notification : Slack fondateur + email
- Compte rendu IA résumé pour pris en main rapide

### 14.7 Plan de continuité (founder dépendance)
Cf. §15.4 — risque dépendance fondateur.

---

## 15. Risques & Plans de mitigation

### 15.1 Risque concurrentiel Enersweet

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| Enersweet ignore (jusqu'à 100 abonnés) | High | Low | Continuer roadmap, build community |
| Enersweet copie features (300+ abonnés) | Medium | Medium | Accélérer Phase 2, exclusivité réglementaire ADEME, brevet design ? `[D901]` |
| Enersweet baisse prix (500+ abonnés) | Medium | High | Tier "Pro" 39€ pour défendre + bundling Phase 2 |
| Enersweet tentative rachat | Low-Medium | Medium | Préparer pitch board + alternatives investors EU `[D902]` |

### 15.2 Risque réglementaire — Liciel ferme l'import ZIP

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| Liciel ferme volontairement l'import ZIP après M6 | Medium | **Critical** | **Plan B activé immédiatement** : accélération Phase 2 (DPE certifié natif), communication transparente users, garantie remboursement 3 mois Compagnon |
| Liciel attaque légale (interopérabilité) | Low | High | Défense L122-6-1 + L342-3 CPI + IP-track lawyer `[D903]` |

### 15.3 Risque technique fournisseurs

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| Anthropic augmente prix +50% (peu probable mais possible) | Low | High | Marge brute baisse 60% → 35% : passer modèles cheap pour calls non critiques (Haiku 4.5), prompt caching agressif, fallback OpenAI gpt-4o-mini |
| Anthropic outage > 4h | Medium (1-2x/an) | Medium | Fallback OpenAI ou Gemini sur tâches non critiques, mode dégradé manuel pour vision |
| Whisper outage / API change | Low | Medium | Alternative Deepgram, Cloudflare AI ou Google Speech-to-Text |
| Supabase outage > 4h | Low | High | Backup hourly S3, mode offline mobile prolongé |

### 15.4 Risque dépendance fondateur

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| Maladie/indisponibilité 1-3 mois | Medium | Critical | **Plan de continuité** : 1) cofounder "advisor" cooptable rémunéré au lance-pierre `[D904]` 2) auto-pilot agents IA pour onboarding/support 3) procuration bancaire Qonto à un proche |
| Burnout | High (solo) | Critical | Cadence sprint disciplinée, semaines de 50h max, vacances forcées Q3 et Q4 chaque année, monitoring santé (oura ring ?) |
| Perte motivation à 12 mois si traction lente | Medium | Critical | Décision préalable : si < 30 abonnés à M9, pivot ou arrêt — pas de mode "zombie" |

### 15.5 Risque cash-flow

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| 30 abonnés au lieu de 80-100 à M12 | Medium | High | Runway personnel défini : couvre ≥ 18 mois sans CA `[D905 — confirmer trésorerie personnelle/Nexus]` ; si < 18 mois → freelance dev side 1-2j/sem |
| 0 abonné à M6 | Low | Critical | Pivot immédiat sur DTG copro ou audit énergétique pur (autres marchés vertical) |
| Cycle de paiement long (B2B 30-60j) | Low (SEPA recurring rapide) | Low | Stripe instant payouts si nécessaire |

### 15.6 Risque produit

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| Reconnaissance photo équipement < 80% | Medium | Medium | Mode "review utilisateur" obligatoire avant validation, dataset training continu, fallback manuel zéro friction |
| Saisie vocale FR métier décevante | Low | Medium | Glossaire métier custom Whisper, fine-tuning si nécessaire |
| Export ZIP Liciel rejeté par Liciel | Medium | **Critical** | Tests automatisés byte-level chaque nuit + monitoring Liciel update releases |
| Performance offline-first instable | Medium | High | Pré-prod sur 5+ iPads modèles différents, plage iOS 16→latest |

### 15.7 Risque acquisition

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| LinkedIn ban compte automation | Medium | Medium | Sales Nav officiel, jamais d'agent direct sur compte fondateur, comptes "ambassadeurs" assignés |
| SEO lent (< 1k visites M6) | High | Medium | Doubler budget content + backlink building manuel, pivoter sur newsletter LinkedIn |
| Pas de partenariats fédérations | Medium | Low | Aller direct via groupes Facebook/Discord métier |

### 15.8 Risque conformité

| Scénario | Probabilité | Impact | Plan d'action |
|---|---|---|---|
| RGPD audit CNIL surprise | Low | High | Documentation tenue à jour, DPA partenaires signés, droits users testés trimestriellement |
| Factur-X tardive (norme évolutive) | Medium | Medium | Monitoring DGFiP communications, intégration adaptable |

---

## 16. Roadmap 24 mois (trimestres)

### Q2 2026 (M1-M3) — Foundation
- M1 : Setup monorepo, Supabase EU, design system tokens, branche `phase-1/foundation`
- M2 : Auth + onboarding + Mission CRUD + Client CRUD + API BAN/Cadastre
- M3 : Saisie terrain V1 (capture photo + vocal Whisper), Mobile iPad MVP

### Q3 2026 (M4-M6) — Core differenciateurs
- M4 : Claude Vision équipements + croquis 2D + LiDAR exploratoire
- M4 : **Démarrage dossier validation ADEME 3CL-2021** (en parallèle)
- M5 : Export ZIP Liciel V1 (.mdb + XML + photos), tests sur 5 missions réelles
- M5 : Recommandations post-DPE F/G (Claude + DB aides)
- M6 : Devis + facturation Factur-X + DocuSeal + Stripe
- M6 : **Lancement bêta privée fermée 30-50 users**

### Q4 2026 (M7-M9) — Launch
- M7 : Hardening bêta, support IA, KB articles ≥ 50
- M8 : Performance, accessibilité, tests e2e complets, PWA web final
- M9 : **Lancement public KOVAS Compagnon 59€/mo** (sept-oct 2026)
- Cibles fin M9 : 30-50 abonnés payants, 50-80 essais en cours

### Q1 2027 (M10-M12) — Scale Phase 1
- M10-M12 : Dashboard analytics, espace client B2B partial, programme parrainage, ambassadors
- Cibles M12 : 80-100 abonnés (50-65k€ ARR), NPS ≥ 50, churn < 3%

### Q2 2027 (M13-M15) — Pivot Phase 2 préparation
- Validation ADEME 3CL-2021 attendue M14-M18
- Build modules amiante/plomb/gaz/élec/termites en parallèle
- Génération PDF native (sans Word)

### Q3 2027 (M16-M18) — Lancement Phase 2
- M18 : **Lancement KOVAS Complet 89€/mo**
- Migration en douceur des abonnés Compagnon (offre upgrade -25% 1ère année)
- Cibles M18 : 300-400 abonnés (~250-350k€ ARR)

### Q4 2027 (M19-M21) — Phase 3 préparation
- Audit énergétique module
- Marketplace MAR/RGE bêta
- Assistant IA conversationnel V1

### Q1 2028 (M22-M24) — Lancement Phase 3
- M22 : **Lancement KOVAS Augmenté 149€/mo**
- Marketplace ouverte, commissions actives
- Cibles M24 : 600-700 abonnés (~500-600k€ ARR)

---

## 17. Open Questions (Discovery — to be resolved Phase 3)

Décisions à valider en Phase 3. Numérotation : D1xx (métriques), D2xx (DoD features), D3xx (tech), D4xx (onboarding), D5xx (GTM), D6xx (pricing), D7xx (légal), D8xx (support), D9xx (risques).

### Métriques (D1xx)
- D101-117 : cibles exactes TTFV, activation, churn, NPS, DAU/MAU, missions/user/mois, latences API, crash-free rate

### Definition of Done (D2xx)
- D201-207 : seuils précision Whisper jargon, Vision marques chaudière, dataset tests, chiffrage travaux ±%

### Technique (D3xx)
- D301 : région Supabase (Paris vs Frankfurt)
- D302 : modèle Claude exact (Sonnet 4.6 par défaut, Opus 4.7 pour cas critiques ?)
- D303 : Whisper vs Deepgram/Cloudflare
- D304 : SMS provider (Twilio/OVH/OctoPush)
- D305 : SQLite mobile lib (op-sqlite vs WatermelonDB)
- D306 : i18n prête dès J0 ou non
- D307 : dark mode auto système ou toggle manuel

### Onboarding (D4xx)
- D401 : essai 30j sans CB / avec CB / pas d'essai
- D402 : auth method (email+pass / magic link / OAuth Apple+Google)
- D403 : gamification oui/non, et si oui quel format

### GTM (D5xx)
- D501 : conversion essai → payant cible exacte
- D502 : budget Sales Navigator
- D503 : récompense parrainage (1 mois gratuit ?)
- D504 : programme ambassadeurs (10-15 power users)
- D505 : confirmation bêta privée fermée M6-M9

### Pricing (D6xx)
- D601 : quota missions inclus par phase / au-delà 1€/mission ?
- D602 : Yousign eIDAS option +10€/mo ou pas

### Légal (D7xx)
- D701 : avocat retenu (recommandations : Yagoo, Lex2B, Captain Contrat ?)
- D702 : courtier assurance RC pro
- D703 : provider Factur-X / PDP
- D704 : i18n architecture prête (oui par défaut)
- D705 : montant assurance RC (500k€ par défaut)
- D706 : provider backup S3 EU (OVHcloud, Scaleway, Wasabi EU)

### Support (D8xx)
- D801 : outil ticketing (Plain/Pylon/Intercom/custom)

### Risques (D9xx)
- D901 : protection IP design / brevet ?
- D902 : pitch board investors si rachat tentative ?
- D903 : lawyer IP/interopérabilité retenu
- D904 : cofounder advisor backup
- D905 : runway personnel/Nexus exact (mois)

### Domaine métier (D10xx — à étendre Phase 3)
- D1001 : accès à un export Liciel réel pour reverse-engineer .mdb + XML
- D1002 : workflow "Assistance Liciel" — wireframe à valider (copy-paste manuel vs bridge accessibility API Windows)
- D1003 : import des données Liciel existantes des utilisateurs (parsing inverse de leur base)
- D1004 : combien de diagnostiqueurs par cabinet en Phase 1 (mono-user ou déjà multi-user)
- D1005 : schéma de données entités/relations exact
- D1006 : volume photos/mission moyen, taille stockage estimée
- D1007 : Géorisques vs Preventimmo pour ERP
- D1008 : télémètres BLE supportés Phase 1 (Bosch GLM 50C, Leica Disto X3/X4) — modèles exacts + protocole BLE
- D1009 : 4 types de mission Phase 1 (vente, location, audit, copro) — couverture confirmée

### Comptes & infra (D11xx)
- D1101 : comptes Anthropic / OpenAI / Stripe / Supabase / Vercel / Expo / Resend / Sentry / PostHog déjà créés ?
- D1102 : compte Apple Developer (necessary pour TestFlight + App Store)
- D1103 : compte Google Play Developer (Phase 2)
- D1104 : budget mensuel acceptable services pré-prod
- D1105 : stratégie staging Vercel (preview sur PR + staging branch ?)

---

## 18. Annexes

### 18.1 Références marché
- Wiki Liciel : structure ZIP + 8 000 champs documentés publiquement
- Code Propriété Intellectuelle : L122-6-1, L342-3 (interopérabilité autorisée)
- ADEME 3CL-2021 : méthode officielle DPE
- Décret 2026 : facturation électronique Factur-X obligatoire

### 18.2 Inspirations design
- SugarCRM Customer Journeys dashboard
- Linear (linear.app)
- Vercel Dashboard
- Stripe Dashboard
- Notion 2024-2026

### 18.3 Sources des données marché
- COFRAC certifications actives
- Fédérations métier (SIDIANE, FIDI)
- Brain dump fondateur (recherche préalable)
- Veille concurrentielle continue (à instrumenter)

### 18.4 Glossaire
- **DPE** : Diagnostic de Performance Énergétique
- **ADEME** : Agence de la transition écologique
- **3CL-2021** : méthode officielle de calcul DPE depuis 2021
- **MaPrimeRénov'** : aide à la rénovation énergétique
- **CEE** : Certificats d'Économies d'Énergie
- **éco-PTZ** : Prêt à Taux Zéro rénovation
- **MAR** : Mon Accompagnateur Rénov'
- **RGE** : Reconnu Garant de l'Environnement
- **ERP** : État des Risques et Pollutions
- **DTG** : Diagnostic Technique Global (copropriété)
- **PPPT** : Projet de Plan Pluriannuel de Travaux
- **COFRAC** : Comité français d'accréditation
- **Carrez** : surface habitable (vente)
- **Boutin** : surface habitable (location)
- **eIDAS** : règlement européen signature électronique
- **PPF** : Portail Public de Facturation (Factur-X)
- **PDP** : Plateforme de Dématérialisation Partenaire (Factur-X)

### 18.5 Stack résumé en 1 ligne
React Native+Expo SDK 52 / Next 15 / Supabase EU (PG+Auth+Storage+Realtime+EdgeFn+RLS) / Claude Sonnet 4.6 / Whisper / Stripe / DocuSeal / Resend / Vercel / Expo EAS / Railway / Sentry / PostHog / pnpm monorepo / TypeScript strict.

### 18.6 Budget setup cible
**Initial** : < 500€ — révisé 18/05 à **~6 000€ setup M0-M9** vu nature B2B + assurance + INPI + comptes services + licence Liciel fixtures. Détail dans [`economics.md`](economics.md) §9.

---

## 19. Refonte 18/05 + Modification 18 — pointeurs vers les artefacts dérivés

> **⚠️ Modification 18 (18/05) ajoute** :
> - MVP V1 = **10 features cœur** (croquis 2D retiré V1 → V2)
> - Focus **8 diagnostics standards** (92% volume FR) — audit/DTG/marketplace MAR-RGE **DÉFINITIVEMENT SUPPRIMÉS**
> - Stratégie export **3 modes formalisée** : Email + GDrive auto-sync + DL direct
> - Approche **IA hybride** parser custom + Claude Haiku (marge brute 80%)
> - **Phase 4 recentrée** : expansion géo BE/CH/LU OU productivité avancée
> - Projections révisées : M12 126k€ / M24 867k€ / M36 2,9M€ ARR
>
> Document détaillé : [`/docs/modification-18-mvp-v1-extended.md`](../../docs/modification-18-mvp-v1-extended.md)

Cette section consolide les pointers vers les artefacts produits suite à la refonte structurelle du 18/05. Tout document indiqué ici remplace les sections obsolètes du PRD ci-dessus.

| Sujet | Document de référence (authority) |
|---|---|
| **Vision produit + 6 features MVP + 3 différenciateurs Phase 1** | [`CLAUDE.md`](../../CLAUDE.md) §2-3, §20 + [`features-roadmap.md`](features-roadmap.md) |
| **Pricing 4 tiers + mécaniques anti-friction** | [`pricing-strategy.md`](pricing-strategy.md) |
| **Économie corrigée (ARR M24 1M€, M36 2,77M€)** | [`economics.md`](economics.md) |
| **GTM révisé (essai 14j, conversion 22-28%, CAC 400€)** | [`gtm.md`](gtm.md) |
| **Roadmap features V1/V2/V3 + Phase 2-4** | [`features-roadmap.md`](features-roadmap.md) |
| **Recrutement advisor + structure équipe** | [`team.md`](team.md) |
| **Planning sprint 14 jours détaillé** | [`planning-14-jours.md`](planning-14-jours.md) |
| **Stratégie défensive Liciel** | [`kovas-defense-strategy.md`](kovas-defense-strategy.md) |
| **Discovery + 145+ décisions validées** | [`DISCOVERY.md`](DISCOVERY.md) |

### 19.1 Vision Phase 4 — KOVAS Field Compliance OS (M30+)

Extension à d'autres marchés de productivité terrain réglementé.

| Vertical | Population FR | ARPU estimé | TAM annuel |
|---|---|---|---|
| Audit énergétique avancé (RGE) | 8 000 | 200-300€/mo | 25 M€ |
| États des lieux locataires | 50 000 agences | 50-100€/mo | 50 M€ |
| Contrôle technique bâtiment | 5 000 | 150-250€/mo | 15 M€ |
| Expertise assurance habitat | 15 000 | 100-200€/mo | 30 M€ |
| Contrôle conformité ERP | 10 000 | 100-150€/mo | 18 M€ |
| **TAM étendu Phase 4+** | | | **~138 M€/an** |
| **TAM cumulé total KOVAS** | | | **~170 M€/an** |

**Pas d'action immédiate** — optionalité long terme documentée pour pitch deck investisseurs si offre opportuniste.

### 19.3 Gain Tracker System (V1.5, sprints 15-17 post-launch — Modification 19)

> **Document détaillé** : [`/docs/gain-tracker-system.md`](../../docs/gain-tracker-system.md)
> **Avatar client référent (critique)** : [`/docs/avatar-client.md`](../../docs/avatar-client.md)

**Objectif** : démontrer en permanence le ROI du produit, réduire churn de 6%→4% et augmenter LTV +50%.

**7 éléments constitutifs** :

1. **Compteur permanent dashboard** : "23h 47min économisées ce mois" — top-right, temps réel
2. **Page "Mon activité"** : stats cumulées, évolution mensuelle, statuts pros débloqués
3. **Tracking baseline avant/après KOVAS** : 2 questions signup + toast post-mission
4. **Statuts professionnels (7 niveaux)** : Utilisateur Pro / Confirmé / Sénior / Premium / Ambassadeur / Fidèle / Expert
5. **Rapport mensuel email** : sobre, business, 1 page, signature humaine Benjamin Bel
6. **Image LinkedIn 1080×1080** : sobre + texte pré-rédigé professionnel (LinkedIn ONLY)
7. **Statistiques anonymisées** : tranches (top 10/25/50%), JAMAIS classement nominatif

**Avatar client** :

- 43 ans moyen, 90% hommes
- 70% non issus du bâtiment (reconversions)
- 40% ex-demandeurs d'emploi
- Profil dominant : ex-cadre reconverti ou ex-artisan/BTP
- **Mentalité** : professionnel sérieux, pragmatique, ROI mental permanent, pas tech-savvy mais utilise Liciel quotidiennement
- **Ton à utiliser** : SOBRE et PROFESSIONNEL, JAMAIS gaming/lifestyle/millennial

**Effort dev** : 8 jours étalés sprints 15-17 (semaines 3-5 post-launch).

**Cibles métriques M12** :
- Churn mensuel < 4% (vs 6%)
- NPS > 55 (vs 35)
- Coefficient viral K = 1,5 (vs 1,2)
- LTV +50% (vs baseline)

### 19.2 UX anti-friction paiement (résumé)

| Composant | Description | Référence |
|---|---|---|
| **CB enregistrée 1 fois** (Stripe Customer + PaymentMethod) | Jamais redemandée pour dépassements ou changement de tier | `pricing-strategy.md` §9.1 |
| **Widget transparence permanent** (dashboard) | `Ce mois : 73 missions • 13 au-delà — Estimation : 78,50€` | `pricing-strategy.md` §9.2 |
| **Notifications positives aux seuils** (80%/100%/150%) | Info contextuelle + suggestion upgrade jamais bloquante | `pricing-strategy.md` §9.3 |
| **Plafond mensuel auto-protecteur** | Au-delà, missions fonctionnelles mais branding KOVAS revient sur PDF | `pricing-strategy.md` §9.4 |
| **Email récap mensuel** (28 du mois) | Transparent, valorisation temps économisé | `pricing-strategy.md` §9.5 |
| **Email "Tu paies trop" auto** | Suggestion downgrade si dépassement 3 mois consécutifs | `pricing-strategy.md` §9.6 |

---

## 21. Stratégie d'autonomisation IA progressive sur 36 mois

> **Document détaillé** : [`/docs/ai-autonomy-strategy.md`](../../docs/ai-autonomy-strategy.md)
>
> Cette section est CRITIQUE pour l'économie unitaire long terme et le moat technologique. Elle complète les sections précédentes sans les remplacer.

### 21.1 Objectif stratégique

Réduire progressivement la dépendance aux APIs IA externes (Anthropic Claude, OpenAI Whisper) sur 36 mois, **sans jamais sacrifier la qualité du produit**.

**Cible chiffrée** :
- Marge brute : **77% (M12) → 85%+ (M36)**
- Économies IA : **150-200k€/an à M36**
- Moat technologique grâce aux données métier accumulées

### 21.2 Principe directeur

> *L'indépendance 100% des IA externes est un mythe et un mauvais objectif. Le bon objectif est de remplacer 60-80% des appels IA par du compute propre, tout en gardant Claude pour les 20-40% de cas complexes où la qualité est critique.*

### 21.3 Les 4 phases sur 36 mois (résumé)

| Phase | Période | Stratégie | Coût IA (à 2000 users) | Économie vs P1 |
|---|---|---|---|---|
| **Phase 1** | M0-M12 | Dépendance totale Claude + Whisper API | 6 000-8 000€/mois | – |
| **Phase 2** | M12-M18 | Optimisations Anthropic (cache, hybride, batch) + test Deepgram | 4 000-5 000€/mois | **-30%** |
| **Phase 3** | M18-M24 | Self-hosting Whisper + Vision custom YOLO on-device | 2 500-3 500€/mois | **-55%** |
| **Phase 4** | M24-M36 | Modèle français propriétaire (Llama 3.3 70B fine-tuné) | 1 000-1 500€/mois | **-80%** |
| **Phase 5** | M36+ | 80/20 algos propres + Claude pour cas complexes | 1 000-2 000€/mois | **-80% stable** |

### 21.4 Investissement et ROI

| Phase | Investissement | Économies cumulées récurrentes |
|---|---|---|
| Phase 2 (M12-M18) | ~0€ (config + dev interne) | -30% facture IA |
| Phase 3 (M18-M24) | 20-30k€ (GPU + dataset + dev pipeline) | ~45k€/an récurrent à M22 |
| Phase 4 (M24-M36) | 40-80k€ (ingénieur ML + compute + cleaning) | 50-70k€/an récurrent à M36 |
| **Total 36 mois** | **60-110k€** | **150-200k€/an à M36** |

### 21.5 Auto-apprentissage perpétuel

3 pipelines documentés dans [`/docs/ai-autonomy-strategy.md`](../../docs/ai-autonomy-strategy.md) §8-9-10 :

1. **Amélioration Vision IA via corrections utilisateurs** — re-fine-tuning YOLO tous les 3-6 mois sur dataset cumulé
2. **Personnalisation par utilisateur** — profil linguistique JSONB injecté dans prompts (Claude cache 1h + Whisper `prompt` param + iOS `contextualStrings`)
3. **Détection patterns métier** — ML batch hebdo sur 100 000+ missions pour suggestions contextuelles + pré-fill prédictif + alertes cohérence

### 21.6 Conditions de déclenchement par phase

| Transition | Conditions cumulatives |
|---|---|
| Phase 1 → 2 (M12) | Lancement public effectif, ≥ 100 abonnés payants |
| Phase 2 → 3 (M18-M20) | Optimisations Phase 2 déployées, ≥ 500 abonnés payants, 500 000+ requêtes API cumulées |
| Phase 3 → 4 (M24+) | 1 500+ abonnés payants, ARR 1,5 M€+, 50 000+ missions nettoyées, ressources ingénieur ML, validation A/B 3 mois |

### 21.7 Mythes à dégonfler

1. ⛔ **"Le SaaS devient 100% indépendant des IA externes"** — Faux. On remplace 60-80%, pas 100%.
2. ⛔ **"Le SaaS s'améliore tout seul sans intervention humaine"** — Faux. ~30 jours dev + 2-4h/mois validation humaine.
3. ⛔ **"L'auto-apprentissage rend le produit gratuit à servir"** — Faux. Self-hosted bien fait = 30-50% du coût Claude, pas 0%.

### 21.8 3 pièges à éviter

1. ⚠️ **Souveraineté technologique prématurée** — n'internaliser que quand 1000+ abonnés ET 500 000+ requêtes accumulées
2. ⚠️ **Sous-estimation du coût de maintenance** — ne self-hoster que si économie API > coût maintenance × 2
3. ⚠️ **Qualité non garantie** — toute migration via A/B test 3 mois avec mesure satisfaction utilisateur

### 21.9 Métriques à instrumenter PostHog dès J0

- `ai.claude.cost_eur` par mission (event par appel API)
- `ai.whisper.cost_eur` par minute audio
- `ai.cache_hit_rate` (% appels servis depuis prompt cache)
- `ai.fallback_provider_used`
- `vision.user_correction_rate`, `voice.user_correction_rate`
- `ai.{operation}.latency_p95_ms`, `ai.{operation}.error_rate`

Ces métriques sont **essentielles dès Phase 1** pour piloter les transitions Phase 2-3-4 en data-driven.
