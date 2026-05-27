# CLAUDE.md — KOVAS App

> Document de référence pour Cursor + Claude Code en pair-programming.
> **Authority order** : ce CLAUDE.md > `.claude/orchestration-kovas-app/DISCOVERY.md` > PRD > recherches.
> Tout conflit doit être résolu en faveur du document supérieur.
> **Identité légale Nexus 1993** : [`docs/credentials-setup/nexus-1993-identity.md`](docs/credentials-setup/nexus-1993-identity.md) (source vérité)
> **Pivot PWA-only Phase 1** : [`docs/pwa-pivot-decision.md`](docs/pwa-pivot-decision.md) (apps natives différées V2)
> **Modification 18 MVP V1 étendu + Focus 8 diagnostics** : [`docs/modification-18-mvp-v1-extended.md`](docs/modification-18-mvp-v1-extended.md) (10 features V1, croquis V2, audit/DTG/marketplace MAR-RGE supprimés)
> **Avatar client (TOUT décision produit doit passer ce test)** : [`docs/avatar-client.md`](docs/avatar-client.md) — diagnostiqueur 43 ans, ex-cadre reconverti, ton SOBRE PROFESSIONNEL, **JAMAIS gaming/lifestyle/millennial**
> **Système Gain Tracker (V1.5, sprints 15-17 post-launch, 8j dev)** : [`docs/gain-tracker-system.md`](docs/gain-tracker-system.md) — compteur permanent + page activité + rapport mensuel + image LinkedIn + statuts pros + stats anonymisées
> **Wireframes écrans v4 (spec implémentation, historique)** : [`docs/design/KOVAS_Pages_Wireframes_v4.md`](docs/design/KOVAS_Pages_Wireframes_v4.md)
> **Refonte acqui-target 2026-05 — Stratégie économique IA** : [`docs/refonte-2026-05/AI_ECONOMICS.md`](docs/refonte-2026-05/AI_ECONOMICS.md) (modèle de coût Claude/Whisper, baselines marge brute par profil, alertes coût)
> **Refonte acqui-target 2026-05 — Setup Upstash rate-limit** : [`docs/refonte-2026-05/UPSTASH-SETUP.md`](docs/refonte-2026-05/UPSTASH-SETUP.md) (provisioning Redis EU, vars d'env, FAQ symlink `.env.local`)
> **Refonte acqui-target 2026-05 — Checklist migration prod** : [`docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md`](docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md) (séquence déploiement, rollback, smoke tests post-bascule)
> **Légal — CGV v1.4 (refonte acqui-target)** : [`docs/legal/03-cgv.md`](docs/legal/03-cgv.md) (4 tiers + essai 30j avec CB + dual track Annuaire/Logiciel + clauses Upstash rate-limit API publique)
> **🎯 DESIGN SYSTEM FINAL v5 (CANONIQUE)** : [`docs/design/KOVAS_UIUX_v5_Final.md`](docs/design/KOVAS_UIUX_v5_Final.md) — **bascule "productivité B2B sobre" Synthex/Quora** (au lieu de fintech glass) : background **sage pâle `#F5F7F4`** + sidebar **80px icon-only `#0F1419`** + accent UNIQUE **chartreuse `#D4F542`** + cards solides (glass = marketing only). Conservation Urbanist + Instrument Serif italic KPIs + Drama mode 3 contextes (dashboard soir / mode mission / landing). V1 sitemap = 7 sections (Aujourd'hui · Dossiers · Planning · Clients · Biens · Performance · Compte 4 sub). V1.5 ajoute compteur DPE 1000, mode offline complet, 6 diagnostics progressifs, notifications matrice, bar chart pilules verticales (pattern signature), process flow Bézier workflow.
> **Dernière mise à jour** : 2026-05-19 (Design System v5 FINAL — pivot Synthex sobre. Historique v4 [`docs/design/KOVAS_UIUX_App_Complete_v4.md`](docs/design/KOVAS_UIUX_App_Complete_v4.md) : mode hybride **Clear `#FAFBFC`** + **Drama cyan liquide**, navy 5 niveaux `#0F2436/#163144/#1B405B/#2A5478/#3B6995`, **status pills 5 figés** (amber/blue/green/coral/muted), **diagnostic chips 8 types** (DPE/AMIANTE/PLOMB/GAZ/ELEC/TERMITES/CARREZ/ERP), composants atomiques canoniques `<Pill>`/`<GlassCard>`/`<StatusPill>`/`<DiagChip>`/`<WorkflowStepper>`, sidebar 240px permanente, **time-box dev validé 3 sprints (12j)** Sprint A fondations + Sprint B Dashboard/Mission + Sprint C pages clés)

---

## 1. Identité projet

| Champ | Valeur |
|---|---|
| Produit | **KOVAS App** |
| Société éditrice | SASU **Nexus 1993** (siège Paris 8, fondateur en Normandie) |
| Fondateur | Benjamin Bel (solopreneur, 100% temps, ~24 mois runway) |
| Domaine | **kovas.fr** |
| Date démarrage dev | avril 2026 |
| Lancement public visé | **septembre-octobre 2026** |
| Cible | ~13 000 diagnostiqueurs immobiliers indépendants FR |
| Concurrence | Liciel (40-52% PdM, Enersweet/Pictet AM) + AnalysImmo + OBBC + ORIS |

---

## 2. Vision & positionnement

**KOVAS Phase 1 = PWA Next.js 15 (iPad/iPhone/Web unifié) compagnon à Liciel**, qui élimine la friction terrain (saisie vocale, photos géolocalisées, exports multi-format, **bouton Partager 3 modes**).

**Focus 8 diagnostics standards** (92% du volume métier FR) :
- DPE, Amiante, Plomb CREP, Gaz, Électricité, Termites, Carrez/Boutin, ERP
- **EXCLUS DÉFINITIVEMENT** : audit énergétique, DTG, marketplace MAR/RGE

> **KOVAS ne remplace pas Liciel en Phase 1. Il le complète.**
> Phase 2 (M10-M18) : KOVAS Complet remplace Liciel après certification ADEME 3CL-2021 (DPE certifié uniquement, pas audit).
> Phase 3 (M19+) : KOVAS Augmenté = assistant IA conversationnel métier + Vision IA avancée + productivité avancée diagnostics standards.
> Phase 4 (M30+) : **Expansion géographique** (BE/LU/CH, +15k diagnostiqueurs) **OU productivité avancée** (analytics cabinet, marketplace sous-traitance entre diagnostiqueurs). Décision M30 selon traction.

**Promesse mesurable** : gain de 1h30 par mission DPE typique (terrain + retour bureau).

**Objectif business** : **1 M€ ARR à M24** en solopreneur, sans levée. Cible M36 : **2,5-3 M€ ARR** avec Phase 2 lancée.

---

## 3. MVP V1 — 10 features cœur (post-Modification 18 du 18/05)

**Philosophie** : *Faire 10 choses extrêmement bien sur 8 diagnostics standards (92% du marché FR).*

| # | Feature | Effort dev (j) | Note |
|---|---|---|---|
| 1 | **Saisie vocale terrain structurée par pièce** (Whisper FR + parser custom JS 80% + Claude Haiku 20% hybride) | 5 | Approche IA hybride 0,01€/mission (vs 0,15€) |
| 2 | **Photos géolocalisées + annotations basiques** (Web Camera API + Geolocation + Konva — WebP compression 5MB→250KB) | 3 | PointerEvents pression OK |
| 3 | **Auto-complétion adresse + cadastre** (API BAN + IGN + Géorisques ERP) | 2 | Inchangé |
| 4 | 🆕 **Templates pièces pré-remplis** (T2/T3/T4/T5 maison/appartement) | 1 | UX terrain accélérée |
| 5 | 🆕 **Check-lists par type de diagnostic** (validation complétude pré-export) | 1,5 | "Tu n'as pas saisi la VMC, c'est volontaire ?" |
| 6 | 🆕 **Upload documents propriétaire via lien public** | 2 | Client uploade factures énergie / plans / anciens DPE avant visite |
| 7 | 🆕 **Validation cohérence basique** (règles métier, pas d'IA) | 1,5 | "Surface 100m² + chaudière 5kW = peu", "Maison 1850 + étiquette A = à vérifier" |
| 8 | 🆕 **Bouton "Partager vers logiciel principal"** — 3 modes (Email + GDrive/Dropbox auto-sync + DL direct) | 3 | UX cible : 30s-1min vs 1h30-2h re-saisie |
| 9 | **Export multi-format universel** (ZIP Liciel + PDF + Word + CSV + JSON + "Affichage côté") | 7 | Inchangé |
| 10 | **Sync mobile/web + offline complet** (Service Worker + IndexedDB Dexie + queue mutations + LWW) | 3 | PWA-natif |
| **Total effort dev MVP** | | **29 j** | Compressible **22-25 j intensifs** Cursor + Claude Code |

### ⛔ Features RETIRÉES du MVP V1

| Feature | Report |
|---|---|
| **Croquis 2D manuel Apple Pencil** | **V2** (utile pour amiante avancé, audit Phase 3 mais pas indispensable Phase 1) |
| Vision IA reconnaissance équipement | **V2** (3-6 mois post-launch) |
| Croquis IA depuis photo | **V3** |
| Génération recommandations post-DPE F/G auto | **V2** |
| Scan LiDAR iPad Pro 3D | **V3+** ou jamais |
| Assistant IA conversationnel métier | **Phase 3** (M19+) |
| **Marketplace MAR/RGE** | ❌ **ANNULÉ DÉFINITIVEMENT** |
| Multi-utilisateurs cabinet | **V2** / Phase 2 Cabinet tier |
| Signature eIDAS Yousign **en pack mensuel** | Option **ponctuelle 2€/sig** uniquement |
| Télémètres BLE (Leica DISTO, Bosch GLM) | **V2** |
| **Module audit énergétique** | ❌ **ANNULÉ DÉFINITIVEMENT** |
| **Module DTG (Diagnostic Technique Global)** | ❌ **ANNULÉ DÉFINITIVEMENT** |
| API publique | **Phase 2** |
| Espace pro B2B notaires/agences | **V2** |

### Plan de couverture progressive 8 diagnostics

| Période | Diagnostics couverts | % marché cumulé |
|---|---|---|
| **Sprint 14j (V1 V0)** | DPE + Amiante (moteur générique 80% code partagé) | **65%** |
| S3 post-launch | + Carrez/Boutin + ERP (2j) | 67% |
| S4 | + Plomb CREP (2j) | 73% |
| S5 | + Gaz (2j) | 81% |
| S6 | + Électricité (2j) | 89% |
| S7 | + Termites (1,5j) | **92%** |

**Fin M2 post-launch** : 92% du volume diagnostic FR.

---

## 4. Pricing intelligent V5 — 4 tiers Logiciel + 3 tiers Annuaire + 5 Bundles

> **Refonte 2026-05-25 (Lot B43)** : grille recalibrée selon mockup canonique. Les anciens prix V4 (29/59/149/299€) sont préservés à vie pour les abonnés existants via `LEGACY_PLANS` (codes `*_legacy`). Source de vérité : [`apps/web/src/lib/pricing-plans.ts`](apps/web/src/lib/pricing-plans.ts).

### Architecture

**4 tiers Logiciel + Enterprise** avec quotas missions + surplus à l'usage. **3 tiers Annuaire** modèle Doctolib. **5 Bundles** cross-sell logiciel + annuaire.

### Track Logiciel (29 / 79 / 199 / 499 €)

| Tier | Prix HT/mo | Missions | Surplus | Users | Pour qui |
|---|---|---|---|---|---|
| **Solo** | **29€** | 40 | 0,99€ | 1 | Démarrage ou ~10 missions/semaine |
| **Pro (recommandé)** | **79€** | 100 | 0,79€ | 1 + 1 invité | Temps plein, 15-25 missions/semaine |
| **Cabinet** | **199€** | 300 | 0,59€ | 5 | Équipe 2-5 personnes |
| **Cabinet+** | **499€** | 1000 | 0,29€ | 15 | 6-15 personnes, multi-site |
| **Enterprise** | sur devis | illimité | négocié | illimité | Réseau, franchise, > 15 users |

### Track Annuaire (19 / 39 / 79 €)

| Tier | Prix HT/mo | Visibilité | Pour qui |
|---|---|---|---|
| **Présence** | **19€** | Département | Visibilité de base + leads à l'usage |
| **Boost (recommandé)** | **39€** | Top 5 département + badge Vérifié | Passer devant la concurrence |
| **Premium** | **79€** | Top 3 région + badge doré + 3 communes | Capturer tout le marché régional |

### Bundles (Logiciel + Annuaire combinés)

| Bundle | Prix HT/mo | Composition | Économie |
|---|---|---|---|
| **Démarrage** | **39€** | Solo + Présence | −9€ |
| **Croissance (best value)** | **99€** | Pro + Boost | −19€ |
| **Acquisition** | **89€** | Solo + Premium | −19€ |
| **Cabinet** | **229€** | Cabinet + Premium | −49€ |
| **Cabinet+** | **529€** | Cabinet+ + Premium + 5 communes mises en avant | −99€ |

### Add-ons (combinables avec n'importe quel plan)

| Add-on | Tarif |
|---|---|
| Utilisateur supplémentaire | **19€/mo/user** |
| Vérification renforcée | **39€/mo** |
| Au-delà du quota | **0,29€ → 0,99€/mission** selon tier |

### Fidélité progressive (cumulable)

| Trigger | Remise |
|---|---|
| Paiement annuel | **−15%** |
| Après 12 mois (M13+) | **−5% additionnel** |
| Après 24 mois (M25+) | **−10% additionnel** · plafond −30% total |
| Partenaire fondateur (10 places S1 2026) | **2000€ / 3 ans Cabinet** + influence roadmap |

### Phase 2-3 (M10+) — pricing inchangé, features ajoutées

Le pricing V5 reste stable. La Phase 2 (post-cert ADEME M10) débloque le calcul DPE certifié + recos post-DPE F/G + audit énergétique avec mention pour les Cabinet/Cabinet+ sans changement de tarif. La Phase 3 (M19+) ajoute l'assistant IA conversationnel + productivité avancée toujours sans hausse.

### Tarif Founder à vie (10 partenaires fondateurs S1 2026)

- **S1 2026 (10 places)** : **2000€ / 3 ans** sur le tier Cabinet + échange direct fondateur + influence sur la roadmap
- Le tarif Founder Standard 49€/mo est conservé en `founder_legacy` pour les premiers bêta-testeurs déjà engagés
- Badge Founder + accès anticipé Phase 2 + influence roadmap

### Options ponctuelles (paiement à l'usage, en plus des add-ons)

| Action | Tarif unitaire |
|---|---|
| Signature eIDAS Yousign (tiers Solo/Pro) | **2€/signature** |
| Rapport bilingue FR/EN | **5€/rapport** |
| SMS rappel client J-1 | **0,15€/SMS** |

### Engagement annuel : −15% sur tous les tiers (vs −16,67% précédent en 2 mois offerts). Aligné mockup canonique V5.

---

## 5. UX anti-friction paiement

| Composant | Comportement |
|---|---|
| **CB enregistrée 1 seule fois** (Stripe Customer + PaymentMethod) | Saisie à la conversion essai → payant. **Jamais redemandée** pour dépassements ou changement de tier |
| **Widget transparence permanent** (dashboard, en haut à droite) | `Ce mois : 73 missions • 13 au-delà du forfait — Estimation : 78,50€ [Voir le détail]` — temps réel |
| **Notifications positives aux seuils** | 80% : info contextuelle. 100% : valorisation gain de temps + suggestion upgrade. 150% : calcul économies upgrade explicite |
| **Plafond mensuel auto-protecteur activable** | `Plafond max : [120€] — Au-delà, missions restent fonctionnelles mais branding KOVAS revient sur PDF` |
| **Email récap mensuel transparent** (28 du mois) | Missions réalisées, temps économisé, détail facturation, prélèvement annoncé |
| **Email "Tu paies trop" auto** | Si dépassement régulier 3 mois consécutifs → suggestion upgrade tier économique (même si MRR baisse temporairement) |

---

## 6. Essai gratuit 30 jours AVEC CB (modèle Qonto/Linear/ManyChat)

> **Refonte 2026-05-22** : passage de 14 jours sans CB à **30 jours avec CB obligatoire + débit auto à J+30**. Modèle standard SaaS B2B 2026. Le diagnostiqueur sait qu'il s'est inscrit avec sa CB — il utilise = il paie, sans demande de confirmation supplémentaire.

| Paramètre | Valeur |
|---|---|
| Durée | **30 jours calendaires** |
| CB requise | **Oui** — saisie via Stripe Checkout (Setup Intent transparent, pas de débit immédiat) |
| Email pro requis | Oui (pas de gmail/yahoo perso) — validation domaine pro |
| Anti-abus | 1 essai par SIRET vérifié (API INSEE Sirene Phase 2 / Luhn V1) |
| Accès | Complet, toutes les fonctionnalités du forfait choisi |
| Exports | Illimités |
| Branding PDF | Normal (pas de mention "Essai") — l'utilisateur a payé sa CB, l'essai est un crédit de 30j |
| Stripe config | `trial_period_days: 30` + `payment_method_collection: 'always'` |

### Flux technique

1. **Inscription** (`/signup`) — utilisateur saisit email + SIRET + nom + mot de passe.
2. **Checkout** (`/app/account` ou directement) — Stripe Checkout en mode `subscription` collecte la CB. Setup Intent transparent valide la carte (3DS si nécessaire), aucun débit.
3. **Période trial** — la subscription Stripe est en statut `trialing` pendant 30 jours. Statut DB miroir : `status='trialing'`, `is_in_trial=true`.
4. **J+30 — Conversion auto** — Stripe déclenche le 1er débit, statut → `active`. Notre webhook reçoit `customer.subscription.updated`, envoie email de facture et marque `cabinet_trials.converted_to_paid=true`.
5. **Résiliation libre** — Customer Portal Stripe accessible 24/7 depuis `/app/account` (2 clics : `Annuler l'abonnement` → confirmation).

### Séquence emails (avatar SOBRE PROFESSIONNEL, vouvoiement, pas d'emoji)

| Jour | Type | Sujet |
|---|---|---|
| J+1 | Auto | Tutoriel « Votre première mission KOVAS en 10 minutes » |
| J+4 | **Humain (Benjamin)** | Check personnel : « Tout se passe comme prévu ? » |
| J+8 | Auto | « Comment se déroule votre essai ? » + tips diagnostic mobile |
| J+27 | Auto (webhook Stripe `trial_will_end`) | « Votre essai se termine dans 3 jours · prélèvement automatique le [date] » |
| J+30 | Auto (webhook Stripe `customer.subscription.updated`) | Confirmation d'abonnement + lien facture |

### Échec de débit à J+30

Si la CB échoue lors du 1er débit :
- Stripe retry automatique : **J+1, J+3, J+7** après l'échec initial.
- Webhook `invoice.payment_failed` → email contextualisé avec lien Customer Portal pour mise à jour CB.
- Après 3 échecs consécutifs, statut Stripe `unpaid`, compte bascule en **lecture seule** côté app (guard `lib/billing/trial-guard.ts`).
- 3 mois plus tard sans réactivation, suppression définitive (RGPD).

### Cibles conversion essai → payant

Avec CB obligatoire dès J0, la conversion attendue est **plus haute** que sur le modèle sans CB :

- M0-6 : **30-40%** (early adopters préqualifiés, friction CB compensée par 30j sans débit)
- M6-12 : **25-35%** (élargissement)
- M12+ : **28-38%** (maturité + social proof + parrainage)

### Sans conversion (utilisateur résilie pendant l'essai)

Compte gelé 90j, données conservées en lecture seule, réactivation possible via nouveau Checkout. Aucun frais facturé.

---

## 7. Économie réaliste

### Marge brute par profil (Phase 1)

| Profil | Missions | Coûts variables | ARPU | Marge brute |
|---|---|---|---|---|
| Démarrant (Découverte) | 30 | ~8€ | 49€ (29+10×2) | **41€ (84%)** |
| Solopreneur typique (Standard) | 75 | ~16€ | 81,50€ (59+15×1,50) | **65,50€ (80%)** |
| Power user (Volume) | 110 | ~26€ | 99€ | **73€ (74%)** |
| Cabinet Phase 2 (2 users) | 220 | ~48€ | 199€ | **151€ (76%)** |

**ARPU moyen pondéré Phase 1** : ~75€/mo. **Marge brute moyenne : ~77%**.

### 7bis. Stratégie d'autonomisation IA progressive sur 36 mois

> **Document détaillé** : [`/docs/ai-autonomy-strategy.md`](docs/ai-autonomy-strategy.md)

Objectif : **marge brute 77% (M12) → 85%+ (M36)** via réduction progressive de la dépendance Claude/Whisper.

**Principe directeur** : *remplacer 60-80% des appels IA par compute propre, garder Claude pour les 20-40% de cas complexes*. L'indépendance 100% est un mythe.

| Phase | Période | Coût IA (à 2000 users) | Économie vs P1 |
|---|---|---|---|
| Phase 1 — APIs externes 100% | M0-M12 | 6-8 k€/mois | – |
| Phase 2 — Optimisations Anthropic (cache + hybride + batch) | M12-M18 | 4-5 k€/mois | -30% |
| Phase 3 — Whisper self-hosted + Vision YOLO on-device | M18-M24 | 2,5-3,5 k€/mois | -55% |
| Phase 4 — Llama 3.3 70B fine-tuné sur 100k+ missions | M24-M36 | 1-1,5 k€/mois | -80% |
| Phase 5+ — 80/20 algos propres + Claude | M36+ | 1-2 k€/mois | stable |

**Investissement total 36 mois** : 60-110k€. **ROI récurrent M36** : 150-200k€/an + moat technologique (valorisation revente +20-40%).

**Auto-apprentissage continu** : corrections utilisateurs Vision IA + profil linguistique personnalisé + détection patterns métier (100k+ missions).

**Métriques à tracker dès J0** : `ai.claude.cost_eur`, `ai.whisper.cost_eur`, `ai.cache_hit_rate`, `vision.user_correction_rate`, `ai.{operation}.latency_p95_ms`.

### Projections corrigées

| Horizon | Abonnés | ARPU moyen | MRR | ARR | Marge brute | Marge nette annuelle |
|---|---|---|---|---|---|---|
| **M12** | 140 | 70€ | 9 800€ | 117 600€ | ~90 600€ | **~85 800€** |
| **M24** | 800 | 80€ | 64 000€ | 768 000€ | ~591 000€ | **~582 600€** |
| **M36** | 2 100 | 110€ | 231 000€ | 2,77 M€ | ~2,15 M€ | **~2,13 M€** |

**Objectif révisé** : **1 M€ ARR à M24** (vs initial 500-600k€).

### CAC & LTV réalistes

- **CAC essai blended** : ~80€
- **CAC payant blended** : ~400€ (conversion 22-28%)
- **LTV** (24 mois moyenne à 80€/mois) : ~1 920€
- **LTV/CAC** : **4,8** (cible standard SaaS B2B > 3, OK)
- **Payback period** : **5 mois**

---

## 8. Stack technique (figée — PWA-only Phase 1)

> **Modification 17 (18/05)** : pivot PWA-only Phase 1. Apps natives RN+Expo différées V2/Phase 2.
> Détail : [`docs/pwa-pivot-decision.md`](docs/pwa-pivot-decision.md)

### Frontend unifié — Next.js 15 PWA

- **Next.js 15 App Router** + TypeScript strict (**zéro `any`**)
- **Tailwind CSS** + **shadcn/ui** + **Lucide React**
- **next-intl** (i18n) + **next-themes** (dark mode auto + override)
- **Framer Motion**, **Recharts** ou **Visx**
- **PWA** : `next-pwa` ou `serwist` (Service Worker + manifest + cache strategies)
- **Croquis 2D** : **Konva.js + react-konva** (PointerEvents API pour Apple Pencil pressure)
- **Caméra** : `<input type="file" capture="environment">` + `getUserMedia` (HEIF dégradé en JPEG q=80 1920px)
- **Audio** : `MediaRecorder` API + Web Audio API
- **Offline DB** : **Dexie.js** sur IndexedDB (au lieu d'op-sqlite + Drizzle)
- **State** : Zustand + TanStack Query
- **Persistence cache** : IndexedDB + Cache Storage (Service Worker)

### Apps natives — DIFFÉRÉES V2

Apple Developer Program + Google Play + Expo EAS + RN+Expo SDK 52 → **différés V2/Phase 2**. Trigger pour re-activation : ≥ 20% users payants demandent app native OU ≥ 30% taux browser (pas "Added to Home Screen") après 30j.

D-U-N-S 281 515 446 **gardé** (gratuit, lifetime, débloquera Apple Dev enrollment instantanément si retour native plus tard).

### Backend / Data

- **Supabase complet** : PostgreSQL + Auth + Storage + Realtime + Edge Functions + RLS
- Region : **eu-west-3 (Paris)**
- Multi-tenant from day 1 via `organization_id` + `auth.is_member_of()` SECURITY DEFINER helper

### IA

- **Anthropic Claude** :
  - `claude-haiku-4-5` (voice structuration, chatbot)
  - `claude-sonnet-4-6` (vision Phase 2, génération Phase 2, recos Phase 2)
  - `claude-opus-4-7` réservé escape hatch (feature flag)
  - Prompt caching 1h TTL agressif
- **OpenAI Whisper** (`gpt-4o-mini-transcribe`) — primary
- **Deepgram Nova-3 Frankfurt** — fallback EU
- **iOS SFSpeechRecognizer** — offline fallback

### Paiement / Comm

- **Stripe** : Billing (subscriptions 4 tiers), SEPA priorité + CB fallback, Stripe Tax (TVA 20%)
- **Resend** (emails)
- **DocuSeal** self-hosted Railway (signature SES) + **Yousign** ponctuel à 2€/sig (eIDAS)
- **Brevo SMS** (~0,15€/SMS, sourceanté FR)

### Hosting / DevOps

- **Vercel** (web EU Paris)
- **Expo EAS** (builds mobile + OTA)
- **Railway** (DocuSeal + microservice Java/Jackcess MDB writer + outreach agent)
- **Cloudflare** (DNS + CDN + SSL gratuit)
- **GitHub Actions** CI/CD
- **pnpm workspaces** monorepo
- **Sentry** (error tracking) + **PostHog** (analytics + feature flags + session replay)

---

## 9. Identité visuelle — KOVAS Design System v2 (Ron Design Lab adapté, révision 2026-05-19)

> **Authority** : ce document est la référence canonique du design system. Tokens CSS implémentés dans [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css) + [`apps/web/tailwind.config.ts`](apps/web/tailwind.config.ts). Référence visuelle exhaustive dans [`docs/design/kovas-design-system-v2.html`](docs/design/kovas-design-system-v2.html). Verdict pattern-par-pattern dans [`docs/design/ron-design-lab-kovas.md`](docs/design/ron-design-lab-kovas.md).
> Décision 2026-05-19 (3e itération design system) : adoption du système v2 — **cream + navy KOVAS conservé + ambre accent chaud + 5 pastels catégoriels + Manrope + Instrument Serif italic + JetBrains Mono**. Itérations précédentes abandonnées : (1) navy + Manrope monochrome 2026-05-18 ; (2) cobalt + Outfit + butter Ron pur 2026-05-19 J39 ; (3) cette v2 = synthèse des deux + ajouts Ron Design Lab. Le registre marketing Ron (typo 120px, emojis profusion, avatars inline) reste **exclu de l'app** et **réservé à kovas.fr**.

### Palette light (mode par défaut — `:root`)

| Rôle | HSL token | Valeur indicative |
|---|---|---|
| Background page | `--background: 40 30% 95%` | `#F8F5EE` cream |
| Background gradient | `--bg-gradient-from/to: 40 30% 95% → 38 26% 91%` | cream → cream-deep 135° |
| Paper (surfaces de travail) | `--paper / --card: 42 50% 98%` | `#FDFBF6` |
| Card pleine accent | `--card-accent: 218 60% 15%` | `#0F1E3D` navy plein |
| Card accent foreground | `--card-accent-foreground: 40 30% 95%` | cream sur navy |
| CTA primaire | `--cta: 218 60% 15%` | `#0F1E3D` navy |
| CTA hover | `--cta-hover: 220 65% 10%` | `#08122A` navy-deep |
| Navy soft | `--navy-soft: 222 41% 28%` | `#2A3A65` backgrounds adoucis |
| **Accent chaud (nouveau v2)** | `--accent-warm: 28 92% 44%` | `#D97706` ambre saturé |
| Accent warm soft | `--accent-warm-soft: 38 100% 92%` | `#FFEDD5` fond pastille |
| Accent warm glow | `--accent-warm-glow: 38 100% 96%` | `#FFF7E8` halo radial |
| Texte primary | `--foreground: 218 60% 15%` | `#0F1E3D` ink |
| Texte soft | `--ink-soft: 220 42% 22%` | `#1F2E4D` sous-titres |
| Texte mute | `--muted-foreground: 220 25% 38%` | `#4A5878` ink-mute |
| Texte faint | `--subtle-foreground: 219 17% 57%` | `#7E8AA4` ink-faint |
| Texte ghost | `--ink-ghost: 220 17% 73%` | `#B0B8C8` placeholders |
| Borders rule | `--border: 40 22% 78%` | `#D5CDB8` |
| Borders soft | `--border-soft: 40 25% 85%` | `#E5DECB` séparateurs |

### Palette dark (V1 actif, `.dark`) — refonte complète v2

| Rôle | HSL token | Valeur indicative |
|---|---|---|
| Background | `--background: 222 47% 7%` | `#0A1224` navy ultra-deep |
| Paper / Card | `--paper / --card: 220 30% 14%` | `#1A2238` surfaces travail |
| Card accent | `--card-accent: 28 92% 44%` | ambre plein (inversion light) |
| CTA | `--cta: 218 55% 65%` | `#6A8AC4` navy-light contraste |
| CTA foreground | `--cta-foreground: 222 47% 7%` | navy-deep sur cta clair |
| Accent warm | `--accent-warm: 38 92% 56%` | ambre clarifié |
| Foreground | `--foreground: 40 30% 95%` | cream inversé |
| Borders | `--border: 220 18% 24%` | très discret |
| Pastels | désaturés et assombris | fonds catégories adapté |

### Sémantiques système (badges, indicateurs)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--accent-blue` | `217 91% 60%` (#3B82F6) | `213 94% 68%` | Info, mission planifiée |
| `--accent-green` | `158 84% 30%` (#059669) | `158 60% 56%` | Success, DPE A-C, exporté |
| `--accent-red` | `0 73% 50%` (#DC2626) | `0 91% 71%` | Danger, DPE F-G, impayé |
| `--accent-yellow` | `38 92% 50%` (#F59E0B) | `43 96% 56%` | Warning, DPE D-E |
| `--accent-orange` | `25 95% 50%` (#F97316) | `25 95% 60%` | Warning saturé (legacy) |

### Pastels catégoriels (signature v2 — types de diagnostic)

| Token | Light | Dark | Mapping diagnostic |
|---|---|---|---|
| `--pastel-butter` | `46 100% 89%` (#FFF0C5) | `46 30% 25%` | **DPE** (énergie A-G), **ERP** (info) |
| `--pastel-lime` | `80 47% 89%` (#E5F0D5) | `80 25% 22%` | **Électricité** (vert tech) |
| `--pastel-peach` | `20 100% 92%` (#FFE0D5) | `20 30% 25%` | **Amiante**, **Termites** (alerte sanitaire) |
| `--pastel-lavender` | `264 47% 92%` (#E8E0F5) | `264 25% 28%` | **Plomb** (toxique) |
| `--pastel-sky` | `210 50% 91%` (#DAE8F5) | `210 25% 25%` | **Carrez/Boutin**, **Gaz** (mesure/air) |

Mapping codé dans [`lib/mission-pastels.ts`](apps/web/src/lib/mission-pastels.ts) (helper `MISSION_PASTEL_CLASS` + `MISSION_TYPE_LABEL`).

### Typo : Manrope + Instrument Serif italic + JetBrains Mono

Variables CSS : `--font-manrope` + `--font-instrument-serif` + `--font-jetbrains-mono` câblées dans [`layout.tsx`](apps/web/src/app/layout.tsx).

| Élément | Famille | Taille | Graisse |
|---|---|---|---|
| **KPI hero (GainTracker, cockpit)** | `font-serif italic` (Instrument Serif) | 80-120px | 400 |
| **Mot-clé accent dans H1** | `font-serif italic` (utility `.text-display-serif`) | hérite | 400 |
| H1 hero | `font-sans` (Manrope) | 48-96px | Extrabold 800 |
| H2 section | `font-sans` | 32-56px | Bold 700 |
| H3 card title | `font-sans` | 18-22px | Bold 700 |
| Body | `font-sans` | 14-16px | Regular 400 |
| Eyebrow / mono label | `font-mono` (JetBrains) | 11-12px | Medium 500 uppercase 0.06em |
| Time display (MissionCard) | `font-mono` | 22-24px | Semibold 600 |
| Reference dossier (DOS-XXXX) | `font-mono` | 12-14px | Medium 500 |

**Pattern signature** : `<h1>Bonjour Benjamin, <span className="text-display-serif">votre journée</span></h1>` — le serif italique met en relief le mot-clé éditorial.

### Spacing — système 4x rigoureux

Aligné Tailwind par défaut (`p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-5`=20px, `p-6`=24px, `p-8`=32px, `p-10`=40px, `p-12`=48px, `p-16`=64px). **Aucune valeur arbitraire** — la cohérence visuelle vient de la rigueur d'espacement, pas de la décoration.

### Radius scale v2

| Token | Valeur | Usage |
|---|---|---|
| `rounded-sm` | 8px | Inputs petits, tags catégorie |
| `rounded-md` | 12px | Inputs standards |
| `rounded-lg` | 18px | Cards intérieures |
| `rounded-xl` | 24px | Cards principales (Card variant flat) |
| `rounded-2xl` | 32px | Hero, cards premium (Card variant accent) |
| `rounded-pill` | 999px | CTA pillule, badges, status pills |

### Ombres signature Ron — 5 niveaux gradués

`shadow-glass-xs` / `-sm` / `-` / `-lg` / `-hover` — neutres basées sur `--foreground` 4-10% opacity. **JAMAIS** `shadow-lg` / `shadow-2xl` / glows colorés (sauf glow ambre radial GainTracker).

### Règles strictes (non négociables)

- **Border-radius** : voir scale ci-dessus
- **Glassmorphism léger** : décision P6 — Option B "Adapter". Glass **réservé aux surfaces flottantes** (header sticky, sidebar, command palette, bottom sheets, app-nav-tabs, calendar sticky header) via `.glass-*` utilities. Cards de travail = `Card variant="flat"` (défaut)
- **CTA primaire** : pillule navy `#0F1E3D` (`bg-cta text-cta-foreground rounded-pill`), padding `12px 32px`, font-weight 600, ombre `shadow-cta`, hover lift `-1px` + `shadow-cta-hover`
- **CTA warm (nouveau v2)** : pillule ambre `#D97706` (`bg-accent-warm`), pour célébration / énergie positive (gain tracker action, conversion essai→payant). À utiliser **parcimonieusement**
- **Hero KPI dramatisé** : Instrument Serif italic 80-120px sur card paper ou card accent navy avec glow ambre (cf. `GainTrackerCard`)
- **Pastels catégoriels** : usage UNIQUEMENT en fond de tags type de diagnostic ou de mini-cards catégorielles. **JAMAIS** sur CTA / surfaces larges / texte
- **Gradients** : autorisés UNIQUEMENT pour le fond page (`#F8F5EE → #EFEAD9`) + glow radial ambre subtle sur card accent. **JAMAIS** multicolores
- **Couleurs flashy/néon, violet cinematic** : **interdits**
- **Bordures** : 1px max, tokens `--border` ou `--border-soft` uniquement
- **Dark + Light** : auto système + override (next-themes), V1 actif, defaultTheme=`light` — toggle uniquement sidebar
- **Animations** : `fade-in 0.3s ease` sur entrée page + `pulse-soft 2s` sur dot StatusPill amber (en cours). PAS de bounces. Respect `prefers-reduced-motion`
- **PDF générés** : toujours en clair (impression), couleurs sémantiques DPE A-G conservées

### Composants canoniques v2

- **`Button`** : variants `default` (pillule navy CTA), `outline` (paper + bordure rule), **`warm` (NEW v2 — pillule ambre)**, `ghost` (transparent hover cream-deep), `link`, `glass` (opt-in surface flottante), `destructive` (rouge). Sizes : `default` (h-10), `sm` (h-8), `lg` (h-12), `icon` (size-10 rounded-full)
- **`Card`** : 4 variants — `flat` (défaut, paper opaque + border + shadow-glass-sm, rounded-xl) · `glass` (opt-in surfaces flottantes, rounded-xl) · `accent` (navy plein, rounded-2xl, hero visuels GainTracker / CTA landing) · **`warm` (NEW v2 — fond ambre-soft, alerte douce / mise en avant)**
- **`Badge`** : **9 variants** — `default` (cobalt CTA) + `outline` + `muted` + sémantiques `blue` (info) + `green` (DPE A-C) + `red` (DPE F-G) + `orange` (warning saturé) + `yellow` (DPE D-E warning) + **`amber` (NEW v2 — célébration, action positive saturée)**. Pastilles pillule, opacité variable selon variant
- **`StatusPill` (NEW v2)** : dot 8px coloré + halo ring 4px + label texte. Variants : `blue` (planifié) · `amber` (en cours, **pulse 2s animé**) · `green` (terminé) · `muted` (à démarrer). Pour les états vivants, complément du `Badge`
- **`KpiHero`** (signature Ron) : chiffre Instrument Serif italic 60-72px + label + trend pill — composant dédié au cockpit dashboard
- **`MissionCard` (NEW v2)** : grid 3 colonnes (heure mono / info + tags pastels / actions), heure JetBrains Mono 24px, tags pastels catégoriels (via `MISSION_PASTEL_CLASS`), nom h3 bold, adresse meta avec icône MapPin, slot actions ouvert. Cliquable via prop `href`
- **Utilities** : `.glass*` (surfaces flottantes), `.bg-pastel-*` (5 pastels catégoriels), `.text-display` / `.text-display-serif`, `.animate-pulse-soft` (dot StatusPill)

### Deux registres Ron — usage KOVAS

| | Marketing `kovas.fr` (landing, blog, OG images) | App `/app/*` (PWA terrain + bureau) |
|---|---|---|
| Typo | Manrope 60-120px expressif + Instrument Serif italic à profusion + emojis micro-copy hero | Manrope 14-48px + Instrument Serif italic **sur KPIs hero + accents éditoriaux H1** + JetBrains Mono pour labels mono |
| Densité | Très aérée | Dense (data, listes, tables) avec respiration KPI |
| Couleurs | Multi-pastels Ron OK (crème, butter, cobalt, vert, terracotta léger) | **Cobalt + butter** signature + sémantiques. Pas de terracotta |
| Emojis | OK micro-copy hero | Réservés onboarding / empty states ; jamais facturation ni alertes graves |
| Inline avatars/typo | OK (témoignages, hero) | Non |

> Cf. [`docs/design/ron-design-lab-kovas.md`](docs/design/ron-design-lab-kovas.md) pour la grille de décision pattern-par-pattern et les exemples sourcés Tectra · Lumos · Tenancy.

---

## 10. Contraintes techniques non négociables

- **TypeScript strict** partout, zéro `any`
- **Composants fonctionnels** uniquement
- **Mobile-first**, responsive web
- **Mode offline complet** mobile (sync différée)
- **Sync temps réel** mobile ↔ web via Supabase Realtime
- **Hébergement EU** (Supabase Paris + Vercel EU)
- **RGPD complet** dès le démarrage (consentements, droit à l'oubli, export 1 clic)
- **Code en anglais** (variables/fonctions/classes), **UI strings + commentaires métier en français**
- **Dark + Light** obligatoires
- **Conventions formats régionaux strictes dès J0** :
  - Monnaie : centimes integer (jamais float/string)
  - Pourcentages : 0-1 float
  - Dates : UTC ISO 8601 stockées, timezone utilisateur stockée (default Europe/Paris)
  - Téléphone : E.164 (`+33...`), parse via `libphonenumber-js`
  - Surface : m² float
- **Architecture i18n prête J0** (clés + namespace), FR seule active
- **API officielles en priorité, scraping en fallback** pour toute intégration externe (règle Benjamin 2026-05-27, précisée le même jour) :
  - Ordre de préférence strict :
    1. **API officielle publique** (data.gouv.fr, api.gouv.fr, BCE, ECB, etc.) — TOUJOURS en premier si l'éditeur en fournit une.
    2. **MCP officiel** (Anthropic registry) si l'éditeur en fournit un.
    3. **Connecteur SaaS officiel** (Stripe SDK, Resend SDK, etc.) si l'API REST a un SDK officiel.
    4. **Scraping HTML / RSS / Atom** AUTORISÉ en fallback **uniquement si aucune des 3 options précédentes n'existe pour la source**. Respecter robots.txt + ToS + User-Agent navigateur réaliste + rate-limit poli.
  - Sources réglementaires FR (veille `/dashboard/veille`) :
    - **API officielles disponibles** (à utiliser en priorité) :
      - JORF / arrêtés / décrets → **API Légifrance PISTE** (DILA, OAuth2 gratuit, https://piste.gouv.fr) — inscription développeur requise (action Benjamin)
      - Données ADEME DPE (datasets records) → **ADEME data-fair API** (https://data.ademe.fr/data-fair/api/v1, sans clé)
      - Entreprises (SIRENE) → **API Recherche Entreprises** (https://recherche-entreprises.api.gouv.fr, sans clé)
      - Géorisques (radon, PPRI, argiles) → **Géorisques API** (https://www.georisques.gouv.fr/api, sans clé)
      - Cadastre / adresses → **API BAN** (https://api-adresse.data.gouv.fr, sans clé) + **IGN Géoplateforme** (clé gratuite)
    - **Scraping autorisé (pas d'API officielle disponible)** :
      - ADEME Actualités (blog HTML, pas d'API) → scraping RSS/HTML
      - Cofrac (FAQ + actualités, pas d'API) → scraping RSS/HTML
      - CSTB (actualités bâtiment, pas d'API) → scraping RSS/HTML
      - DGCCRF (alertes + sanctions, pas d'API) → scraping RSS/HTML
      - MTE Logement (annonces ministère, pas d'API) → scraping RSS/HTML
      - AFNOR Normes (pas d'API publique gratuite) → scraping HTML
  - Tout scraping doit être **flagué dans le code** avec commentaire `// SCRAPING_FALLBACK (pas d'API officielle disponible pour cette source)` + lien vers vérification annuelle de l'existence éventuelle d'une nouvelle API.
  - Si l'API officielle devient payante (NewsAPI, AFNOR Pro, etc.), décision business explicite Benjamin avant intégration.
  - **Avant tout scraping**, vérifier : (a) `robots.txt` autorise (b) ToS du site n'interdisent pas (c) UA navigateur respectueux (d) rate-limit poli (max 1 req/seconde).

---

## 11. Structure monorepo cible

```
kovas-app/
├── apps/
│   └── web/           # Next.js 15 PWA (iPad + iPhone + Web — unifié post-pivot 18/05)
├── packages/
│   ├── shared/        # types TypeScript, enums, utilitaires
│   ├── database/      # client Supabase, types générés
│   ├── ai/            # wrappers Claude + Whisper + provider fallback
│   └── liciel-bridge/ # schéma JSON + MDB writer + XML CII pour Imports spécifiques
├── services/
│   └── mdb-writer/    # microservice Java/Jackcess (Linux Railway primary)
├── supabase/
│   ├── migrations/    # schéma SQL versionné
│   └── functions/     # Edge Functions
├── tests/e2e/         # Playwright E2E sur PWA
├── pnpm-workspace.yaml, package.json, tsconfig.json, .env.example
└── CLAUDE.md (ce fichier), README.md
```

⚠️ **Apps natives (`apps/mobile/`) supprimées Phase 1** — différées V2. Cf. [`docs/pwa-pivot-decision.md`](docs/pwa-pivot-decision.md).

---

## 12. Méthode de travail (sprints intensifs)

### Sprint MVP 14 jours (12-14h/jour, solo + Cursor + Claude Code)

| Jour | Tâche |
|---|---|
| 1 | Setup monorepo + Supabase + auth + design system base |
| 2 | Design system complet (Glassmorphism, composants, Manrope) |
| 3 | CRUD missions/clients/biens + auto-complétion adresse BAN/cadastre |
| 4 | Saisie terrain mobile photos + géolocalisation |
| 5 | Saisie vocale + transcription Whisper |
| 6 | Structuration vocale IA (Claude API) |
| 7 | **Checkpoint mi-parcours** + démo terrain réelle |
| 8 | Croquis 2D Apple Pencil + symboles + calcul surface Carrez/Boutin |
| 9 | Dashboard + sync Realtime mobile/web |
| 10 | Mode offline complet + queue mutations |
| 11 | Export multi-format (PDF + Word + CSV + JSON) |
| 12 | Export ZIP Liciel (reverse-engineering) + tests sur 25-30 cas réels |
| 13 | Stripe abonnements 4 tiers + page pricing + widget transparence + tests E2E Playwright |
| 14 | Build prod (Vercel + Expo EAS) + onboarding 10 bêta-testeurs initiaux |

**Buffer polish post-MVP** : jours 15-18 (4 jours réserve).

### Activités parallèles M0-M5

- 50 entretiens découverte LinkedIn (Playwright agent + ADEME public)
- Recrutement advisor diagnostiqueur (terms : 0,5-1% BSPCE, vesting 2 ans, cliff 6 mois)
- Préparation 20 articles KB (génération Claude + relecture)
- Setup INPI dépôt marque KOVAS (classes 9 + 42)
- D-U-N-S + Apple Developer Program

### Discipline qualité

- **Conventional Commits**
- **TypeScript strict** zéro `any`
- **Tests Vitest/Jest** ≥ 80% couverture
- **Tests e2e Playwright** sur flux critiques
- **Sentry** errors + **PostHog** analytics dès J0
- **Branch protection** sur `main` (1 review minimum, CI verte)

---

## 13. Stratégie Liciel — résilience multi-voies

> Référence complète : [`.claude/orchestration-kovas-app/kovas-defense-strategy.md`](.claude/orchestration-kovas-app/kovas-defense-strategy.md)

### Architecture "résilience par diversification"

**Ne jamais avoir un seul chemin d'import vers Liciel.** Tester 3 voies en Sprint 1-2, supporter **au moins 2 voies en production**.

| Voie | Robustesse | Priorité |
|---|---|---|
| **Imports spécifiques XML/Excel** (passerelles publiques Liciel) | 🟢 Solide | **Priorité 1** |
| ZIP "Importer format ZIP" générique | 🔴 Fragile | Priorité 2 |
| Pilotage UI Liciel (pywinauto) | 🟡 Très fragile | Fallback |
| Phase 2 : envoi ADEME direct | 🟢 Indépendance totale | Roadmap M10-M18 |

### Cadre légal sécurisé

- **Art. L122-6-1 III CPI** (observation/étude) + jurisprudence **CJUE SAS Institute c/ WPL (2012)** : format de fichiers de données **non protégé**
- Licence Liciel achetée légitimement à Benjamin Bel + fixtures anonymisées + journal de découverte versionné GPG dans repo `kovas-discovery-log` séparé

### Interdits absolus

- ⛔ Pas de désassembleur (Ghidra, IDA, dotPeek, dnSpy) sur Liciel.exe
- ⛔ Pas d'employé/stagiaire ex-Liciel sur rôles tech
- ⛔ Pas de scraping de WikiLiciel privé via compte tiers
- ⛔ Pas de mention publique de Liciel dans marketing KOVAS 12 premiers mois
- ⛔ Pas de communication sur forums Diagnostic-immo.com

---

## 14. Légal & conformité — IA-first 3 vagues

### Vague 1 (M0-M9) — 100% IA Claude Max + INPI DIY

Budget : **300€** (frais INPI uniquement).
Génération via Claude Max : CGU, CGV, Politique confidentialité RGPD, Politique cookies, Mentions légales, DPA, Charte bêta-testeurs.
Dépôt INPI marque KOVAS DIY (classes 9 et 42).

### Vague 2 (M9-M18) — Audit avocat IP/Tech ciblé

Cabinet boutique **Lefèvre Avocats** ou **Lex2B**.
Budget : **1 000-1 500€**, déclenchement quand MRR atteint 5k€.
Sujets : mémorandum reverse-engineering Liciel + CGU spécifiques métier diagnostic.

### Vague 3 (M18+) — Conseil stratégique au cas par cas

300-500€/h à la demande.

**Budget cumulé 24 mois : 2 800-4 800€**.

---

## 15. Assurance RC pro Hiscox

| Phase | Plafonds | Sous-couvertures | Prime annuelle |
|---|---|---|---|
| Phase 1 (M5-M18) | 500k€/sinistre, 1M€/an | Cyber 500k€, RGPD 50k€, défense juridique 100k€, erreurs IA inclusion explicite, **litiges IP 100k€ (extension obligatoire)** | ~900€ |
| Phase 2 (M10+ post-ADEME) | 2M€/5M€ | + "Responsabilité diagnostic immobilier certifié" 1M€ | 2 500-3 500€ |
| Phase 3 (M19+ marketplace) | 3M€/10M€ | + "Plateforme mise en relation" 2M€ | 4 000-6 000€ |

Souscription Hiscox direct **M5** avant lancement bêta.

---

## 16. Support IA-first custom

- **Ticketing custom Supabase + Resend** (pas de Crisp/Plain externe)
- Tables `support_tickets`, `support_messages`, `support_notifications`
- Bouton Aide flottant in-app + admin `/admin/support`
- Pipeline IA Claude Haiku : classification + suggestion réponse + escalade humaine si confidence < 90%
- **KB 20 articles essentiels** Sprint 13-14 + 30 articles bonus 4 semaines suivantes (calibrés sur tickets bêta réels)
- **Status page custom Supabase + Resend** (pas Better Stack) : banner in-app temps réel + email automatique + page `/status` historique
- **Coût** : 0€ infrastructure

---

## 17. Bêta privée en 2 phases (M6-M9)

**40-50 bêta-testeurs** sélectionnés via outreach LinkedIn + ADEME.

### Phase A — M6 à M7 (1 mois) : GRATUITE

- Tests fonctionnels intensifs
- Identification bugs critiques
- 1 visio mensuelle obligatoire avec Benjamin
- Charte bêta-testeurs signée à l'entrée

### Phase B — M7 à M9 (2 mois) : tier Découverte 29€/mo

- Validation économique willingness-to-pay
- Filtre sérieux vs opportunistes
- Premiers revenus cash-flow positif dès M7

### À M9+ (lancement public)

- Founders passent au **tarif Founder à vie** : Standard 49€/mo (70 missions, surplus 1€)
- Cabinet Phase 2 Founder : 169€/mo
- Nouveaux clients : tarif public (Découverte 29€ / Standard 59€ / Volume 99€)

### Charte bêta-testeurs

| KOVAS s'engage à | Bêta-testeur s'engage à |
|---|---|
| Accès complet gratuit M6-M7 + tier Découverte M7-M9 | Min 10 missions réelles pendant la période |
| Tarif Founder Standard 49€/mo à vie M9+ | Remontée bugs et frictions (1-2 retours/semaine) |
| Cabinet Founder Phase 2 169€/mo à vie | 1 visio feedback mensuelle (30 min) |
| Badge Founder + accès anticipé Phase 2 | Accord écrit pour citation témoignage si satisfait |
| Influence directe roadmap | Pas de partage d'accès sans validation |

---

## 18. Advisor diagnostiqueur (lacune comblée)

### Profil cible

- **10+ ans d'expérience** diagnostic immobilier
- Cabinet personnel ou senior dans grand cabinet
- **Maîtrise Liciel** + connaît pain points en profondeur
- Influence métier (LinkedIn 500+ connexions, formateur, etc.)
- Âge 35-50 ans (early adopter tech mais expérimenté)

### Termes

- **0,5 à 1% BSPCE ou phantom equity** sur 2 ans
- **Vesting 2 ans, cliff 6 mois**
- 1 visio mensuelle obligatoire (1h)
- Review features critiques Phase 2 ADEME
- Validation décisions réglementaires
- Citation publique "Senior Advisor KOVAS" sur kovas.fr + LinkedIn
- Accès gratuit à vie

### Recrutement

Pendant les **50 entretiens découverte M0-M5**. Poser la question directement à 3-5 candidats au mois **M3-M4**.

---

## 19. Comptes services (révisé 18/05)

### M0 (impératifs)

Anthropic Console / OpenAI Platform / Stripe / Supabase (Free → Pro M2 → PITR M5) / GitHub / Resend / Vercel / Expo EAS / Railway / **Cloudflare** / **Google Workspace Business Starter** / **D-U-N-S Dun & Bradstreet** (5-15j délai)

### M1

Apple Developer Program / **Google Play Developer** ($25 lifetime, créer tôt) / **INPI dépôt marque KOVAS** / LinkedIn Premium Business

### M2-M3

Sentry / PostHog / Brevo SMS / INSEE Sirene API / Géorisques API

### M5 (avant bêta)

Hiscox RC Pro + Cyber + **extension PI**

### Différés / conditionnels

- **Yousign** : M9+ (Phase 2 Cabinet tier seulement + option ponctuelle 2€/sig)
- **Iopole PDP Factur-X** : M24+ (obligation TPE 09/2027-2028, dates à vérifier)
- **Hetzner Windows VM** : conditionnel (tester Linux Jackcess d'abord)

### Rejetés (économie ~1750€/an)

- OVHcloud Object Storage (Supabase backup suffit)
- Cookiebot (banner custom 4h dev)
- Preventimmo (Géorisques API gratuit)
- Sales Navigator (LinkedIn Premium Business suffit M0-M6)
- Better Stack (status page custom)
- Captain Contrat (IA-first via Claude Max)
- Crisp/Plain ticketing (custom Supabase + Resend)

### Budget mensuel projeté

| Phase | Budget |
|---|---|
| M0-M3 | ~120€/mo |
| M3-M6 | ~300-350€/mo |
| M6-M9 | ~500€/mo |
| M9-M12 | ~900-1 100€/mo |

---

## 20. Différenciateurs Phase 1 (révisés Modification 18)

> Avec Vision IA reportée V2, croquis 2D reporté V2, audit/DTG/marketplace MAR-RGE supprimés, les différenciateurs Phase 1 deviennent **3 piliers cohérents** :

1. **Saisie vocale terrain hybride FR** (Whisper + parser custom JS 80% + Claude Haiku 20% → 0,01€/mission, marge brute 80%)
2. **Exports multi-format universels** (PDF + Word + CSV + JSON + ZIP Liciel — indépendance totale vs tout éditeur, **Plan B sans Liciel**)
3. **Simplicité d'usage et de migration** : bouton "Partager vers Liciel" 3 modes (Email + GDrive auto-sync + DL direct), UX cible **30s-1min vs 1h30-2h** re-saisie + templates pièces + check-lists + validation cohérence

**Différenciateurs Phase 2** (M10-M18) ajoutent :
4. Calcul DPE certifié ADEME 3CL-2021 (remplace Liciel pour le calcul)
5. Vision IA reconnaissance équipement (chaudières, étiquettes énergétiques)
6. Recommandations post-DPE F/G générées automatiquement
7. Croquis 2D Apple Pencil (utile amiante avancé)
8. Modules amiante/plomb/gaz/élec/termites étendus

**Différenciateurs Phase 3** (M19+) ajoutent :
9. Assistant IA conversationnel métier (réglementation FR diagnostic)
10. Productivité avancée diagnostics standards (analytics cabinet, reporting)

❌ Audit énergétique, DTG, marketplace MAR/RGE = **DÉFINITIVEMENT supprimés** du périmètre KOVAS.

---

## 21bis. Gain Tracker — Système de mesure et récompense (V1.5, sprints 15-17 post-launch)

> **Document détaillé** : [`docs/gain-tracker-system.md`](docs/gain-tracker-system.md)
> **Avatar client référent** : [`docs/avatar-client.md`](docs/avatar-client.md) — **TON SOBRE PROFESSIONNEL OBLIGATOIRE, JAMAIS gaming/lifestyle**

### Objectifs business (mesurés post-déploiement V1.5)

| KPI | Baseline | Cible M6 | Cible M12 |
|---|---|---|---|
| Churn mensuel | 6% | < 5% | **< 4%** |
| NPS | 35 | > 40 | **> 55** |
| Coefficient viral K | 1,2 | 1,3 | **1,5** |
| LTV | 1 800€ | +25% | **+50% (2 700€)** |

### 7 éléments constitutifs

1. **Compteur permanent dashboard** — Top-right, temps réel, "23h 47min économisées ce mois", animation 300ms (PAS confettis)
2. **Page "Mon activité"** — Stats cumulées, évolution mensuelle, répartition diagnostics, statuts pros
3. **Tracking comparatif Avant/Après** — Baseline 2 questions au signup, toast post-mission avec gain mesuré
4. **Statuts professionnels (7 niveaux)** — Utilisateur Pro / Confirmé / Sénior / Premium / Ambassadeur / Fidèle / Expert (format "diplôme professionnel" SOBRE, vocabulaire métier — JAMAIS Hero/Légende/Pionnier)
5. **Rapport mensuel email** — 1er du mois 8h CET, format "rapport business" sobre, 1 page max, signature humaine Benjamin
6. **Image LinkedIn 1080×1080** — Sobre, business, texte pré-rédigé pro, hashtags métier — **LinkedIn ONLY** (pas Instagram/TikTok/Twitter)
7. **Statistiques anonymisées comparatives** — Tranches (top 10/25/50%, "proche moyenne"), JAMAIS classement nominatif, opt-out possible

### Notifications strictes

**MAX 1 push/jour** + événementielles occasionnelles (statut débloqué 3-4x/an, anniversaire 1x/an, rapport mensuel 12x/an).

### Ton et vocabulaire

| ✅ FAVORISER | ❌ ÉVITER |
|---|---|
| "Professionnel", "Sénior", "Confirmé" | "Hero", "Légende", "Pionnier" |
| "Rapport mensuel d'activité" | "Wrapped", "Stories" |
| "Tableau de bord" | "Dashboard fun" |
| "Vous" (vouvoiement par défaut) | "Toi" (sauf opt-in user) |
| Émojis `✓` et `→` uniquement | 🚀🎯⭐🏆🎉🎊 |
| Chiffres précis ("23h 47min") | Phrases vagues ("plein de temps économisé") |

### Effort dev : 8 jours (sprints 15-17 post-launch)

| Sprint | Jours | Livrable |
|---|---|---|
| Sprint 15 (semaine 3 post-launch) | J1-J3 | Tables DB + compteur permanent + page "Mon activité" |
| Sprint 16 (semaine 4) | J4-J6 | Statuts pros (7 niveaux) + rapport mensuel email + image LinkedIn |
| Sprint 17 (semaine 5) | J7-J8 | Statistiques anonymisées + notifications push + polish |

---

## 21. Vision Phase 4 — RECENTRÉE (M30+, post-Modification 18)

**Plus de "Field Compliance OS" élargi.** Les 5 verticales précédentes (audit RGE, EDL, contrôle technique, expertise assurance, conformité ERP) sont **abandonnées** au profit d'un focus stratégique recentré.

À DÉCIDER au M30 selon traction réelle :

### Option A — Expansion géographique

| Pays | Marché diagnostiqueurs | Réglementation |
|---|---|---|
| Belgique | ~5 000 | Équivalents DPE/amiante FR |
| Luxembourg | ~500 | Cadre proche FR |
| Suisse romande | ~10 000 (multi-canton) | Plus complexe (cantonale) |
| **Total** | **~15 000 diagnostiqueurs additionnels** | |

### Option B — Productivité avancée diagnostics standards

Si marché FR saturé (50%+ de part KOVAS) :

- IA conversationnelle métier 24/7
- Reporting et analytics avancés cabinet (KPI fines, benchmarks)
- Marketplace **sous-traitance entre diagnostiqueurs** (pas MAR/RGE qui est définitivement annulée)

**Décision M30** selon métriques traction + parts de marché atteintes.

---

## 22. Quick reference — où trouver quoi

| Sujet | Document de référence |
|---|---|
| Décisions produit/business | `.claude/orchestration-kovas-app/DISCOVERY.md` (authority) |
| Stratégie défensive Liciel | `.claude/orchestration-kovas-app/kovas-defense-strategy.md` |
| Recherches techniques | `.claude/orchestration-kovas-app/research/{liciel-format,mobile-stack,supabase-architecture,anthropic-claude,whisper-transcription,stripe-facturx-signature}.md` |
| Planning sprint 14j | `.claude/orchestration-kovas-app/planning-14-jours.md` |
| Pricing détaillé + mécaniques anti-friction | `.claude/orchestration-kovas-app/pricing-strategy.md` |
| Économie détaillée | `.claude/orchestration-kovas-app/economics.md` |
| Go-to-Market plan | `.claude/orchestration-kovas-app/gtm.md` |
| Roadmap features V1/V2/V3/Phase 2-4 | `.claude/orchestration-kovas-app/features-roadmap.md` |
| Recrutement advisor + équipe | `.claude/orchestration-kovas-app/team.md` |
| PRD complet (Phase 1) | `.claude/orchestration-kovas-app/PRD.md` |
| Observabilité prod | Sentry (errors) + PostHog (analytics+replay) + Better Stack (uptime) + /api/health — cf. `docs/MONITORING-SETUP.md` |
| Sécurité DB & Supabase Advisor fixes | `supabase/migrations/20260522200000_supabase_advisor_fixes.sql` (RLS partitions + view security_invoker + search_path pin + FK indexes auto + REVOKE EXECUTE public/anon) — items manuels console : `docs/SUPABASE-MANUAL-FIXES.md` (Leaked Password Protection + extensions move) |
| Modèle économique IA (refonte 2026-05) | [`docs/refonte-2026-05/AI_ECONOMICS.md`](docs/refonte-2026-05/AI_ECONOMICS.md) — coûts Claude/Whisper par profil, marge brute cible 77→85%, alertes coût, plan d'autonomisation 36 mois |
| Setup Upstash rate-limit API publique | [`docs/refonte-2026-05/UPSTASH-SETUP.md`](docs/refonte-2026-05/UPSTASH-SETUP.md) — provisioning Redis EU, vars `UPSTASH_REDIS_REST_*`, fallback in-memory, FAQ symlink `apps/web/.env.local → ../../.env.local` |
| Checklist migration prod (refonte 2026-05) | [`docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md`](docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md) — séquence Supabase + Vercel + Stripe, rollback, smoke tests post-bascule |
| CGV v1.4 (Annuaire + Logiciel + essai 30j CB) | [`docs/legal/03-cgv.md`](docs/legal/03-cgv.md) — 4 tiers Phase 1, débit auto J+30, Customer Portal Stripe, dual track Annuaire/Logiciel, clauses API publique Upstash |
| Variables d'environnement (source unique) | [`.env.example`](.env.example) à la racine du monorepo (PAS `apps/web/.env.example`). Next.js consomme via symlink `apps/web/.env.local → ../../.env.local`. Cf. FAQ UPSTASH-SETUP.md §9 |

### Sécurité (audit 360° 2026-05-27)

| Sujet | Document / Code de référence |
|---|---|
| Audit sécurité 360° + 11 actions Benjamin | [`docs/security/SECURITY-AUDIT-2026-05-27.md`](docs/security/SECURITY-AUDIT-2026-05-27.md) — rapport complet anti-piratage + anti-fuite, hardening transverse |
| Procédure incident response RGPD | [`docs/INCIDENT-RESPONSE.md`](docs/INCIDENT-RESPONSE.md) — détection / containment / investigation / notification CNIL (72h) / eradication / post-mortem / contacts urgence |
| Wrapper console avec scrub PII auto en prod | [`apps/web/src/lib/security/safe-logger.ts`](apps/web/src/lib/security/safe-logger.ts) — remplacer `console.*` par `safeLogger.*` (scrub emails, tokens, SIRET, IBAN, phone en NODE_ENV=production) |
| Helper Sentry beforeSend scrub PII | [`apps/web/src/lib/security/scrub-pii.ts`](apps/web/src/lib/security/scrub-pii.ts) — câblé dans Sentry init pour purger payloads d'erreur |
| Banner consent cookies CNIL-compliant | [`apps/web/src/lib/cookies/`](apps/web/src/lib/cookies/) (`consent-storage.ts` + `use-cookie-consent.ts`) — stockage 13 mois, opt-in granulaire, retrait 1 clic |
| Composants banner cookies | [`apps/web/src/components/cookies/`](apps/web/src/components/cookies/) — banner + provider + bouton "Gérer mes cookies" footer |
| Endpoint CSP report violations | [`apps/web/src/app/api/security/csp-report/route.ts`](apps/web/src/app/api/security/csp-report/route.ts) — collecte rapports CSP du navigateur pour détection injections |

### IA Autonome (15 systèmes + 6 algos self-learning)

| Sujet | Document / Code de référence |
|---|---|
| Vision SaaS auto-piloté 95% | [`docs/strategy/AI_AUTONOMY_V1.md`](docs/strategy/AI_AUTONOMY_V1.md) — 15 systèmes autonomes + 6 algos self-learning + roadmap activation par phase |
| Mapping état réel par système | [`docs/strategy/AI_AUTONOMY_STATUS.md`](docs/strategy/AI_AUTONOMY_STATUS.md) — 10/15 systèmes complets, 3 différés stratégiquement (paid ads M9+, chat IA M19+, args optimizer M12+) |
| Algo 22 — Upsell timing prediction | [`apps/web/src/lib/algos/upsell-timing.ts`](apps/web/src/lib/algos/upsell-timing.ts) — prédit fenêtre optimale d'offre upsell selon comportement user |
| Algo 23 — LTV forecasting | [`apps/web/src/lib/algos/ltv-forecasting.ts`](apps/web/src/lib/algos/ltv-forecasting.ts) — projection LTV par cohorte avec churn factoring |
| Algo 24 — Personalization engine | [`apps/web/src/lib/algos/personalization-engine.ts`](apps/web/src/lib/algos/personalization-engine.ts) — adaptation UI/copy selon profil + comportement |
| Système 2 — Email subject auto-optimization | [`apps/web/src/lib/email-bandit/`](apps/web/src/lib/email-bandit/) — templates + scorer + selector + prompts Thompson Sampling sur subject lines |
| Système 5 — Upsell engine contextuel | [`apps/web/src/lib/upsell-engine/`](apps/web/src/lib/upsell-engine/) — triggers + scorer + offer-selector (basé sur Algo 22) |
| Système 8 — Lead scoring visiteurs site | [`apps/web/src/lib/visitor-scoring/`](apps/web/src/lib/visitor-scoring/) — behavior + score + classifier sur visiteurs anonymes (extension Algo A1.3.5 B2C) |
| Système 9 — Sentiment monitoring | [`apps/web/src/lib/sentiment/`](apps/web/src/lib/sentiment/) — analyzer + prompts + trends sur tickets support + reviews via Claude Haiku |
| Système 10 — Feature usage learner | [`apps/web/src/lib/feature-usage/`](apps/web/src/lib/feature-usage/) — catalog + analyzer + retention-uplift + promotion-engine (PostHog → hebdo) |
| Système 11 — Customer success retention | [`apps/web/src/lib/customer-success/`](apps/web/src/lib/customer-success/) — health score + actions + templates emails auto (PAS chat IA, différé Phase 3 M19+) |
| Système 14 — Competitive intelligence | [`apps/web/src/lib/competitive/`](apps/web/src/lib/competitive/) — extractor + diff + analyze (scraping daily Liciel/ORIS/OBBC + Claude Sonnet analyse) |
