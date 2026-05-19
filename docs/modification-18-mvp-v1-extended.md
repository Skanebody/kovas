# KOVAS — Modification 18 : MVP V1 étendu + Focus 8 diagnostics standards

**Date** : 2026-05-18
**Statut** : Authority document — surclasse toutes les sections en conflit
**Trigger** : Refonte stratégique post-D-U-N-S + PWA pivot, consolidation 15 modifications structurelles

---

## 1. Récap des 15 modifications

| # | Modification | Status |
|---|---|---|
| 1 | Pivot PWA-only Phase 1 (vs RN+Expo) | ✅ Déjà fait (Modification 17 du 18/05) |
| 2 | **MVP V1 simplifié + 10 features cœur** (vs 6) | 🆕 Ajout |
| 3 | Focus 8 diagnostics standards (vs audit/DTG) | 🆕 Recentrage |
| 4 | Stratégie export 3 modes (Email + GDrive + DL direct) | 🆕 Formalisé |
| 5 | Approche IA hybride (parser custom 80% + Claude Haiku 20%) | 🆕 Optimisation |
| 6 | Pricing 3 tiers Phase 1 confirmé | ✅ Cohérent |
| 7 | UX anti-friction paiement | ✅ Inchangé |
| 8 | Essai gratuit 14 jours | ✅ Inchangé |
| 9 | Bêta en 2 phases | ✅ Inchangé |
| 10 | Recrutement advisor diagnostiqueur | ✅ Inchangé |
| 11 | **Vision Phase 4 recentrée** (expansion géo OU productivité) | 🆕 Recentrage |
| 12 | Planning sprint 14j révisé | 🆕 Mise à jour |
| 13 | Comptes services révisés | ✅ Déjà fait (pivot PWA) |
| 14 | **Projections financières finales** (marge 80%) | 🆕 Ajustement |
| 15 | Stratégie autonomisation IA 36 mois | ✅ Inchangé |

---

## 2. MVP V1 = 10 features cœur (vs 6 précédent)

> **Croquis 2D RETIRÉ V1** → reporté V2 (utile pour amiante avancé, audit Phase 3 mais pas indispensable Phase 1).

### Features V1 — 10 features

| # | Feature | Effort dev | Note |
|---|---|---|---|
| 1 | **Saisie vocale terrain structurée par pièce** (Whisper + parser custom JS + Claude Haiku hybride) | 5 j | Approche hybride : parser custom 80% / Claude 20% |
| 2 | **Photos géolocalisées par pièce + annotations basiques** (Web Camera API + Geolocation + Konva) | 3 j | PWA-only, WebP compression 5MB→250KB |
| 3 | **Auto-complétion adresse + cadastre** (BAN + IGN + Géorisques ERP) | 2 j | Inchangé |
| 4 | 🆕 **Templates pièces pré-remplis** | 1 j | Templates "T2/T3/T4/T5" maison/appartement, l'utilisateur ajuste sur place |
| 5 | 🆕 **Check-lists par type de diagnostic** | 1,5 j | Validation complétude avant export, "Tu n'as pas saisi la VMC, c'est volontaire ?" |
| 6 | 🆕 **Upload documents propriétaire** (lien public) | 2 j | Page publique simple, client uploade factures énergie / plans / anciens DPE avant visite |
| 7 | 🆕 **Validation cohérence basique** (règles métier sans IA) | 1,5 j | "Surface 100m² + chaudière 5kW = peu", "Maison 1850 + étiquette A = à vérifier" |
| 8 | 🆕 **Bouton "Partager vers logiciel principal"** (3 modes : Email + GDrive + DL direct) | 3 j | Bouton principal proéminent dans UI mission terminée |
| 9 | **Export multi-format universel** (ZIP Liciel + PDF + Word + CSV + JSON) | 7 j | Inchangé |
| 10 | **Synchronisation mobile/web + mode offline complet** (Service Worker + IndexedDB Dexie + queue mutations) | 3 j | Inchangé |
| **Total** | | **29 j** | **Compressible 22-25 j intensifs** avec Cursor + Claude Code |

### Features RETIRÉES V1 (vs plan initial)

- ❌ **Croquis 2D manuel Apple Pencil** → V2 (utile pour amiante avancé, audit Phase 3)
- ❌ Vision IA équipements → V2
- ❌ Croquis IA depuis photo → V3
- ❌ Recos post-DPE F/G → V2
- ❌ Scan LiDAR iPad Pro 3D → V3+ ou jamais
- ❌ Assistant IA conversationnel → Phase 3
- ❌ **Marketplace MAR/RGE → ANNULÉ DÉFINITIVEMENT**
- ❌ **Module audit énergétique → ANNULÉ DÉFINITIVEMENT**
- ❌ **Module DTG → ANNULÉ DÉFINITIVEMENT**
- ❌ Multi-users cabinet → V2 / Phase 2
- ❌ Signature eIDAS Yousign en pack → Option ponctuelle 2€/sig uniquement
- ❌ Télémètres BLE → V2
- ❌ API publique → Phase 2
- ❌ Espace pro B2B → V2

