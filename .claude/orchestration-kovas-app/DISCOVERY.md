# KOVAS App — Discovery Document

**Created**: 2026-05-13
**Updated**: 2026-05-18 — REFONTE STRUCTURELLE MAJEURE (15 modifications)
**Status**: v3 actif
**Méthode**: Validation par paquets thématiques (12 paquets) + refonte structurelle 18/05
**Authority**: Ce document est la **source de vérité finale** pour toutes les décisions d'implémentation, surclassé uniquement par CLAUDE.md racine.

> **⚠️ Authority order (révisé 18/05)** : [`CLAUDE.md`](../../CLAUDE.md) (racine projet) > **DISCOVERY.md** (ce fichier) > PRD > recherches.
>
> Voir la section "Refonte 18/05" en fin de document pour la liste des conflits résolus avec les paquets 1-12 initiaux.

---

## Décisions déjà résolues par les recherches Phase 2

| ID | Domaine | Décision | Source |
|---|---|---|---|
| **D301** | Supabase region | **eu-west-3 Paris** (DR mirror eu-central-1 Frankfurt via S3) | supabase-architecture.md |
| **D302** | Modèles Claude | **Haiku 4.5** (voice+chatbot), **Sonnet 4.6** (vision+sketch+reco), **Opus 4.7** réservé escape hatch via feature flag | anthropic-claude.md |
| **D303** | Whisper primary | **OpenAI `gpt-4o-mini-transcribe`** + Deepgram Nova-3 Frankfurt fallback + iOS SFSpeechRecognizer offline | whisper-transcription.md |
| **D305** | SQLite mobile | **op-sqlite + Drizzle ORM** + sync custom 2 semaines (rejeté WatermelonDB) | mobile-stack.md |
| **D402** | Auth method | **Email+Password (primary) + Magic Link (fallback)**, pas d'OAuth Apple/Google Phase 1 | supabase-architecture.md |
| **D602** | Yousign eIDAS | **Option premium +10€/mo**, AES Yousign uniquement si client le demande explicitement | stripe-facturx-signature.md |
| **D703** | PDP Factur-X | **Iopole** (pure player API-first, ~0,10€/facture) ; Pennylane fallback | stripe-facturx-signature.md |
| **D706** | S3 backup EU | **OVHcloud Object Storage Strasbourg** (~0,01€/Go/mo), backup hebdo 30j RGPD | supabase-architecture.md |

---

## Discovery batches (validation par paquets)

### Status par paquet

| Paquet | Sujet | Décisions | Statut |
|---|---|---|---|
| 1 | Métriques de succès produit | D101-D118 | ✅ Validé |
| 2 | Definition of Done features | D201-D209 | ✅ Validé |
| 3 | Technique (SMS, i18n, dark mode, formats) | D304, D306-D310 | ✅ Validé |
| 4 | Auth, onboarding & bêta | D401-D403, D505 | ✅ Validé (modèle 7j, pas 30j) |
| 5 | Go-to-Market | D501-D504 | ✅ Validé |
| 6 | Pricing & packaging | D601, D603-D605 | ✅ Validé |
| 7 | Légal & conformité | D701-D705, D707-D709 | ✅ Validé |
| 8 | Support & ops | D801-D803 | ✅ Validé |
| 9 | Risques & continuité | D901-D905 | ✅ Validé |
| 10 | Domaine métier Liciel | D1001-D1015 | ✅ Validé |
| 11 | Comptes & infra | D1101-D1105 | ✅ Validé |
| 12 | Items émergés des recherches | NEW | _Pending_ |

---

## Paquet 1 — Métriques de succès produit ✅

Toutes les métriques sont instrumentées dans PostHog dès le J0.

### Activation

**D101 — Time-to-first-value (TTFV)**
A : **< 15 minutes** entre signup et 1ère synthèse mission générée (défaut validé).

**D102 — Activation rate 7j**
A : **≥ 60%** des inscrits complètent leur première mission dans les 7 jours (défaut validé).

**D103 — Rétention conditionnelle des activés (revu par fondateur)**
A : **≥ 65%** des activés J7 font ≥ 3 missions dans les 30 jours (rétention conditionnelle, pas % absolu inscrits).

### Rétention

**D104 — Churn mensuel cible glissante (revu par fondateur)**
A : **< 7% M1-6, < 5% M7-12, < 3% M13+** (cible glissante reflétant la maturation produit + cohorte stabilisée).

**D105 — Churn 90j post-activation**
A : **< 10%** (défaut validé — période critique post-déclic).

**D106 — Rétention cohorte M6**
A : **> 75%** des cohortes mois N actives au mois N+6 (défaut validé — métier captif joue en notre faveur).

### Engagement

**D107 — DAU/MAU ratio (revu par fondateur)**
A : **> 35%** (réaliste pour outil task-based, pas conversationnel — pas un Slack, pas un Notion).

**D108 — Missions / utilisateur actif / mois**
A : **≥ 15** (défaut validé — ~3-4/semaine, cohérent persona Maxime).

**D109 — Sessions / jour**
A : **≥ 3** (défaut validé — matin planning, terrain, soir admin).

### Satisfaction

**D110 — NPS**
A : **≥ 50 à M6, ≥ 60 à M12** (défaut validé).

**D111 — CSAT chat support IA**
A : **≥ 4,5/5** sur conversations chat IA (défaut validé).

**D112 — Taux d'escalation IA → humain**
A : **< 15%** (Claude résout 85%+ tickets, défaut validé).

### Business

**D113 — CAC segmenté par canal (revu par fondateur)**
A :
- LinkedIn outreach : **< 150€**
- SEO/content : **< 100€**
- Ads (Google/Meta) : **< 400€**
- **CAC blended cible : < 250€ à M12**

**D114 — LTV cible**
A : **> 2 500€** (LTV/CAC ratio > 10, défaut validé).

### Performance technique

**D115 — Latence vocal**
A : **p95 < 5s** end-to-end (défaut validé, confirmé atteignable par recherche Whisper).

**D116 — Latence Vision**
A : **p95 < 4s** par photo (défaut validé, confirmé atteignable par recherche Claude).

**D117 — Crash-free rate mobile**
A : **> 99%** (défaut validé — standard production iOS).

### KPI produit ajouté par fondateur