---

## 3. Focus 8 diagnostics standards (92% du volume métier)

### Marché cible V1 — 8 types couverts (volumes annuels FR)

| Diagnostic | % activité diag typique | Volume/an FR |
|---|---|---|
| **DPE** | 40-50% | 4 M/an |
| **Amiante** | 15-20% | 1,5 M/an |
| **Plomb CREP** | 5-8% | 600 k/an |
| **Gaz** | 8-10% | 800 k/an |
| **Électricité** | 8-10% | 800 k/an |
| **Termites** | 3-5% | 400 k/an |
| **Mesurage Carrez/Boutin** | inclus DPE typique | - |
| **ERP** | déclaration simple Géorisques | - |
| **Total couverture** | **92% du volume métier** | |

### Hors périmètre — DÉFINITIVEMENT EXCLUS

| Exclu | Pourquoi |
|---|---|
| **Audit énergétique réglementaire** | Marché 3-5× plus petit, certification spécifique, moteur de simulation thermique dynamique = 6-12 mois R&D, concurrence Pleiades/ClimaWin/Comfie matures depuis 15 ans |
| **DTG (Diagnostic Technique Global)** | Marché niche ~30k/an, complexité énorme |
| **Modules expertises avancés** | handicap, infiltrométrie, tantièmes copro, etc. |

### Positionnement marketing

> "KOVAS est l'app moderne pour les 13 000 diagnostiqueurs immobiliers qui font 92% de leur activité en DPE, amiante, plomb, gaz, électricité et mesurage. Notre seule obsession : vous faire gagner 1h30 par mission. Nous ne faisons PAS l'audit énergétique, c'est un autre métier. Nous faisons VOTRE quotidien, mieux que personne."

### Plan de couverture progressive

| Période | Diagnostics couverts | % marché cumulé |
|---|---|---|
| **Sprint 14j (V1 V0)** | DPE + Amiante (moteur générique 80% code partagé) | **65%** |
| Semaine 3 post-launch | + Carrez/Boutin + ERP (2 j) | 67% |
| Semaine 4 | + Plomb CREP (2 j) | 73% |
| Semaine 5 | + Gaz (2 j) | 81% |
| Semaine 6 | + Électricité (2 j) | 89% |
| Semaine 7 | + Termites (1,5 j) | **92%** |

**À fin M2 post-launch** : KOVAS couvre **92% du volume diagnostic français**.

---

## 4. Stratégie export — 3 modes formalisés

### Principe

KOVAS V1 est un **COMPAGNON terrain**. Le calcul certifié et envoi ADEME restent chez Liciel ou logiciel équivalent. KOVAS élimine la **double saisie**.

**UX cible** :
> Au lieu de **1h30-2h** de re-saisie au bureau, le diagnostiqueur passe **30 secondes - 1 minute** pour importer le dossier KOVAS dans son logiciel principal.

### UI écran mission terminée

```
[Mission DPE — 12 rue de la République, Dieppe]

📊 Résumé :
   • 8 pièces décrites
   • 24 photos prises
   • 3 équipements identifiés
   • Durée : 1h12

📤 Partager vers Liciel (configuré dans paramètres)
[ 📤 Envoyer vers Liciel ]   ← Bouton principal proéminent

Autres options ▼
   ├── 📤 Envoyer vers AnalysImmo (V2)
   ├── 📤 Envoyer vers OBBC (V2)
   ├── 📤 Format universel (PDF + Word + CSV)
   └── 📤 Télécharger ZIP directement
```

### 3 modes d'envoi V1

| Mode | UX | Temps | Setup |
|---|---|---|---|
| **Email automatique** | ZIP envoyé en pièce jointe à email pro user → ouvre email PC → télécharge → import Liciel | 1-2 min | Aucun (default) |
| **Google Drive / Dropbox auto-sync** ⭐ RECOMMANDÉ | ZIP uploadé dans dossier cloud → sync auto PC (Drive/Dropbox installé) → import Liciel | 30s-1 min | OAuth GDrive/Dropbox (5 min once) |
| **Téléchargement direct** | ZIP disponible dans `app.kovas.fr/missions` → DL depuis PC → import Liciel | 30s-1 min | Aucun |

### Validation pré-export (popup si données manquantes)

```
"Tu n'as pas saisi la VMC. C'est volontaire ?"
[ Continuer quand même ]  [ Compléter ]
```

### Paramétrage utilisateur (paramètres compte)

```
Mon logiciel principal : [Liciel ▾]
Mode d'envoi par défaut : [Google Drive ▾]
Options : [ ] Email, [ ] Téléchargement direct
```

### Promesse marketing honnête

> "Vos données KOVAS dans Liciel en moins d'une minute."
>
> "Plus de re-saisie au bureau. Vous terminez votre mission sur l'iPad, KOVAS envoie automatiquement le dossier au format Liciel dans votre Google Drive. Vous l'importez dans Liciel d'un glisser-déposer."

PAS de "1 clic magique" (mensonger). MAIS "**1 minute au lieu de 2 heures**" (honnête et démontrable).

### V2 — KOVAS Bridge (M3-M9)

Programme léger .NET ou Electron installé sur PC Windows utilisateur :
- Surveille dossier cloud configuré
- Notifie l'utilisateur quand nouveau ZIP arrive
- Optionnellement ouvre Liciel automatiquement avec ZIP préchargé
- Réduit temps sync à **30 secondes vraiment automatiques**

Effort dev V2 : 7-13 jours.

---

## 5. Approche IA hybride (V1)

### Usages Claude V1 — restreints

| Usage | Stratégie | Coût/mission |
|---|---|---|
| **Structuration vocale** | Parser custom JS pour cas standards (80%) + Claude Haiku 4.5 pour cas complexes/atypiques (20%) | 0,01€ (vs 0,15€ tout Claude) |

### Usages NON utilisés V1

- Vision IA équipements (V2)
- Recos post-DPE F/G (V2)
- Génération templates rapports (templates fixes réglementaires)
- Synthèses missions (non nécessaire)
- Assistant conversationnel (Phase 3)

### Calcul économique (utilisateur typique 75 missions/mois)

Sans optimisations (V0 lancement) :
- Whisper : 11,25€/mois
- Claude Haiku (hybride) : 4€/mois
- Stockage + Stripe : 1€/mois
- **TOTAL : 16€/mois**
- Revenu Standard 59€ + dépassements : 81,50€
- **Marge brute : 65,50€ (80%)** ← cible révisée

### Positionnement marketing

⚠️ NE PAS surenchérir sur "IA-first" en V1. KOVAS V1 est :
- Une app moderne de saisie terrain avec vocal
- Un export universel vers tous les logiciels métier
- Un mode offline robuste

L'IA est un **MOTEUR INTERNE** qui structure le vocal, **pas un argument marketing principal**.

L'argument IA viendra en **V2-V3** (Vision IA, recos auto, assistant conversationnel).

---

## 6. Planning sprint 14j révisé (vs version précédente)

| Jour | Plan révisé |
|---|---|
| J1 | Setup monorepo Next.js + Supabase + auth + design system base |
| J2 | Design system complet (Ron Design Lab × Tectra : crème + cobalt + butter, Outfit + Instrument Serif italic) |
| J3 | CRUD missions/clients/biens + auto-complétion adresse BAN/cadastre |
| J4 | Saisie terrain photos + géolocalisation (Web APIs) |
| J5 | Saisie vocale Whisper + parser custom JS |
| J6 | Intégration Claude Haiku pour cas complexes (hybride) |
| **J7** | **Checkpoint mi-parcours + démo terrain réelle** |
| J8 | **Templates pièces + check-lists DPE + Amiante** (nouveau) |
| J9 | **Upload documents propriétaire (lien public)** (nouveau) |
| J10 | **Validation cohérence + sync Realtime + mode offline complet** |
| J11 | Export ZIP Liciel + tests sur 25-30 cas réels |
| J12 | **Export PDF + Word + CSV + JSON + bouton "Partager vers Liciel" (3 modes)** |
| J13 | Stripe 3 tiers + widget transparence + tests E2E Playwright |
| J14 | Build prod Vercel PWA + onboarding 10 bêta-testeurs |

À fin du sprint : **MVP V1 PWA fonctionnel avec DPE + Amiante = 65% du marché**.

### Extensions M1-M2 post-launch (selon prévu §3)

S3 : Carrez/Boutin + ERP → 67%
S4 : Plomb CREP → 73%
S5 : Gaz → 81%
S6 : Électricité → 89%
S7 : Termites → **92%**

---

## 7. Phase 4 recentrée

**Plus de "Field Compliance OS" élargi** (audit énergétique RGE, EDL locataires, contrôle technique, expertise assurance, conformité ERP supprimés).

Focus M30+ :