**D118 — Taux de complétion mission (KPI #1 produit)**
A : **> 92%** — pourcentage de missions démarrées qui aboutissent à un export ZIP Liciel ou rapport remis au client. KPI le plus critique du produit : si < 92%, ça signifie que les utilisateurs rencontrent des blocages techniques/UX qui les forcent à abandonner et retourner à Liciel.

---

## Paquet 2 — Definition of Done features ✅

### F1 — Saisie vocale terrain FR (Whisper + Claude)

**D201 — Précision Whisper sur jargon métier (segmenté par fondateur)**
A :
- **Whisper brut ≥ 88%** sur 200 clips test métier (mesure isolée du provider).
- **Pipeline complet (Whisper + Claude post-processing) ≥ 93%** sur les mêmes 200 clips.
- **Mesurer les deux séparément en CI** pour pouvoir attribuer une régression au bon composant.

**D202 — Coût API Whisper par mission**
A : **< 0,03€/mission ceiling, viser < 0,02€** (recherche Whisper indique ~0,014€/mission atteignable, 10× sous PRD §12.5).

### F2 — Reconnaissance photo équipement (Claude Vision)

**D203 — Précision identification équipement (segmenté par fondateur)**
A : segmentation par type d'équipement et époque :
- **Étiquettes énergétiques ≥ 95%** (texte standardisé, OCR facile)
- **Plaques chaudières post-2015 ≥ 88%** (normalisation des étiquettes constructeur récente)
- **Plaques pré-2015 ≥ 70%** avec mode "à confirmer" obligatoire (étiquettes effacées, marques disparues)
- **Autres équipements (PAC, VMC, radiateurs, ventilation) ≥ 80%**
- **Global pondéré ≥ 85%** sur dataset de validation
- Mode "non reconnu" automatique si confidence < 0,7

**D204 — Dataset validation Vision**
A : **200 photos terrain réelles couvrant ≥ 30 marques** (Saunier Duval, De Dietrich, Atlantic, Frisquet, Vaillant, Viessmann, Chaffoteaux, ELM Leblanc, Bosch, Buderus, Chappée, Domusa, Ferroli, Riello, Sime, Unical, Wolf, Beretta, Junkers, Ariston, Geminox, Idéal Standard, Oertli, Cuenod, Weishaupt, Hitachi, Daikin, Mitsubishi PAC, LG PAC, Panasonic PAC). Dataset construit en M3-M4 avec cohorte bêta.

### F3 — Croquis automatique depuis photo

**D205 — Latence photo panoramique → plan 2D dimensionné**
A : **< 10s photo-based** (Phase 1 P0, via Claude Vision + Skia), **LiDAR RoomPlan en P1.5** (3 semaines effort, latence 30-90s mais ±2cm).

**D206 — Précision dimensions pièces standards 10-30m²**
A : **± 10cm photo-based** Phase 1, **± 5cm LiDAR** Phase 1.5.

### F4 — Recommandations post-DPE F/G

**D207 — Précision chiffrage travaux (segmenté par fondateur)**
A : segmentation par type de travaux :
- **Standards (isolation, fenêtres, chaudière) ± 15%** par rapport au marché
- **Complexes (rénovation globale) ± 25%** (variance élevée naturelle)
- **Aides officielles (MaPrimeRénov', CEE) ± 10%** (barèmes officiels, peu de variance)

Sourcing systématique des barèmes officiels en cache Claude. Validation manuelle diagnostiqueur obligatoire avant remise client. Recommandations toujours formulées "estimation indicative" (jamais "officiel").

### Items connexes émergés

**D207b — Dataset validation F4**
A : **50 cas réels F/G** avec scénarios travaux validés par MAR partenaire ou diagnostiqueur senior. Construit M6-M9.

**D207c — Confidence threshold post-DPE**
A : Validation diagnostiqueur manuelle obligatoire avant envoi client. Cache Claude inclut un disclaimer auto "estimation indicative". Si Claude < 0,7 confidence sur un montant, marquer "à valider".

### Métriques de qualité Vision ajoutées par fondateur

**D208 — Taux de fausses détections Vision (false positives ≥ 0,7 confidence)**
A : **< 3%**.
**Rationale** : précision prime sur rappel en métier à responsabilité juridique. Mieux vaut afficher "non reconnu" + saisie manuelle qu'une marque/modèle inventé qui se retrouve dans un DPE officiel.

**D209 — Taux d'incohérences détectées par l'IA dans la synthèse mission**
A : **< 5%**.
**Rationale** : feature signature qui sépare KOVAS d'un simple outil de saisie — Claude doit pointer les incohérences (ex : "surface Carrez 75m² mais somme des pièces = 90m²", "DPE classe A annoncé mais chaudière fioul + simple vitrage incohérent"). Mesure : % de missions où l'IA détecte ≥ 1 incohérence qui aurait été détectée par un diagnostiqueur senior en relecture humaine.

---

## Paquet 3 — Technique (SMS, i18n, dark mode, formats régionaux) ✅

**D304 — SMS provider (revu par fondateur)**
A : **Brevo SMS** (anciennement Sendinblue).
**Rationale** : meilleur delivery rate FR (98%+), API mature, souveraineté FR conservée. Resend reste utilisé pour les emails transactionnels (pas de conflit d'écosystème, double provider OK).
Volume Phase 1 : ~6 000 SMS/mois (~360€/mo).

**D306 — Architecture i18n**
A : **Prête dès J0, FR seul actif** (défaut validé).
**Implémentation précisée par fondateur** :
- **Web** : `next-intl` (App Router compatible, typesafe)
- **Mobile** : `i18next` + `react-i18next`
- **Conventions de clés** : namespace par module métier (`mission.dpe.*`, `client.address.*`, `auth.signin.*`)
- **Formats** : `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` partout

**D307 — Dark mode**
A : **Auto système + override manuel** (défaut validé).
**Implémentation précisée par fondateur** :
- **Web** : `next-themes` (persistance cookie, hydratation safe)
- **Mobile** : `useColorScheme()` Expo + override stocké MMKV
- **PDF générés** : toujours en clair pour impression (pas de mode sombre dans les exports rapport / facture / devis)
- **Transitions** : instantanées via theme tokens NativeWind 4 + Tailwind (pas d'animation fade — UX premium feel)

### D310 — Conventions formats régionaux (ajouté par fondateur, critique)

A : conventions strictes appliquées dès J0 dans tout le code :
- **Monnaie** : stockée en **centimes integer** (jamais float, jamais string). Affichage via `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`. Exemple : `priceCents: 5900` → affichage "59,00 €".
- **Pourcentages** : stockés **0-1 float** (0,2 = 20%). Affichage via `Intl.NumberFormat('fr-FR', { style: 'percent' })`.
- **Dates** : stockées **UTC ISO 8601** en base (`timestamptz` Postgres). Affichage via `Intl.DateTimeFormat('fr-FR')`.
- **Timezone utilisateur** : `users.timezone` stockée explicitement, **default Europe/Paris** (jamais déduire de l'IP).
- **Téléphone** : stocké en **E.164** (`+33612345678`), parsing/format via `libphonenumber-js`.
- **Surface** : stockée en **m² float**, jamais "75 m²" string.
- **Adresses** : structurées dès J0 (street/city/postal_code/country), jamais en text libre.

**Rationale** : éviter le piège classique du SaaS FR qui mélange "59€" string et `5900` cents → bugs de change + impossibilité d'export EUR/CHF/MAD plus tard.

---

## Paquet 4 — Auth, Onboarding, Bêta privée ✅

### D401 — Modèle d'essai gratuit (REDÉFINI par fondateur)

A : **Essai gratuit 7 jours** (pas 30 jours — revu).

| Paramètre | Valeur |
|---|---|
| Durée | **7 jours calendaires** |
| CB requise | **Non** |
| Email pro requis | **Oui** (pas de gmail/yahoo perso — domaine pro vérifié) |
| Missions | Illimitées (plafond technique caché à **30/semaine**) |
| Photos Vision | Illimitées |
| Whisper | Illimité |
| Exports Liciel | Illimités |
| Branding PDF | **"Essai KOVAS"** en footer (différencie des payants qui ont leur logo) |
| Anti-abus | **1 essai par SIRET vérifié** |
| Compteur visible | "X missions cette semaine, Y heures économisées" |

### Séquence emails essai (J0 → J7)

| Quand | Type | Sujet |
|---|---|---|
| J+1 | Auto | Vidéo onboarding 90s |
| J+4 | **Humain (fondateur)** | "Comment ça se passe ?" — outreach personnel |
| J+6 | Auto | "Demain dernier jour, voici votre offre" |
| J+7 | Conversion | **Solo 59€/mois OU Pro 89€/mois** (choix à la conversion) |

**Sans conversion** : compte gelé, données conservées 90j, réactivation possible à tout moment en payant.

### Positionnement produit (clarification fondateur)

> KOVAS est un **complément** à Liciel qui élimine les frictions et fait gagner du temps. **Pas un remplaçant.** La Phase 2 sera une activation de feature chez des utilisateurs déjà fidèles, pas une migration commerciale.

**Implication** : tout le marketing/UX Phase 1 doit positionner KOVAS comme un add-on iPad qui complète Liciel, pas comme une alternative. Réduit la friction d'adoption (pas de switch coût).

### D402 — Auth method (déjà résolu Phase 2)

A : **Email + mot de passe (primary), Magic Link (fallback)**. Pas d'OAuth Apple/Google Phase 1.
2FA TOTP optionnel pour diags, obligatoire pour owners.
Biométrie (FaceID/TouchID) pour unlock app mobile via `expo-local-authentication`.

### D403 — Gamification (précisée par fondateur)

A : **Stats valorisées en monétaire/temporel** (jamais brutes), **streaks subtils sans pénalité**, **benchmark anonyme par cohorte similaire** (taille cabinet).

**Composants** :
- Dashboard d'accueil : stats hero ("Vous avez économisé **2h47** ce mois soit **189€** facturables")
- Profil : streaks ("12 missions consécutives terminées sur place")
- Section dédiée : benchmark anonyme ("Vous êtes dans le top 20% des cabinets solo")
- Récap mensuel email : positionnement top X% + insights

**Design** : Premium type **Qonto/Wise**.
**Interdits** : badges, médailles, emojis, illustrations cartoon, mascotte, "level up", points.

### D505 — Bêta privée fermée M6-M9 (précisée par fondateur)

A : **Bêta fermée 40-50 users M6-M9**, gratuite pendant les 3 mois (accès anticipé, **pas cadeau** — engagement requis).

**Avantages bêta-testeurs à vie post-conversion** :
- **Tarif Founder 49€/mois à vie** (vs 59€ standard Phase 1)
- **Tarif Founder 79€/mois à vie** (vs 89€ Phase 2)
- **Badge "Founder"** visible dans le produit
- **Accès anticipé** features avant rollout général
- **Influence directe roadmap** (call mensuel fondateur, votes sur features)

**Programme de parrainage post-bêta** :
- **1 mois offert au parrain ET au filleul** pour chaque nouvel abonné
- Pas d'autre cadeau / cashback / récompense gimmick
- Pari : acquisition par bouche-à-oreille via produit qui résout une vraie douleur dans un marché sans concurrent direct

### ⚠️ Conséquences MAJEURES de ce paquet sur le PRD

1. **Essai 30j → 7j** : refonte de la section §10.4 (sequence emails) et §10.7 (conversion auto J+30 → conversion J+7) du PRD.
2. **Introduction d'un tier "Pro 89€/mo dès Phase 1"** : refonte de la section §12.1 (Phase 1 = 59€ unique → Phase 1 = Solo 59€ + Pro 89€ avec différenciation à définir paquet Pricing).
3. **Email pro obligatoire** : doit être validé contre liste de domaines bloqués (gmail.com, yahoo.fr, outlook.com perso, etc.) au signup.
4. **Anti-abus 1 essai/SIRET** : ajouter validation SIRET via API INSEE Sirene au signup.
5. **Tier Founder 49€/79€ à vie** : crée une cohorte spéciale dans le pricing à modéliser pour LTV.

---

## Paquet 5 — Go-to-Market ✅

### D501 — Conversion essai 7j → payant (cible glissante)

A : **cible glissante alignée maturité produit + qualité audience** :
- **M0-6 : 15-20%** (early adopters préqualifiés via outreach LinkedIn ciblé)
- **M6-12 : 10-15%** (phase d'élargissement audience moins préchauffée)
- **M12+ : 12-15%** (remontée par maturité produit + social proof + parrainage)

**Pilotage par phase** :
- M0-6 : focus qualité prospect via outreach précis (annuaire ADEME)
- M6-12 : focus volume via SEO + contenu
- M12+ : focus social proof + programme parrainage

**Alertes PostHog** : déclenchement si conversion descend sous **12% (M0-6), 8% (M6-12), 10% (M12+) pendant 2 mois consécutifs** → review acquisition + onboarding.

### D502 — Stack outreach M1-M6 (REDÉFINI par fondateur — pas Sales Navigator)

A : **stack alternatif ~60€/mo vs 99€/mo Sales Nav Core** :

| Composant | Coût/mo | Rôle |
|---|---|---|
| **Annuaire ADEME ministère scrapé via Playwright** | 0€ | **Source primaire** : 13 000 diagnostiqueurs certifiés avec coordonnées + SIRET (données publiques officielles) |
| LinkedIn Premium Business | 50€ | Enrichissement profils + 30 InMails + stats |
| **Agent Playwright custom + Claude API** | 10€ (Railway) | Personnalisation + envoi automatisé |
| **Supabase pour CRM custom** | inclus dans abo Supabase | Tracking leads, status, réponses |
| **Total** | **~60€/mo** | vs 99€/mo Sales Nav |

**Économie M1-M6** : 240€ + ciblage plus précis (données ADEME officielles vs LinkedIn auto-déclarées).

**Bascule vers Sales Navigator Core 99€/mois uniquement à M6+** si :
- Volume passe à 400+ messages/semaine, OU
- Besoin Smart Links tracking, OU
- 200+ abonnés payants validés

**Sécurité compte LinkedIn** :
- Chauffe préalable (500+ connexions naturelles)
- Max **80-100 messages/jour**
- Délais randomisés (3-15 min entre actions)
- Activité humaine en parallèle (likes, commentaires sur posts diag)

### D503 — Programme de parrainage (déjà résolu au paquet 4)

A : **1 mois offert au parrain ET au filleul** pour chaque nouvel abonné. Pas d'autre cadeau / cashback / récompense gimmick.

### D504 — Programme ambassadeurs

A : **Pas de programme ambassadeur formalisé**.

**Rationale** : cohérent avec positioning fondateur "bouche-à-oreille via produit qui résout une vraie douleur dans un marché sans concurrent direct". Le tier Founder à vie (49€/79€) + le programme de parrainage suffisent comme leviers d'avocacy.

---

## Paquet 6 — Pricing & packaging ✅ ⚠️ RÉVISÉ MAJEUR par analyse mercenaire fondateur

> **Révision majeure post-paquet 6 initial** : analyse marché vérifiée (prix Liciel/ORIS/Immo-Diag/AnalysImmo 80-250€/mo, CA diagnostiqueur 65-120k€/an, budget logiciel 2-3% du CA = 200-300€/mo acceptable). Conclusion : le pricing initial 59€/89€ était sous-évalué. Réalignement sur la valeur réelle créée.

### D603 (RÉVISÉ) — Structure tiers complète Phase 1 / 2 / 3

| Phase | Tier | Prix HT/mois | Annuel (10 mois payés) | Cible | Quota missions inclus |
|---|---|---|---|---|---|
| **Phase 1 — Compagnon (M1-M9, add-on à Liciel)** | Solo | **79€** | 790€ | Solopreneur Maxime | 50 missions/mo + 1€/mission supp |
| Phase 1 — Compagnon | Pro | **129€** | 1 290€ | Petit cabinet 2-3 users | 200 missions/mo + 1€/mission supp |
| **Phase 2 — Complet (M10-M18, remplace Liciel)** | Solo | **149€** | 1 490€ | Solopreneur installé | 100 missions/mo + 1€/mission supp |
| Phase 2 — Complet | Pro | **199€** | 1 990€ | Cabinet 2-3 users | 300 missions/mo + 1€/mission supp |
| **Phase 3 — Augmenté (M19+)** | Solo | **199€** | 1 990€ | Solopreneur premium | Illimité |
| Phase 3 — Augmenté | Pro | **299€** | 2 990€ | Cabinet 2-3 users | Illimité |
| Phase 3 — Augmenté | Cabinet 4-10 users | **499€** | 4 990€ | Cabinet structuré | Illimité |
| **Tarif Founder (40-50 bêta-testeurs)** | Solo à vie | **49€** (vs 79€) | - | Cohorte bêta exclusive | Identique tier |
| Tarif Founder | Pro à vie | **79€** (vs 129€ Phase 1, 199€ Phase 2) | - | - | - |

### Rationale du pricing (analyse mercenaire)

**Phase 1 — Compagnon à 79€** :
- Le diagnostiqueur a déjà 150€ de Liciel
- Il peut absorber +70-90€ en add-on pour des fonctionnalités IA uniques
- Total = 220-240€/mois, dans la plage acceptable (2-3% de son CA mensuel 8-10k€)
- Tu apportes 5 features uniques au monde : vocal IA, vision IA, croquis IA, recos auto, mobile-first iPad
- Au-delà de 89€ : le diagnostiqueur compare frontalement à Liciel ("autant en avoir un seul logiciel") et la perception de "compagnon" se brouille
- En dessous de 79€ (49-59€) : tu dévalues tes fonctionnalités uniques

**Phase 2 — Complet à 149€ (au prix de Liciel)** :
- Si en dessous : perception "moins bon" (logique premium inversée) + laisse de l'argent sur la table
- Si au prix : le diagnostiqueur ne fait pas d'économie monétaire mais gagne tout l'IA + mobile-first + UX moderne (arbitrage iPhone vs Nokia)
- Si au-dessus : risqué sans social proof établi
- À 149€ : 75% du tarif Liciel Suite complète + Audit + LICIELWEB, justifié par features IA additionnelles

**Phase 3 — Augmenté à 199€** :
- Prix haut de fourchette Liciel (qui plafonne à 200€)
- Justifié par : assistant IA conversationnel (économise 5-10h/sem recherche réglementaire) + audit énergétique inclus (concurrents le facturent +50-80€)

### Expérience utilisateur sur 24 mois (solopreneur fidèle)

| Période | Outils utilisés | Coût mensuel | Bénéfice |
|---|---|---|---|
| M1-M9 | Liciel (~150€) + KOVAS Solo Phase 1 (**79€**) | **229€/mois** | Gain 1h30/mission |
| M10-M18 | KOVAS Solo Complet (**149€**) seul | **149€/mois** | **Économie 80€/mois + remplace Liciel** |
| M19+ | KOVAS Augmenté (**199€**) | **199€/mois** | + IA conversationnelle + audit + marketplace |

**Win-win parfait** : l'utilisateur économise 80€/mois au passage à Phase 2, ce qui motive l'upgrade naturel. Il accepte de remonter à 199€ Phase 3 parce qu'il gagne encore plus de productivité.

### Projection M36 avec pricing optimal (vs initial)

À 1 800 abonnés (60% Solo Phase 2, 25% Pro Phase 2, 10% Solo Phase 3, 5% Pro Phase 3) :

| Tier | Abonnés | Marge brute/user | Total mensuel |
|---|---|---|---|
| Solo Phase 2 (149€) | 1 080 | 95€ | 102 600€ |
| Pro Phase 2 (199€) | 450 | 135€ | 60 750€ |
| Solo Phase 3 (199€) | 180 | 130€ | 23 400€ |
| Pro Phase 3 (299€) | 90 | 195€ | 17 550€ |
| **Total marge brute** | 1 800 | | **204 300€/mois** |
| Coûts fixes | | | -1 500€ |
| **Marge nette** | | | **202 800€/mois** |
| **ARR annualisé** | | | **~2,43 M€/an** |

**Vs projection initiale 750-900k€/an avec pricing 59€/89€ → doublement de l'ARR M36 en alignant le pricing sur la valeur réelle créée.**

### Risque à surveiller + mitigations

À 79€ Phase 1, le diagnostiqueur paie 229€/mois (Liciel + KOVAS) au lieu de 150€ avant. C'est **+53% sur son budget logiciel mensuel**.

**3 mitigations possibles** :

1. **Customer Discovery valide le prix** : dans les 50 entretiens diagnostiqueurs, poser directement : *"Si KOVAS vous faisait gagner 1h30 par mission, accepteriez-vous de payer 79€/mois EN PLUS de votre logiciel actuel ?"*
   - Si 30%+ disent oui → 79€ est le bon prix
   - Si moins → redescendre à 69€

2. **Pricing dégressif sur les 6 premiers mois** : promo de lancement 49€/mois les 3 premiers mois, puis 79€/mois. L'utilisateur s'habitue à KOVAS pendant la période promo, puis assume le plein tarif

3. **A/B test prix 79€ vs 69€ dès le lancement** : 50% des nouveaux inscrits voient 79€, 50% voient 69€. À 3 mois on compare les courbes de conversion et de churn. **Décision data-driven**

### D601 (RÉVISÉ) — Quota missions Solo

A : **Solo Phase 1 = 50 missions/mois inclus + 1€/mission supplémentaire** (revu de 60 à 50 dans l'analyse mercenaire).

**Justification chiffrée (révisée)** :
- Solopreneur démarrant : 40 missions/mois → dans le forfait, aucune friction
- Solopreneur installé typique : 65-85 missions/mois → dépassement 15-35€/mo
- Power user : 130 missions/mois → dépassement 80€/mo, signal naturel vers upgrade Pro
- **Marge brute** :
  - Démarrant (40 missions) : 79€ - 22€ coûts variables = **57€ (72%)**
  - Typique (75 missions, 25 supp) : 79+25 = 104€ - 37€ = **67€ (64%)**
  - Power (130 missions, 80 supp) : 79+80 = 159€ - 65€ = **94€ (59%)**
- **Marge brute moyenne Solo Phase 1 : ~65€/user/mois**

**Positionnement** : "Utilise KOVAS sur TOUTES tes missions" (cohérent avec promesse compagnon Liciel).

### D606 — Annualisation : 2 mois offerts (10 mois payés)

A : tous tiers en annuel = **10 mois payés au lieu de 12** (économie 17% pour utilisateur). Réduction churn + cash-flow upfront.

### D607 — A/B test prix Phase 1 au lancement

A : **Split 50/50 sur 79€ vs 69€** dès le lancement public M9.
- Variable PostHog feature flag
- Cohorte assigné au signup, stable jusqu'à conversion
- Décision finale après 3 mois de données (~M12)
- Métriques comparées : taux conversion essai→payant, churn 30j, churn 90j

### D603 (DÉPRÉCIÉ) — voir version RÉVISÉE ci-dessus

⚠️ Version initiale 59€/89€ remplacée par la version mercenaire 79€/129€/149€/199€/299€/499€. Cf. section D603 (RÉVISÉ) en début de paquet 6.

### D604 — Différentiation features Solo vs Pro

**Features OBLIGATOIRES dans Solo** (ne pas dégrader la promesse cœur — sinon Solo n'a plus de sens) :
- ✅ Saisie vocale Whisper FR
- ✅ Reconnaissance photo Claude Vision (équipement, étiquette énergétique)
- ✅ Croquis 2D Apple Pencil + Skia
- ✅ Recommandations post-DPE F/G (3 scénarios chiffrés + aides)
- ✅ Export ZIP Liciel
- ✅ Devis + Factur-X
- ✅ Signature DocuSeal (SES)
- ✅ Sync multi-device (iPad + iPhone + Web PWA)
- ✅ Branding **logo cabinet personnalisé** sur PDF rapports/devis/factures (footer KOVAS UNIQUEMENT pendant essai 7j)
- ✅ SLA support 4h ouvrées (identique Pro pendant les 12 premiers mois)

**Features Pro uniquement** :
- 🔒 **Multi-utilisateurs cabinet** (jusqu'à 3 users)
- 🔒 **Signature eIDAS Yousign AES** (incluse dans Pro vs option +10€ pour Solo)
- 🔒 **Scan LiDAR 3D iPad Pro** (Phase 1.5 puis Phase 2)
- 🔒 **Dashboard analytics avancés** (par diagnostiqueur, par client, par zone géographique)
- 🔒 **Templates rapports multiples** (Solo = 1 template ; Pro = templates illimités)
- 🔒 **API publique** (Phase 2)

### D605 — Architecture data multi-tenant (validé par fondateur)

A : modèle **1 compte = 1 cabinet = 1 ou N utilisateurs** (type Notion/Linear/Pennylane).

**Pour le solopreneur** : UX transparente.
- Création automatique d'un "cabinet par défaut" à son nom à l'inscription
- Il ne voit que son compte personnel (jamais "cabinet" dans l'UI)
- Sous le capot : 1 organization + 1 membership owner

**Pour le cabinet** : UX explicite.
- Invitation collaborateurs par email
- Rôles définis : **owner / member / viewer** (cohérent avec packet Supabase research)
- Partage missions (toutes les missions du cabinet visibles selon rôle)
- Facturation unique au cabinet (1 facture mensuelle)
- Dashboard consolidé

**Justification métier** :
- Liciel/legacy = 1 licence par user (héritage Windows desktop)
- KOVAS = SaaS moderne, partage de données obligatoire pour collaboration cabinet, supervision, pilotage commercial centralisé, facturation unique

**Légal** : cohérent avec la réalité métier.
- Chaque mission a `cabinet_id` (entité commerciale) ET `assigned_user_id` (diagnostiqueur certifié COFRAC signataire)
- Le rapport reste signé par la personne physique certifiée
- Schéma Supabase est déjà aligné (cf. recherche supabase-architecture.md, multi-tenant from day 1)

### D602 — Yousign eIDAS (déjà résolu Phase 2 + précisé ici)

A :
- **Solo** : option **+10€/mo** activable depuis Settings pour AES eIDAS qualifiée Yousign
- **Pro** : **Yousign AES inclus** dans le tier 89€ (différentiateur Pro)

---

## Paquet 7 — Légal & conformité ✅

### D701 — Stratégie légale en 3 vagues (revue par fondateur)

A : approche **IA-first puis avocat ciblé**, budget optimisé pré-launch.

#### Vague 1 (M0-M9) — 100% IA via Claude Max + dépôt INPI DIY
**Budget : 300€ (frais INPI uniquement)**

Documents juridiques générés via Claude (revue humaine fondateur) :
- CGU B2B SaaS
- CGV avec abonnement récurrent
- Politique de confidentialité RGPD 2026
- Politique de cookies + consent banner
- Mentions légales
- DPA (Data Processing Agreement) pour clients pro
- Charte bêta-testeurs

**Dépôt marque KOVAS à l'INPI en DIY** via interface en ligne. Recherche antériorité préliminaire via Claude sur TMview, data.inpi.fr, WIPO. Classes 9 (logiciels) et 42 (SaaS).

#### Vague 2 (M9-M18) — Audit avocat IP/Tech ciblé
**Budget : 1 000-1 500€**, déclenché quand MRR atteint 5k€.

Cabinet boutique **Lefèvre Avocats** ou **Lex2B** sur **2 sujets uniquement** :
1. **Mémorandum opposable reverse-engineering format Liciel** (article L122-6-1 CPI sur interopérabilité)
2. **CGU spécifiques métier diagnostic immobilier** (responsabilité IA, propriété données utilisateur, conformité ADEME)

Pas de cabinet complet — audit ciblé sur les sujets à risque uniquement.

#### Vague 3 (M18+) — Conseil stratégique au cas par cas
**Budget : 300-500€/heure**, à la demande.

Validation ADEME 3CL-2021, partenariats MAR/RGE, préparation levée ou exit.

#### Budget cumulé 24 mois : 2 800-4 800€ étalés selon revenu généré

**Justification** : L'IA couvre 95% des besoins juridiques standards SaaS B2B. Les 5% restants demandent un humain mais peuvent attendre l'arrivée de revenus. Compatible avec contrainte PRD "moins de 500€ setup total".

**Cabinets retenus pour Vague 2** : Lefèvre Avocats OU Lex2B. **Pas** Captain Contrat (templates insuffisants pour Liciel/ADEME). **Pas** Bird & Bird (overkill Phase 1).

### D702 — Assurance RC pro (Hiscox direct, M5)

A : **Hiscox direct**, souscription **différée à M5** juste avant lancement bêta privée.

**Timing justifié** :
- M0-M5 : développement solo sans utilisateurs externes, aucun risque tiers
- **M5 : souscription Hiscox RC Pro Numérique + Cyber pack complet (~900€/an)**
- M6 : lancement bêta privée 40-50 users avec couverture en place
- M17 : renouvellement annuel avec augmentation potentielle selon CA

**Pack cible Hiscox** :
- RC Pro Numérique (responsabilité civile professionnelle éditeur de logiciel)
- Cyber assurance (intrusion, perte de données, ransomware)
- Protection juridique (litiges contractuels)

**Coût cumulé 24 mois** : ~2 100€
- Année 1 (M5-M17) : 900€
- Année 2 (M17-M29) : 1 200€ (hausse selon CA)

**Phase 2 (M10+ post-validation ADEME)** : upgrade vers couverture spécifique "responsabilité diagnostic immobilier certifié" (~+600-1000€/an).

**Exigences à vérifier à la souscription** :
1. Couverture dommages causés par l'IA (Claude Vision, Whisper) : Hiscox inclut "logiciels d'aide à la décision"
2. Couverture sous-traitants tech (Anthropic, OpenAI, Supabase) : clause cascade de responsabilité
3. Périmètre géographique : France + UE (prévision Phase 4 export)
4. Plafond cyber suffisant pour fuite RGPD jusqu'à **50k€ d'amende CNIL**

### D705 — Montant coverage RC

A : **500k€ par sinistre, 1M€ par année** (PRD défaut maintenu).
Évoluable selon croissance et passage Phase 2.

### D707 — Email pro obligatoire signup (anti-abus essai)

A : **Validation par liste de domaines bloqués au signup** :
- Outils : `disposable-email-domains` npm + liste custom (gmail.com, yahoo.fr, hotmail.fr, outlook.com perso, free.fr, orange.fr, etc.)
- Message UX si refus : "KOVAS est réservé aux professionnels — merci d'utiliser votre email professionnel"
- Exception manuelle possible via support@kovas.fr (cas légitimes : auto-entrepreneur sans email pro)

### D708 — Validation SIRET signup (anti-abus essai)

A : **Validation SIRET en temps réel via API INSEE Sirene** (gratuit, public).
- Champ SIRET obligatoire au signup
- Lookup auto raison sociale + adresse (UX bonus)
- **1 essai par SIRET unique** vérifié (anti-abus)
- Si tentative 2ème essai sur même SIRET : message "Cet SIRET a déjà bénéficié d'un essai. Souscrivez ou contactez le support."

### D709 — Cookies & DPA & sous-traitants

A :
- **Cookies banner** : **Cookiebot** (~10-15€/mo) ou self-hosted via `vanilla-cookieconsent` (gratuit) — choix final selon ergonomie
- **DPA pour clients pro B2B** : Template DPA généré au signup, signable self-serve via Settings KOVAS → DocuSeal SES
- **Page sous-traitants publique** : `kovas.fr/legal/subprocessors` mise à jour à chaque ajout (Supabase, Anthropic, OpenAI, Stripe, Resend, Brevo, Sentry, PostHog, DocuSeal, Vercel, Expo, OVHcloud, Cookiebot, Hiscox, Iopole — liste qui s'étoffera)

---

## Paquet 8 — Support & Operations ✅

### D801 — Outil de ticketing

A : **Custom Supabase + Resend** Phase 1 (zéro coût, intégré au produit).

**Architecture** :
- Table `support_tickets` (`id`, `organization_id`, `user_id`, `subject`, `body`, `status` enum {open|in_progress|waiting_user|resolved|closed}, `priority`, `created_at`, `last_message_at`)
- Table `support_messages` (`id`, `ticket_id`, `from_role` enum {user|claude|founder}, `body`, `attachments`, `created_at`)
- Bouton "Support" in-app → ticket créé → notification email auto au fondateur
- Réponse fondateur via email → webhook Resend (`inbound`) → update ticket avec parsing du thread
- Chat IA Claude (Haiku 4.5) en pré-filtrage avec RAG sur KB → escalade humain si confidence < 0,7 OU mot-clé "humain"/"agent"/"personne"

**Bascule envisageable à M9+** vers Plain.com (gratuit < 1k tickets/mo) ou Crisp 25€/mo SI volume dépasse ~20 tickets/jour.

### D802 — Status page (revu par fondateur : custom au lieu de Better Stack)

A : **Système custom d'alerte d'incidents** intégré à Supabase (0€/mo vs ~300€/an Better Stack).

**Architecture en 4 briques** :

1. **Banner d'alerte in-app temps réel**
   - Table `incidents` (`active boolean`, `message text`, `severity` enum {info|warning|critical}, `started_at`)
   - Lecture mobile + web toutes les **60s**
   - Affichage banner navy en haut de l'app si `active = true`
   - Déploiement en 30 secondes depuis dashboard admin (fondateur uniquement)

2. **Email proactif Resend aux utilisateurs actifs**
   - Trigger manuel ou auto selon gravité (severity critical → auto)
   - Template pré-écrit, envoi 1 clic depuis admin dashboard
   - Cible : utilisateurs actifs derniers 7 jours (via `last_seen_at`)

3. **Page publique `/status` sur kovas.fr**
   - Next.js simple, alimentée par table `incidents`
   - "Tous systèmes opérationnels" ou message incident détaillé
   - **Historique 10 derniers incidents** avec cause + résolution
   - SEO-friendly (status.kovas.fr alias optionnel)

4. **Historique** via table `incidents` (`resolved_at`, `root_cause`, `resolution_notes`)
   - Mise à jour manuelle post-incident en 2 min

**Stack monitoring déjà en place couvre la détection** : Sentry (crashes), PostHog (anomalies usage), Vercel (uptime web), Supabase (DB), pas besoin d'outil dédié pour la détection.

**Effort initial** : 4-5h de dev en Sprint 11 ou 12 (Phase 1 fin).
**Coût** : 0€ infrastructure (utilise stack existante).

**Bascule vers Better Stack ou Statuspage.io UNIQUEMENT SI** :
- > 300 utilisateurs payants actifs
- Recrutement employé support
- Client enterprise exigeant SLA contractuel
- Intégration API tierce monitorant statut

**Économie estimée** : 300€/an pendant les 12-18 premiers mois.

### D803 — KB articles au launch

A : **20 articles essentiels au launch + 30 articles supplémentaires dans le mois suivant** (50 articles total à M9+1mois).

**20 articles essentiels couvrant** (Sprint 10-11 pre-launch) :
1. Démarrer ta première mission DPE
2. Saisir une mission via la voix (Whisper)
3. Photographier les équipements (Vision)
4. Dessiner un croquis 2D avec Apple Pencil
5. Calculer surface Carrez et Boutin
6. Générer le ZIP d'export Liciel
7. Importer le ZIP dans Liciel (FAQ)
8. Recommandations post-DPE F/G
9. Créer un devis et l'envoyer pour signature
10. Factures Factur-X et conformité 2026-2027
11. Inviter un collaborateur (Pro tier)
12. Mode hors-ligne et synchronisation
13. Sécurité et chiffrement de tes données
14. Export RGPD complet de tes données
15. Paramétrer ton logo cabinet sur PDF
16. Connecter un télémètre Bluetooth (Leica DISTO)
17. Tableau de bord et statistiques
18. Tarification, essai, abonnement
19. Migration depuis Liciel (importer clients)
20. Tour des raccourcis clavier iPad (productivité)

**+30 articles M10** : long-traîne (cas d'usage spécifiques, troubleshooting, intégrations avancées, FAQ réglementaire).

**Rédaction** : Claude 4.6 + relecture fondateur. Indexés via pgvector pour RAG du chat IA Claude.

---

## Paquet 9 — Risques & continuité ✅

### D901 — Protection IP design / brevet

A : **Marque INPI seule Phase 1** (déjà couverte au paquet 7 Vague 1 — 300€ dépôt).
**Pas** de brevet design / modèles déposés — le design est imitable mais difficile à protéger légalement, et l'avantage concurrentiel KOVAS = IA + UX + écosystème, pas la palette.

### D902 — Plan investisseurs / anti-rachat hostile

A : **Pas besoin d'investisseur** — alignement complet avec la vision solopreneur sans levée de fonds (PRD §1 et §14).

**Implication** : pas de pitch deck investors à préparer. Si offre rachat hostile Enersweet arrive M12+, négocier en position de force (valeur ARR + IP + écosystème), sans précipitation.

### D903 — Lawyer IP/interopérabilité retenu

A : **Lefèvre Avocats ou Lex2B en Vague 2 (M9-M18)** — déjà résolu au paquet 7.
Mémorandum opposable reverse-engineering Liciel sous L122-6-1 CPI + CGU spécifiques diag immobilier. Budget 1-1.5k€.

### D904 — Continuité fondateur (risque maladie/burnout/indispo)

A : **Mix advisor informel + procuration Qonto + agents IA backup**.

| Composant | Rôle | Coût |
|---|---|---|
| **Advisor informel** (mentor ancien fondateur SaaS) | 1 call mensuel, 0,1-0,5% equity | Très faible |
| **Procuration bancaire Qonto à un proche** | Continuité paiements/encaissements en cas indispo > 2 sem | 0€ |
| **Auto-pilot agents IA** pour onboarding/support si fondateur indispo | Cohérent stratégie IA-first | ~10€/mo (Railway) |

**Mesures préventives** :
- Cadence sprints disciplinée (max 50h/semaine)
- Vacances forcées Q3 et Q4 chaque année
- Monitoring santé (Oura Ring ou équivalent)

**Décision préalable** : **si < 30 abonnés à M9, pivot ou arrêt** — pas de mode "zombie".

### D905 — Runway personnel mensualisé

A : **≥ 24 mois** (fondateur vit chez parents, charges fixes proches de zéro).

**Très confortable**, permet d'atteindre Phase 2 (M10-18) sans pression cash-flow. Pas besoin de freelance dev side activity comme plan B.

**Trésorerie Nexus 1993** : Qonto actif, compte société séparé du compte perso, charges fixes SASU < 500€/an (URSSAF minimum + comptable).

---

## Paquet 10 — Domaine métier Liciel ✅

### D1001 — Acquisition export Liciel réel (approche hybride 3 étapes)

A : **Approche hybride en 3 étapes, budget 0-200€** (vs 360€ option achat pure).

#### Étape 1 — Démo Liciel gratuite (Sprint 0-1, 0€)
- Téléchargement immédiat sur `liciel.fr/telechargement-logiciel.html`
- Production 5-10 dossiers fictifs variant les modules
- Export ZIP via "Fichier → Importer/Exporter format ZIP"
- Analyse structure `LICIEL_Dossiers.mdb` + XML + photos
- **Effort** : 4-6h sur 2 jours
- **Résultat** : ~80% compréhension structurelle du format

#### Étape 2 — Diagnostiqueurs LinkedIn (Sprint 1-2, 0€)
- Outreach Playwright + Claude API ciblé "early adopters Liciel"
- 100 messages → 5-10 réponses positives attendues
- Sélection **3 diagnostiqueurs profils variés** (urbain/rural, vente/location, ancien/neuf)
- Script d'anonymisation fourni (noms, adresses, données client)
- **Contrepartie** : accès gratuit à vie KOVAS quand on lance
- **Effort** : 8-12h
- **Résultat** : 15-30 exports ZIP réels terrain

#### Étape 3 — Licence Liciel 1 mois (Sprint 6-7, 120-200€, CONDITIONNEL)
Déclenché UNIQUEMENT si corpus étapes 1+2 manque des variantes critiques :
- Module audit énergétique
- Module DTG copropriété
- Cas extrêmes (grandes maisons, copropriétés)

**Probablement 0€** si étapes 1+2 ont bien fonctionné.

#### Corpus cible final : 25-50 cas
- Par type : DPE vente/location maison/appartement, packs complets, audit, mesurage
- Par classe énergétique : A à G (focus D-E-F-G majoritaires)
- Par caractéristique : amiante, plomb, termites, photos nombreuses/absentes

#### Validation parser KOVAS (par cas du corpus)
1. Créer dossier équivalent dans KOVAS
2. Générer ZIP depuis KOVAS
3. Importer ZIP dans Liciel
4. Vérifier import sans erreur + données complètes

**Objectif : 95%+ de succès au lancement Phase 1 sur le corpus de test.**

**Économie** : 160-360€ vs option achat pure + cas réels terrain > cas fictifs internes.

### D1002 — Workflow Assistance Liciel (REDÉFINI)

A : **Pas d'assistance, juste export ZIP impeccable** (Option 3, pas Option 1 panel latéral).

**Justification stratégique** :
1. **Cohérence positionnement produit** : KOVAS Phase 1 = export ZIP en 1 clic, import 1 clic dans Liciel. Ajouter "Affichage côté" contredit la promesse principale, suggère implicitement que l'export ZIP n'est pas fiable.
2. **Focus dev sur ce qui compte vraiment** : économie de 1-3 semaines (panel ou bridge) à mettre sur qualité ZIP, parser robuste 25-50 cas, module audit énergétique, optimisations Vision.
3. **Force la qualité par contrainte** : sans Plan B, l'export ZIP DOIT être excellent (95%+ réussite import au lancement, 99% à M6 post-launch).
4. **Si cas marginal échoue, fallback naturel** : diagnostiqueur a déjà 2 écrans (iPad + PC), copy-paste manuel possible sans feature dédiée.

**Expérience d'import à soigner (compensation)** :
- **Documentation visuelle** : article KB avec 3 captures (bouton KOVAS, menu Liciel, confirmation), 200-300 mots
- **Vidéo tutoriel 60s** : démo bout-en-bout export → import (YouTube unlisted ou Loom)
- **Notification post-export in-app** : instructions 4 étapes, liens KB+vidéo, affichée juste après téléchargement ZIP

### D1003 — Import des données Liciel existantes des utilisateurs

A : **Import carnet clients depuis Liciel = P1 (Phase 1.5, post-launch)**. Parse `.mdb` côté server via `mdb-tools` Linux. Pas bloquant pour le launch.

### D1004 — Multi-user cabinet Phase 1

A : Schéma multi-tenant ready dès J0 (cohérent paquet 6 D605). UX **solo transparent** Phase 1 par défaut ; **Pro 89€ = jusqu'à 3 users explicites**. Cabinet 4+ users sur devis Phase 1, formalisé 199€/mo Phase 2.

### D1005-D1006 — Données métier (couverts par recherches)

- **D1005 schéma data** : 12+ tables détaillées dans `research/supabase-architecture.md` §3 (organizations, clients, properties, missions, mission_rooms, equipment_findings, voice_notes, sketches, photos, quotes, invoices, events, ai_usage, ai_kb_documents, jobs). Validé.
- **D1006 volume photos/mission** : ~20 photos × 3 MB ≈ 60 MB/mission. Storage Phase 1 ~90 GB/mo à 100 abonnés, ~$19/mo (sous Pro 100 GB inclus). Validé.

### D1007 — ERP (États des Risques)

A : **Géorisques** (API publique État, gratuit, officiel). Pas de Preventimmo.
URL API : `https://www.georisques.gouv.fr/api/v1/` — accès libre, pas de quota strict.

### D1008 — Télémètres Bluetooth supportés Phase 1

A : **Leica DISTO X3, X4 (et X6 si possible)** uniquement Phase 1.
- Documentation officielle disponible via Leica developer kit
- BLE protocol stable
- Marque dominante chez les diagnostiqueurs pro FR
- **Bosch GLM 50C → Phase 1.5** (après reverse-engineering BLE, ~2 sem)
- **Stabila / clones chinois → Phase 2+**

### D1009 — Types de mission Phase 1

A : **4 types confirmés** Phase 1 :
- **DPE vente** (maison + appartement)
- **DPE location** (maison + appartement)
- **Audit énergétique** (à validation diagnostiqueur certifié)
- **Copropriété** (DPE collectif, DTG, PPPT — partiel Phase 1, complet Phase 2)

Phase 2 ajoute : amiante, plomb (CREP), gaz, électricité, termites, Carrez/Boutin, ERP standalone.

### D1010-D1015 — Items émergés Phase 2 Liciel research

| ID | Décision |
|---|---|
| **D1010** Manifest.xml checksums | **Reproduire à l'identique** (sécurité anti-rejet Liciel). Calcul des checksums sur les fichiers du ZIP en post-traitement |
| **D1011** Compatibilité Liciel versions | **3 derniers minors** (cible Liciel 2024.1 conservateur). Monitoring Liciel updates via veille hebdo |
| **D1012** Seuil déclenchement Plan B (si Liciel sign exports) | **> 10 utilisateurs affectés OU > 48h downtime export** → activation immédiate Plan B (cf. PRD §15.2 : accélération Phase 2, communication transparente, garantie remboursement 3 mois Compagnon) |
| **D1013** Inclure `PDF/` folder dans ZIP | **Omettre** (Liciel regénère depuis les données importées) — économie taille ZIP + simplicité |
| **D1014** Scope IP lawyer | **Fixed CGU + opinion 1-1.5k€** (Lefèvre/Lex2B Vague 2 — cohérent paquet 7) |
| **D1015** Hosting MDB Writer microservice | **Hetzner CX21 Windows Server 2022** ~10€/mo (ACE engine natif Windows). Déploiement via GitHub Actions. Endpoint `POST /api/build-liciel-zip` consommé par Supabase Edge Function `liciel-export-zip`. ⚠️ **Revu par fondateur** : tester d'abord Linux `mdbtools`/`pymsaccess`/`node-mdb-sql` avant d'investir dans VM Windows. Création M5 si vraiment nécessaire, sinon supprimé. Économie potentielle 240€/an |

### ⚠️ MISE À JOUR MAJEURE Paquet 10 — Stratégie révisée multi-voies + défense intégrée

**Suite à la recherche Liciel v2 (web-vérifiée par fondateur) et au document `kovas-defense-strategy.md`, la stratégie Phase 1 Liciel est révisée** :

#### D1016 — Architecture "résilience par diversification" (CRITIQUE)

A : **Ne jamais avoir un seul chemin d'import vers Liciel.** Tester 3 voies en Sprint 1-2, **supporter au moins 2 voies en production** dès le lancement.

| Voie | Statut | Robustesse contre-attaque Liciel | Priorité |
|---|---|---|---|
| ZIP "Importer format ZIP" | À valider | 🔴 Fragile | Priorité 2 |
| **Imports spécifiques XML** | À valider (Piste A) | 🟢 Solide (passerelle publique) | **Priorité 1** |
| **Imports spécifiques Excel** | À valider | 🟢 Solide | Priorité 1 (backup XML) |
| Pilotage UI Liciel (pywinauto) | Fallback ultime | 🟡 Très fragile | Priorité 3 (Plan C) |
| Phase 2 : envoi ADEME direct | Roadmap M10-M18 | 🟢 Indépendance totale | Phase 2 |

**Pari technique fondateur** : **Piste A (Imports spécifiques XML/Excel) gagne** sauf si Liciel refuse spécifiquement le format. Dans ce cas, fallback Piste B (ZIP via Jackcess Java).

#### D1017 — Architecture technique du module Liciel

A : **Microservice Java (Jackcess) sur Linux** comme primaire (chemin A) + **Hetzner Windows VM (Liciel installé)** comme secondaire (chemin C pilotage UI).

| Composant | Rôle | Hosting |
|---|---|---|
| **Microservice Java + Jackcess 4.0.10** | Génère `.mdb` Jet 4.0 + XML CII pour Imports spécifiques | Railway ou Hetzner Linux (~5€/mo) |
| **Hetzner Windows Server VM** | Liciel V4 installé + licence Benjamin Bel + pywinauto scripts | Hetzner CX21 Win Server ~10€/mo (M5+ si nécessaire) |
| **Node.js orchestrator** (Supabase Edge Function `liciel-export`) | Compose ZIP final, route vers la voie active selon feature flag | Supabase Edge |

#### D1018 — Stratégie défensive intégrée (référence `kovas-defense-strategy.md`)

A : la stratégie défensive **est obligatoire** et intégrée à chaque sprint dès Sprint 0. Voir le document complet `kovas-defense-strategy.md` pour le détail.

**5 piliers défensifs résumés** :
1. **Journal de découverte versionné GPG** dans repo `kovas-discovery-log` séparé (preuve juridique)
2. **Architecture multi-voies d'import** (résilience technique aux contre-attaques)
3. **Com de crise pré-rédigée** : 3 assets pré-publiables (page Pourquoi KOVAS, FAQ technique, communiqué de presse)
4. **Assurance RC pro Hiscox avec extension PI** confirmée (+200-400€/an sur la souscription Hiscox D702)
5. **Position dominante Liciel/Enersweet (~50% PdM)** = munition juridique côté concurrence si harcèlement avéré

**Interdits absolus** :
- Pas de désassembleur (Ghidra, IDA, dotPeek, dnSpy) sur Liciel.exe
- Pas d'employé/stagiaire ex-Liciel sur rôles tech
- Pas de scraping de WikiLiciel privé via compte tiers
- Pas de mention publique de Liciel dans marketing KOVAS Phase 1 (12 premiers mois)
- Pas de communication sur forums Diagnostic-immo.com

#### D1019 — Stratégie d'acquisition fixtures révisée

A : combinaison 3 sources avec contrats légaux propres :
1. **Démo Liciel V4 téléchargée légitimement** par Benjamin (Sprint 1, 0€)
2. **Licence Liciel 1 mois achetée à Benjamin Bel** (Sprint 1, 120-200€) — facture Nexus 1993 archivée dans repo discovery-log
3. **3 diagnostiqueurs partenaires LinkedIn** sous NDA + contrat prestation 100-200€/personne (Sprint 1-2)

Anonymisation systématique avant versionning. Script d'anonymisation versionné.

#### D1020 — Plan de continuité "Liciel casse tout"

A : runbook documenté et testé Sprint 6 (avant bêta) :
1. **Détection** : CI nightly détecte rejet imports KOVAS
2. **Communication** : message pré-rédigé via Resend aux utilisateurs actifs
3. **Bascule** : feature flag PostHog force le canal alternatif
4. **Reverse new version** : ETA 48-72h
5. **Post-mortem public** : blog KOVAS factuel, construire narratif "petit acteur indépendant face à quasi-monopole consolidé Pictet AM"

---

## Paquet 11 — Comptes & infra ✅

### D1101 — Liste finale des comptes services (26 comptes, optimisé par fondateur)

| # | Service | Quand | Coût mensuel à M3 | Coût mensuel à M12 | Statut |
|---|---|---|---|---|---|
| 1 | **Anthropic Console** | M0 | Variable | ~$200 | ✅ Actif (via Claude Max) |
| 2 | **OpenAI Platform** (Whisper) | M0 | Variable (~$10) | ~$50 | À créer |
| 3 | **Supabase** | M0 Free → M2 Pro $25 → **M5 Pro+PITR $125** | $25 M3 | $125 | À créer |
| 4 | **Vercel** | M0 Hobby → M3 Pro $20 | $20 | $20 | À créer |
| 5 | **Expo EAS** | M0 Free → M3 Production $29 | $29 | $29 | À créer |
| 6 | **Railway** | M0-M5 gratuit (free credit) → **M6+ $15** | $0-5 | $15 | À créer |
| 7 | **Resend** | M0 Free → M3 $20 | $20 | $20 | À créer |
| 8 | **Brevo SMS** | M3 Pay-as-you-go | ~30€ M3-M6 | ~360€ | À créer |
| 9 | **Sentry** | M0 Free → M6 Team $26 | $0 | $26 | À créer |
| 10 | **PostHog** | M0 Free → M6 Team $29 | $0 | $29 | À créer |
| 11 | **GitHub** | M0 (private repos Nexus 1993) | $0 | $0 | À confirmer (perso ou Nexus 1993) |
| 12 | ~~OVHcloud Object Storage~~ | **SUPPRIMÉ** Phase 1 (Supabase PITR + backup quotidien suffisants ; réintégrer M18+ si enterprise) | $0 | $0 | Économie $180/an |
| 13 | **Iopole PDP Factur-X** | **DIFFÉRÉ M24** (obligation TPE diagnostiqueurs septembre 2027-2028, factures PDF classiques suffisent jusque-là) ⚠️ Date à reconfirmer Phase 4 | $0 | $0 jusqu'à M24 | Économie 240€+ |
| 14 | **INSEE Sirene API** | M2 | $0 | $0 | À configurer (gratuit) |
| 15 | **Géorisques API** | M3 | $0 | $0 | À configurer (gratuit) |
| 16 | ~~Cookiebot~~ | **SUPPRIMÉ** — remplacé par bandeau cookies custom React (4h dev, 0€ récurrent). Cookiebot pertinent si 50+ scripts tiers, pas notre cas Phase 1 | $0 | $0 | Économie $180/an |
| 17 | **Apple Developer Program** | M1 (après D-U-N-S 5-15j) | $8 | $8 | À créer |
| 18 | **Dun & Bradstreet D-U-N-S** | M0 (5-15j ouvrés, prérequis Apple) | $0 | $0 | À créer |
| 19 | **Google Play Developer** | **M1 confirmé** | $2 (one-shot $25 lifetime) | $2 | À créer |
| 20 | **INPI marque KOVAS** | M1 (300€ one-shot) | $0 | $0 | À créer |
| 21 | **Hetzner Windows VM** (MDB Writer) | **TESTER Linux mdbtools d'abord ; M5 si nécessaire seulement** | $0-10 | $0-10 | Conditionnel |
| 22 | **Hiscox assurance RC** | **M5 (avant bêta)** | $75 (900€/an) | $75 | À créer |
| 23 | **LinkedIn Premium Business** | M1 | 50€ | 50€ (puis Sales Nav 99€ M6+ si justifié) | À créer |
| 24 | **Stripe** (NOUVEAU) | M0 (indispensable pour pricing + paiements) | $0 (commission only) | Variable | À créer |
| 25 | **Cloudflare** (NOUVEAU) | M0 (DNS + CDN + SSL gratuit) | $0 | $0 | À créer |
| 26 | **Google Workspace Business Starter** (NOUVEAU) | M0 (email pro `benjamin@kovas.fr`, `contact@kovas.fr`, `support@kovas.fr` + Calendar + Meet) | 6€ | 6€ | À créer |

### Budget mensuel cumulé (optimisé par fondateur)

| Phase | Budget mensuel | Économie vs liste initiale |
|---|---|---|
| **M0-M3** | ~$120/mo | -$80 (vs $200) |
| **M3-M6** | ~$300-350/mo | -$150 (vs $400-500) |
| **M6-M9** | ~$500/mo | -$100 (vs $600) |
| **M9-M12** | ~$900-1100/mo | -$400 (vs $1200-1500) |

**Économie cumulée 12 mois** : **~$1900 (~1750€)**, gardée pour Hiscox (M5), Vercel/Expo upgrades, et marge.

### Comptes existants actifs Benjamin (confirmé par fondateur)

- ✅ **Anthropic Console** (via Claude Max)
- ✅ **Cursor Pro** (déjà cité brain dump)
- ✅ **Domain kovas.fr** (réservé)
- ✅ **LinkedIn perso** (pour outreach)
- ✅ **Qonto SASU Nexus 1993** (compte société actif)

### Comptes à créer (par ordre de priorité)

**Sprint 0 (M0, semaine 1)** :
1. GitHub (Nexus 1993 si possible, sinon perso) + private repos
2. D-U-N-S Dun & Bradstreet (déclencher tôt, 5-15j délai)
3. Google Workspace Business Starter (emails pro benjamin@/contact@/support@kovas.fr)
4. Cloudflare (DNS + SSL gratuit pour kovas.fr)
5. Supabase Free (eu-west-3 Paris)
6. Vercel Hobby
7. Expo EAS Free
8. Resend Free
9. Sentry Free
10. PostHog Free
11. Stripe (Test mode)
12. OpenAI Platform (Whisper test)
13. Railway free credit

**Sprint 1-2 (M1-M2)** :
14. Apple Developer (après réception D-U-N-S)
15. Google Play Developer ($25 one-shot)
16. INPI marque KOVAS (300€ dépôt)
17. LinkedIn Premium Business (50€/mo)
18. INSEE Sirene API config

### D1102 — Apple Developer + D-U-N-S

A : **D-U-N-S déclenché M0** (5-15j ouvrés), **Apple Developer enrollment M1** sous SASU Nexus 1993 ($99/an).

### D1103 — Google Play Developer

A : **M1 confirmé** ($25 one-shot lifetime). Compte créé tôt pour avoir le compte prêt même si publication APK Phase 2 M13+.

### D1104 — Budget mensuel acceptable services pré-prod

A : trajectoire validée ci-dessus :
- M0-M3 : < $200/mo
- M3-M6 : < $400/mo
- M6-M9 : < $500/mo
- M9+ : scale avec ARR, marge brute 60-65% target

### D1105 — Stratégie staging

A : **Vercel Preview + Supabase Branching auto par PR** (validé par fondateur).

- **Production** : branch `main` → Supabase project `kovas-prod` (eu-west-3 Paris) + Vercel production (kovas.fr)
- **Preview** : chaque PR → Supabase ephemeral branch + Vercel preview URL (`pr-{N}-kovas.vercel.app`)
- **Staging permanent** : branch `staging` → Supabase project `kovas-staging` (eu-west-3) + Vercel staging (`staging.kovas.fr`) pour QA bêta-testeurs continu

---

## 🔄 REFONTE STRUCTURELLE 18/05 — Conflits résolus avec paquets 1-12

> **15 modifications structurelles** issues de l'analyse mercenaire + audit externe (note 55/100). Ce bloc surclasse les décisions antérieures en cas de conflit.
>
> Détail intégral dans CLAUDE.md + artefacts dérivés ([`pricing-strategy.md`](pricing-strategy.md), [`economics.md`](economics.md), [`gtm.md`](gtm.md), [`features-roadmap.md`](features-roadmap.md), [`team.md`](team.md), [`planning-14-jours.md`](planning-14-jours.md)).

### Modification 1 — MVP réduit à 6 features cœur

**Conflit avec** : Paquet 2 (DoD F1-F5 vision/croquis/recos F/G).
**Résolution** :
- **MVP V0.5 = 6 features uniquement** : (1) saisie vocale structurée par pièce, (2) photos géolocalisées + annotations, (3) croquis 2D manuel rapide, (4) auto-complétion adresse BAN+IGN+Géorisques, (5) export multi-format (PDF+Word+CSV+JSON+ZIP Liciel), (6) sync mobile/web + offline complet
- **Features RETIRÉES du MVP** (reportées V2/V3 ou Phase 2-3) : Vision IA reconnaissance équipement, Croquis IA depuis photo, Recos post-DPE F/G auto, LiDAR 3D, Assistant IA conversationnel, Marketplace MAR/RGE, Multi-utilisateurs cabinet, Yousign en pack mensuel, Télémètres BLE, Audit énergétique, API publique, Espace pro B2B
- **Effort total MVP** : 25j → 17-18j intensifs sprint 14j

### Modification 2 — Pricing 4 tiers à l'usage (Phase 1)

**Conflit avec** : Paquet 6 D603 RÉVISÉ (Solo 79€/Pro 129€/Phase 2 149-199€/Phase 3 199-299-499€).
**Résolution finale 18/05** :
- Phase 1 : **Découverte 29€ (20 missions, 2€ surplus) / Standard 59€ (60 missions, 1,50€ surplus, RECOMMANDÉ) / Volume 99€ (150 missions, 1€ surplus)**
- Phase 2 : Standard Complet 99€ / Volume Complet 149€ / Cabinet 199€ (3 users)
- Phase 3 : 149€ / 199€ / 299€ / Enterprise 499€
- **AUCUN add-on activable** — toutes fonctionnalités incluses dans tous les tiers
- **Options ponctuelles à l'usage** : eIDAS 2€/sig, bilingue 5€/rapport, SMS 0,15€

### Modification 3 — UX anti-friction paiement (NOUVEAU)

Architecture complète : CB enregistrée 1 fois, widget transparence permanent, notifications positives 80%/100%/150%, plafond auto-protecteur activable, email récap mensuel transparent, email "Tu paies trop" auto.

Voir [`pricing-strategy.md`](pricing-strategy.md) §9.

### Modification 4 — Essai gratuit 14 jours (vs 7 jours)

**Conflit avec** : Paquet 4 D401 (essai 7 jours).
**Résolution** : **14 jours calendaires**, CB non requise, email pro + SIRET obligatoires, 30 missions max plafond technique caché.

Séquence emails : J+1 (auto) / J+4 (humain Benjamin) / J+8 / J+11 / J+13.

### Modification 5 — Marge brute 75-78% (vs 60-65% initial)

**Conflit avec** : Paquet 12 D118 + économie initiale.
**Résolution** : marge brute par profil :
- Démarrant Découverte : **84%**
- Solopreneur Standard : **80%**
- Power user Volume : **74%**
- Cabinet Phase 2 : **76%**
- **Moyenne pondérée Phase 1 : ~77%**

### Modification 6 — Projections corrigées

**Conflit avec** : PRD initial cibles (50-65k€ M12, 500-600k€ M24, 1,5-2M€ M36).
**Résolution révisée** :
- **M12 ARR 117k€** (+80% vs initial)
- **M24 ARR 768k€** (+30%, **objectif révisé : 1M€**)
- **M36 ARR 2,77M€** (+50%, marge nette 2,13M€)

### Modification 7 — CAC réaliste 400€ blended

**Conflit avec** : Paquet 1 D113 (CAC <250€ blended).
**Résolution** :
- CAC essai blended : ~80€
- **CAC payant blended : ~400€** (conversion 22-28%)
- LTV (~1920€) / CAC ratio : **4,8** (cible >3 ✓)
- Payback : **5 mois**

### Modification 8 — Bêta privée en 2 phases (M6-M9)

**Conflit avec** : Paquet 4 D505 (bêta 40-50 gratuit 3 mois).
**Résolution** :
- **Phase A M6→M7** (1 mois) : GRATUITE — tests fonctionnels
- **Phase B M7→M9** (2 mois) : tier Découverte 29€/mo — validation économique
- M9+ Founders à vie : Standard 49€/mo (70 missions, surplus 1€), Cabinet Phase 2 169€/mo

### Modification 9 — Recrutement advisor diagnostiqueur (NOUVEAU)

Lacune critique : pas d'expertise métier interne.

**Profil** : 10+ ans diag, maîtrise Liciel, influence métier, 35-50 ans.
**Termes** : 0,5-1% BSPCE, vesting 2 ans, cliff 6 mois.
**Recrutement** : parmi 50 entretiens M0-M5, poser la question à 3-5 candidats M3-M4.

Voir [`team.md`](team.md) §2.

### Modification 10 — Vision Phase 4 "Field Compliance OS" (NOUVEAU)

Extension long terme à 5 verticales adjacentes (audit énergétique RGE, EDL locataires, contrôle technique, expertise assurance, conformité ERP).
**TAM étendu Phase 4+** : ~138 M€/an. **TAM cumulé total KOVAS** : ~170 M€/an.

Pas d'action immédiate. Documenté pour pitch deck investisseurs si offre opportuniste.

### Modification 11 — Planning 14 jours sprint intensif

**Confirmation fondateur** : cible RÉALISTE avec Cursor + Claude Code, solo, 12-14h/jour.

Détail jour par jour dans [`planning-14-jours.md`](planning-14-jours.md).

Buffer polish J15-J18 (4 jours réserve).

### Modification 12 — Juridique IA-first en 3 vagues

**Conflit avec** : Paquet 7 D701 (Lefèvre/Lex2B Vague 2).
**Résolution** :
- Vague 1 (M0-M9) : 100% IA Claude Max + INPI DIY, 300€
- Vague 2 (M9-M18) : audit avocat IP/Tech ciblé Lefèvre/Lex2B, 1-1,5k€
- Vague 3 (M18+) : conseil à la demande, 300-500€/h
- **Budget cumulé 24 mois** : 2 800-4 800€

### Modification 13 — Hiscox RC Pro M5

**Conflit avec** : Paquet 7 D702 (Hiscox M5, plafonds 500k€/1M€).
**Résolution** :
- Phase 1 (M5-M18) : Pack RC Pro Numérique + Cyber, plafonds 500k€/1M€, **+ extension PI obligatoire (+200-400€)**, prime ~900€/an
- Phase 2 (M10+) : upgrade 2M€/5M€ + sous-couv "Responsabilité diagnostic immobilier certifié", prime 2,5-3,5k€/an
- Phase 3 (M19+) : 3M€/10M€ + sous-couv "Plateforme mise en relation", prime 4-6k€/an

### Modification 14 — Support IA-first custom

**Conflit avec** : Paquet 8 D801-D803 (Custom Supabase + Resend).
**Résolution** : cohérent, **confirmé** :
- Ticketing custom Supabase + Resend (0€ infra)
- KB : 20 articles essentiels au launch + 30 articles bonus 4 semaines suivantes
- Status page custom (banner in-app + page `/status` + table `incidents` Supabase)

### Modification 15 — Comptes services révisés

**Conflit avec** : Paquet 11 D1101 (26 comptes).
**Résolution** : liste simplifiée + planning révisé.
- **M0 impératifs** : Anthropic, OpenAI, Stripe, Supabase Free→Pro M2→PITR M5, GitHub, Resend, Vercel, Expo EAS, Railway Free→15€ M6, Cloudflare, Google Workspace, D-U-N-S
- **M1** : Apple Developer (post D-U-N-S), Google Play, INPI marque, LinkedIn Premium Business
- **M2-M3** : Sentry, PostHog, Brevo SMS, INSEE Sirene API, Géorisques API
- **M5** : Hiscox RC Pro + extension PI
- **Différés** : Yousign M9+ (Cabinet Phase 2 seulement + option ponctuelle 2€/sig), Iopole PDP M24+, Hetzner Windows VM conditionnel
- **Supprimés** : OVHcloud Object Storage, Cookiebot, Preventimmo, Sales Navigator, Better Stack, Captain Contrat, Crisp/Plain

### Mise à jour D118 — Métriques KPI

Avec marge brute 77% + ARR M24 1M€, recalibrage :
- D113 CAC blended : **< 400€** (vs <250€ initial)
- D114 LTV : **> 1920€** (vs >2500€ trop ambitieux)
- D118 Taux complétion mission : **> 92%** (KPI #1 produit, conservé)

### Modification 18 — MVP V1 étendu + Focus 8 diagnostics + Stratégie export 3 modes (18/05)

**Conflit avec** : MVP "6 features" actuel + features-roadmap V2/V3 + PRD §6.3 + Phase 4 Field Compliance OS + economics marge 77%.

**Document détaillé** : [`/docs/modification-18-mvp-v1-extended.md`](../../docs/modification-18-mvp-v1-extended.md)

**Résolutions clés** :

1. **MVP V1 = 10 features** (vs 6) : ajout templates pièces + check-lists + upload doc propriétaire + validation cohérence + bouton "Partager" 3 modes. **Croquis 2D retiré V1 → V2**.

2. **Focus 8 diagnostics standards (92% volume)** : DPE / amiante / plomb CREP / gaz / élec / termites / Carrez-Boutin / ERP. Couverture progressive : 65% fin sprint (DPE + amiante) → 92% fin M2 post-launch.

3. **❌ SUPPRIMÉS DÉFINITIVEMENT** :
   - Audit énergétique réglementaire
   - DTG (Diagnostic Technique Global)
   - Marketplace MAR (Mon Accompagnateur Rénov') / artisans RGE / commissions mise en relation

4. **Stratégie export 3 modes formalisée** : Email auto + Google Drive/Dropbox auto-sync (recommandé) + DL direct. UX cible **30s-1min vs 1h30-2h** re-saisie. V2 : KOVAS Bridge .NET/Electron pour PC.

5. **Approche IA hybride V1** : parser custom JS 80% + Claude Haiku 20% → **0,01€/mission** (vs 0,15€ tout Claude). Marge brute **80% dès V0**.

6. **Phase 4 recentrée** : expansion géographique BE/LU/CH (~15k diagnostiqueurs additionnels) **OU** productivité avancée diagnostics standards. Décision M30 selon traction.

7. **Projections révisées** : M12 126k€ ARR / 96k€ MN, M24 867k€ ARR / 685k€ MN, M36 2,9M€ ARR / 2,3M€ MN.

8. **Sprint 14j révisé** : J8 templates+checklists (vs croquis), J9 upload doc propriétaire (nouveau), J10 validation cohérence + sync + offline.

9. **Différenciateurs Phase 1 révisés (3 piliers)** :
   - Saisie vocale hybride FR (parser + Claude)
   - Exports multi-format universels (Plan B sans Liciel)
   - **Simplicité d'usage et de migration** (Partager 3 modes + templates + check-lists + validation)

### Modification 17 — Pivot PWA-only Phase 1 (18/05 post-D-U-N-S)

**Conflit avec** : Paquet 11 D1102, D1103 (Apple Dev + Google Play M1) + Paquet 3 D305 (op-sqlite + Drizzle) + PHASES.md Phase 0 Task 0.2 + Phase 2 Task 2.1.

**Résolution** : **PWA-only Phase 1, apps natives différées V2** (M9-M12+ si demande explicite users).

**Décisions** :
- **D1102/D1103 Apple Developer + Google Play** : DIFFÉRÉS V2 → économie ~120€/an Phase 1
- **D305 op-sqlite + Drizzle** : remplacé par **Dexie.js sur IndexedDB** (PWA-natif)
- **Stack mobile** : remplacé par Next.js 15 PWA pur (suppression `apps/mobile/` du monorepo)
- **Croquis 2D Apple Pencil** : Konva.js + PointerEvents API (au lieu de RN+Skia) — `event.pressure` OK, tilt/hover NON mais acceptable pour symboles diag
- **D-U-N-S 281 515 446** : GARDÉ (gratuit lifetime, utile V2 si retour native)
- **Persistence iPadOS PWA après 7j inactivité** : **ceinture + bretelles** = (1) onboarding force "Add to Home Screen" + (2) push email sync forcé J+5 si pas actif + (3) monitoring PostHog last_active_at

**Document détaillé** : [`/docs/pwa-pivot-decision.md`](../../docs/pwa-pivot-decision.md)

**Trigger re-activation native** :
- ≥ 20% users payants demandent app native via tickets/sondage, OU
- ≥ 30% taux d'utilisateurs en mode browser (pas "Added to Home Screen") après 30j, OU
- iPadOS update casse feature critique PWA (peu probable mais surveillé)

**Économies Phase 1** : ~120€/an + ~3-5j dev sprint MVP + 0 friction Apple Review + updates instantanées push code.

### Conflit RÉSOLU — Différenciateurs Phase 1

**Conflit avec** : PRD §4.3 (Top 5 différenciateurs : vocal, vision, croquis IA, recos F/G, chatbot).
**Résolution Phase 1 = 3 piliers** :
1. **Saisie vocale terrain structurée par pièce** (unique au monde)
2. **Exports multi-format universels** (PDF + Word + CSV + JSON + ZIP Liciel — Plan B sans Liciel)
3. **Croquis 2D manuel rapide Apple Pencil** (UX premium, pas de re-saisie)

Vision IA + Recos F/G arrivent Phase 2 (M10-M18). Chatbot arrive Phase 3 (M19+).

---

## 📚 Pointers vers artefacts dérivés (post-refonte 18/05)

| Sujet | Document authority |
|---|---|
| Vision projet + résumé exécutif | [`CLAUDE.md`](../../CLAUDE.md) (racine projet) |
| MVP 6 features détaillé | [`features-roadmap.md`](features-roadmap.md) |
| Pricing complet + mécaniques anti-friction | [`pricing-strategy.md`](pricing-strategy.md) |
| Économie détaillée (marges, projections) | [`economics.md`](economics.md) |
| GTM (canaux, funnel, conversion) | [`gtm.md`](gtm.md) |
| Planning sprint 14 jours | [`planning-14-jours.md`](planning-14-jours.md) |
| Recrutement advisor + équipe | [`team.md`](team.md) |
| Stratégie défensive Liciel | [`kovas-defense-strategy.md`](kovas-defense-strategy.md) |
| Recherches techniques | [`research/`](research/) — 6 fichiers |
| PRD complet | [`PRD.md`](PRD.md) (v3 actif) |






