### Option A — Expansion géographique

- Belgique (équivalents diagnostic FR)
- Luxembourg
- Suisse romande
- **Marché total 3 pays** : ~15k diagnostiqueurs additionnels

### Option B — Productivité avancée diagnostics standards

Si marché FR saturé (50%+ de part), pousser features premium :

- IA conversationnelle métier 24/7
- Reporting et analytics avancés cabinet
- Marketplace **sous-traitance entre diagnostiqueurs** (PAS marketplace MAR/RGE qui est retirée)

**À DÉCIDER au M30** selon traction.

---

## 8. Projections financières finales

| Horizon | Abonnés | ARPU | MRR | ARR | Marge brute (80%) | Marge nette annuelle |
|---|---|---|---|---|---|---|
| **M12** | 140 | 75€ | 10 500€ | 126 000€ | 100 800€ | **96 000€** |
| **M24** | 850 | 85€ | 72 250€ | 867 000€ | 693 600€ | **685 200€** |
| **M36** | 2 200 | 110€ | 242 000€ | 2,9 M€ | 2,32 M€ | **2,30 M€** |

**Cibles révisées finales** :
- M12 : **100k€ marge nette**
- M24 : **700k€ marge nette**
- M36 : **2,3M€ marge nette**

### Budget mensuel projeté révisé (post-PWA pivot + Modification 18)

| Période | Budget mensuel |
|---|---|
| M0-M3 | ~100€/mo |
| M3-M6 | ~280-320€/mo |
| M6-M9 | ~470€/mo |
| M9-M12 | ~850-1 050€/mo |

**Économie totale 12 mois** : ~700€ (PWA only + comptes optimisés vs plan initial).

---

## 9. Conflits résolus avec artefacts existants

| ID Discovery / Section | Conflit | Résolution |
|---|---|---|
| **CLAUDE.md §3 MVP** | 6 features dont croquis 2D | **10 features**, croquis 2D retiré → V2 |
| **CLAUDE.md §20** | 3 différenciateurs Phase 1 incluant croquis manuel | **3 différenciateurs Phase 1 révisés** : vocal hybride + exports universels (3 modes) + **simplicité d'usage et de migration** (Partager 1-clic vers Liciel) |
| **PRD §6.3 Phase 3** | Marketplace MAR/RGE + audit énergétique | **Supprimés définitivement** |
| **features-roadmap.md V2/V3** | Audit énergétique + DTG | **Supprimés définitivement** |
| **features-roadmap.md Phase 4** | Field Compliance OS 5 verticales (RGE/EDL/contrôle tech/assurance/conformité ERP) | **Recentrée** : expansion géo BE/CH/LU OU productivité avancée |
| **economics.md §1-3** | Marge brute 77% moyen | **Marge brute 80%** grâce approche IA hybride |
| **economics.md §10** | ARR M12 117k€, M24 768k€, M36 2,77M€ | **Révisé** : M12 126k€, M24 867k€, M36 2,9M€ |
| **planning-14-jours.md** | J4 photos Vision Camera RN, J5 voice expo-audio, J8 croquis Skia | **Révisé** : J4 photos Web Camera API, J5 voice MediaRecorder, **J8 templates pièces + check-lists** (croquis supprimé), **J9 upload doc propriétaire** (nouveau), J10 validation cohérence + sync + offline |
| **task files Phase 2** (à mettre à jour ultérieur) | Capture mobile RN | **À ré-sharder** post-pivot PWA |

---

## 10. Artefacts à mettre à jour

| Priorité | Artefact | Action |
|---|---|---|
| **HIGH** | `CLAUDE.md` | §3 MVP 10 features, §20 différenciateurs révisés, §2 marketplace MAR/RGE retirée, §3 audit retiré |
| **HIGH** | `task-1-3-pwa-setup.md` | Mettre à jour pour refléter 10 features (pas 6) |
| **HIGH** | `features-roadmap.md` | Retirer audit, DTG, marketplace MAR/RGE, recentrer Phase 4 |
| **MEDIUM** | `PRD.md` §6, §12, §16, §19 | Mises à jour cohérentes |
| **MEDIUM** | `economics.md` §1-11 | Marge brute 80%, projections révisées |
| **MEDIUM** | `planning-14-jours.md` | Sprint révisé (J8 templates+checklists, J9 upload doc, J10 validation+sync) |
| **MEDIUM** | `DISCOVERY.md` | Section "Modification 18" |
| **LOW** | `gtm.md`, `pricing-strategy.md`, `team.md` | Vérifier cohérence (probablement déjà alignés) |
| **LOW** | `task files Phase 0-1` | Re-shard post-pivot complet |
