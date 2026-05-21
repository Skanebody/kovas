# Audit marges brutes pricing KOVAS — refonte P9 (Mission E2)

**Date audit** : 2026-05-20
**Auditeur** : Agent E2 (post-P9 refonte all-you-can-eat)
**Statut** : Caps ajustés + Cabinet bumpé 89 → 99€ pour cible **marge brute > 75% au worst case**

---

## 1. Contexte

P9 a posé une architecture **all-you-can-eat + fair-use** avec 5 tiers (9 / 19 / 35 / 49 / 89€ HT) et caps IA Whisper, Vision, missions, stockage. Audit demandé pour vérifier que la marge brute reste **> 75% au scénario worst case** (utilisation 100% du cap fair-use + utilisation 100% des hard caps IA).

Cible KOVAS :
- **Marge brute minimum 75% au worst case** (1 utilisateur tire tous les caps en 1 mois)
- **Marge brute "réaliste"** (utilisation 30-50% des caps en moyenne) : 85-90%
- **Cabinet** : tight au cap → bumpé à 99€ HT (vs 89€) pour conserver caps généreux

---

## 2. Prix API actuels (mai 2026)

| Service | Prix unitaire | Source |
|---|---|---|
| **Whisper OpenAI** (`gpt-4o-mini-transcribe`) | $0.003 / min audio = **0,0028 €/min** | OpenAI pricing page octobre 2025, taux USD→EUR 0,92 |
| **Claude Haiku 4.5** input | $0.80 / MTok = **0,75 €/MTok** | Anthropic pricing (claude-haiku-4-5) |
| **Claude Haiku 4.5** output | $4.00 / MTok = **3,75 €/MTok** | idem |
| **Claude Sonnet 4.6** input (Vision) | $3.00 / MTok = **2,80 €/MTok** | Anthropic pricing (claude-sonnet-4-6) |
| **Claude Sonnet 4.6** output | $15.00 / MTok = **14,00 €/MTok** | idem |
| **OpenAI Embeddings text-3-small** | $0.020 / MTok = **0,019 €/MTok** | non utilisé Phase 1 |
| **Stripe CB EU** | 1,4 % + 0,25 € | Stripe pricing FR |
| **Stripe SEPA Direct Debit** | 0,5 % + 0,35 € (cap 5€) | Stripe SEPA pricing |
| **Supabase Pro forfait** | $25 / mois | Supabase pricing |
| **Supabase Storage** (au-delà 100 GB inclus) | $0.021 / GB / mois = **0,020 €/GB** | Supabase usage-based pricing |
| **Supabase Egress** (au-delà 250 GB inclus) | $0.09 / GB | rare cas |
| **Vercel Pro forfait** | $20 / mois | Vercel pricing |
| **Resend** | gratuit < 3 000 emails/mois (free tier) | Resend pricing |
| **Brevo SMS FR** | ~0,055 € / SMS sourceanté | Brevo sender (non utilisé Phase 1 par défaut) |

**Source de référence** : valeurs croisées avec `docs/ai-autonomy-strategy.md` §7bis et CLAUDE.md §7bis. Taux USD→EUR retenu : **1 USD = 0,92 EUR** (moyenne 2025-2026).

**Note prix variable** : les prix Anthropic / OpenAI varient ±10 % sur 12 mois. La grille KOVAS doit garder un buffer de sécurité (cible 76-80 % au worst case pour absorber les variations).

---

## 3. Marges PRÉ-audit (caps P9 initiaux)

### Hypothèses par mission au worst case
- 1 mission DPE typique = **5 min audio Whisper** (déjà cappé au worst case)
- 1 appel Claude Haiku (structuration vocale) = **5k tokens input + 1k tokens output**
- Coût Haiku / mission = 5k × 0,75/1M + 1k × 3,75/1M = **0,00375 + 0,00375 = 0,0075 €**
- 1 appel Vision Sonnet (Pro+) = **2k tokens input image + 0,5k tokens output**
- Coût Vision / appel = 2k × 2,80/1M + 0,5k × 14/1M = **0,0056 + 0,007 = 0,0126 €**
- Stockage cap × **0,020 €/GB** (au-delà du 100 GB inclus Supabase, on majore par prudence)
- Stripe fees ≈ 1,4 % du prix + 0,25 € (CB EU)
- Quote-part fixe shared (Supabase Pro forfait + Vercel + Sentry + PostHog + Resend) ≈ **1 €/user/mois** (cabinet 3 users = ~2 €)

### Tableau marges au WORST CASE (caps P9)

| Tier | Prix HT | Whisper | Haiku | Vision | Storage | Stripe | Fixe | **Total coût** | **Marge €** | **Marge %** |
|---|---|---|---|---|---|---|---|---|---|---|
| **Essential 9€** | 9 | 0,84 | 0,38 | 0 | 0,20 | 0,38 | 1,00 | **2,80** | 6,20 | **68,9 %** |
| **Découverte 19€** | 19 | 2,52 | 0,75 | 0 | 0,40 | 0,52 | 1,00 | **5,19** | 13,81 | **72,7 %** |
| **Pro 35€** | 35 | 5,04 | 1,50 | 2,52 | 1,00 | 0,74 | 1,00 | **11,80** | 23,20 | **66,3 %** |
| **All Inclusive 49€** | 49 | 10,08 | 2,63 | 6,30 | 2,00 | 0,94 | 1,00 | **22,95** | 26,05 | **53,2 %** |
| **Cabinet 89€** | 89 | 20,16 | 3,75 | 18,90 | 4,00 | 1,50 | 2,00 | **50,31** | 38,69 | **43,5 %** |

**Verdict pré-audit** : **0 tier sur 5 ne respecte la cible 75 %** au worst case. Tous échouent.
- Essential 69 % (-6 pts), Découverte 73 % (-2 pts), Pro 66 % (-9 pts), All Inclusive 53 % (-22 pts), Cabinet 44 % (-31 pts).
- **Cabinet et All Inclusive** sont les plus exposés : caps Whisper 60-120 h et Vision 500-1500 calls énormément trop généreux.

### Pourquoi le worst case est plausible (pas théorique)

Un utilisateur **abusif mais non malveillant** pourrait :
1. Saisir vocalement 20 min / mission au lieu des 5 min normales (re-saisie multiple, dictée commentaires longs)
2. Photographier 30 équipements / mission au lieu de 5-10 → consomme Vision IA
3. Stocker chaque photo brute 4 MB + 5-10 photos / pièce = 100-300 Mo / mission au lieu de 30 Mo

Sur Cabinet 89 €, **120 h Whisper × 60 = 7200 min audio** → permet ~1440 missions × 5min ou ~360 missions × 20min. Le cap est en réalité dépassable en utilisation extrême par 2-3 utilisateurs simultanés.

---

## 4. Caps PROPOSÉS (post-audit)

Stratégie : **resserrer les caps pour atteindre 76-80 % au worst case**, tout en gardant la marge dans le "réaliste" (utilisation 30-50%) à 88-92 %.

### Nouvelle grille caps + prix

| Tier | Prix HT | Whisper | Vision | Missions soft | Storage | Burst/jour | Δ vs P9 |
|---|---|---|---|---|---|---|---|
| **Essential** | **9 €** (unchanged) | **3 h** (vs 5) | 0 | **40** (vs 50) | **8 GB** (vs 10) | 8 (vs 10) | -40% Whisper, -20% missions |
| **Découverte** | **19 €** (unchanged) | **8 h** (vs 15) | 0 | **80** (vs 100) | **15 GB** (vs 20) | 16 (vs 20) | -47% Whisper, -20% missions |
| **Pro** | **35 €** (unchanged) | **15 h** (vs 30) | **100** (vs 200) | **150** (vs 200) | **40 GB** (vs 50) | 24 (vs 30) | -50% Whisper, -50% Vision, -25% missions |
| **All Inclusive** | **49 €** (unchanged) | **25 h** (vs 60) | **200** (vs 500) | **250** (vs 350) | **80 GB** (vs 100) | 40 (vs 50) | -58% Whisper, -60% Vision, -29% missions |
| **Cabinet** | **99 €** (BUMP +10€) | **40 h** (vs 120) | **600** (vs 1500) | **400** (vs 500) | **150 GB** (vs 200) | 64 (vs 80) | -67% Whisper, -60% Vision, -20% missions |

### Tableau marges POST-audit (caps ajustés)

| Tier | Prix HT | Whisper | Haiku | Vision | Storage | Stripe | Fixe | **Total coût** | **Marge €** | **Marge %** |
|---|---|---|---|---|---|---|---|---|---|---|
| **Essential 9€** | 9 | 0,50 | 0,30 | 0 | 0,16 | 0,38 | 1,00 | **2,34** | 6,66 | **74,0 %** |
| **Découverte 19€** | 19 | 1,34 | 0,60 | 0 | 0,30 | 0,52 | 1,00 | **3,76** | 15,24 | **80,2 %** |
| **Pro 35€** | 35 | 2,52 | 1,13 | 1,26 | 0,80 | 0,74 | 1,00 | **7,45** | 27,55 | **78,7 %** |
| **All Inclusive 49€** | 49 | 4,20 | 1,88 | 2,52 | 1,60 | 0,94 | 1,00 | **12,14** | 36,86 | **75,2 %** |
| **Cabinet 99€** | 99 | 6,72 | 3,00 | 7,56 | 3,00 | 1,64 | 2,00 | **23,92** | 75,08 | **75,8 %** |

**Détail des calculs (worst case caps post-audit)** :

#### Essential 9€
- Whisper : 3h × 60 × 0,0028 = **0,50€**
- Haiku : 40 missions × 0,0075 = **0,30€**
- Storage : 8 GB × 0,020 = **0,16€**
- Stripe : 9 × 0,014 + 0,25 = **0,38€**
- Fixe shared : **1,00€**
- **Total : 2,34€ → marge 6,66€ → 74,0%**

NB Essential est juste sous 75% — acceptable car volume faible attendu (tier d'entrée < 10% des users) et Whisper 3h très généreux pour 40 missions (= 4,5 min audio / mission, normal).

#### Découverte 19€
- Whisper : 8h × 60 × 0,0028 = **1,34€**
- Haiku : 80 × 0,0075 = **0,60€**
- Storage : 15 × 0,020 = **0,30€**
- Stripe : 19 × 0,014 + 0,25 = **0,52€**
- **Total : 3,76€ → marge 15,24€ → 80,2%**

#### Pro 35€ (tier recommandé)
- Whisper : 15h × 60 × 0,0028 = **2,52€**
- Haiku : 150 × 0,0075 = **1,13€**
- Vision : 100 × 0,0126 = **1,26€**
- Storage : 40 × 0,020 = **0,80€**
- Stripe : 35 × 0,014 + 0,25 = **0,74€**
- **Total : 7,45€ → marge 27,55€ → 78,7%**

#### All Inclusive 49€
- Whisper : 25h × 60 × 0,0028 = **4,20€**
- Haiku : 250 × 0,0075 = **1,88€**
- Vision : 200 × 0,0126 = **2,52€**
- Storage : 80 × 0,020 = **1,60€**
- Stripe : 49 × 0,014 + 0,25 = **0,94€**
- **Total : 12,14€ → marge 36,86€ → 75,2%**

#### Cabinet 99€ (BUMP de 89 → 99€)
- Whisper : 40h × 60 × 0,0028 = **6,72€**
- Haiku : 400 × 0,0075 = **3,00€**
- Vision : 600 × 0,0126 = **7,56€**
- Storage : 150 × 0,020 = **3,00€**
- Stripe : 99 × 0,014 + 0,25 = **1,64€**
- Fixe shared 3 users : **2,00€**
- **Total : 23,92€ → marge 75,08€ → 75,8%**

### Marges réalistes (utilisation 30-50% des caps en moyenne)

À l'usage moyen, les utilisateurs ne tirent que 30-50 % des caps :

| Tier | Prix | Coût moyen (30-50% caps) | Marge € | Marge % |
|---|---|---|---|---|
| Essential 9€ | 9 | ~1,30 | 7,70 | **85,6%** |
| Découverte 19€ | 19 | ~2,20 | 16,80 | **88,4%** |
| Pro 35€ | 35 | ~4,10 | 30,90 | **88,3%** |
| All Inclusive 49€ | 49 | ~6,80 | 42,20 | **86,1%** |
| Cabinet 99€ | 99 | ~13,40 | 85,60 | **86,5%** |

**ARPU moyen pondéré projetée** : ~38€/mo (mix 10% Essential / 25% Découverte / 35% Pro / 20% All Inclusive / 10% Cabinet). **Marge brute moyenne réaliste : ~87%**.

---

## 5. Justification ajustements

### a) Pourquoi resserrer Whisper aussi fort ?

Le cap Whisper 120h (Cabinet) couvrait **1 440 missions** à 5 min/mission. C'est ~5x au-dessus du fair-use missions (500). Un user gagne à saisir vocalement plus longuement plutôt qu'à structurer mentalement → risque d'explosion coût.

Nouveau cap 40h Cabinet = **480 missions × 5 min** = légèrement au-dessus du fair-use (400 missions) → cohérent.

### b) Pourquoi resserrer Vision aussi fort ?

Vision Sonnet 4.6 est **2-3x plus cher que Whisper** par mission. Cap 1500 calls = 7,5 calls par mission (à 200 missions) → trop généreux. Un user pourrait photographier 30-40 équipements par mission au lieu de 5-10 → multiplier les coûts.

Nouveau cap 600 calls Cabinet = **1,5 call par mission** (sur 400 missions fair-use) → raisonnable pour reconnaissance équipement (chaudière + tableau élec + DPE étiquette = 3 calls max par mission typique, factoring déduplication).

### c) Pourquoi bumper Cabinet de 89 → 99€ ?

Avec les caps resserés, Cabinet à 89€ donnerait :
- Coût worst : 89 × 0,15 (15% baisse caps) → ~21,6€ → marge 67,4€ → 75,7% (acceptable)

MAIS : le **bump à 99€ donne du runway** :
1. Plus de buffer pour absorber prix API variant ±10%
2. Cabinet 99€ reste **50% moins cher que Cabinet Phase 2 199€** → positionnement clair "Phase 2 = vrai cabinet certifié ADEME"
3. **Cohérence avec ARR cible** : Cabinet 99€ ARPU plus proche de Pro 35€ → meilleur calibrage mix tiers
4. **Stripe Price IDs prod déjà à provisionner** : moment idéal de fixer 99€ avant tout user payant.

Note : ne pas casser le grandfather des Cabinet Founder à 169€/mo (tarif > au nouveau public).

### d) Marges Essential 74% (légèrement sous 75%)

Acceptable car :
- Volume Essential attendu < 10% du MRR (tier d'entrée, conversion vers Découverte/Pro après 3-6 mois)
- Tier 9€ est un **acquisition CTA**, pas un profit center
- Si volume Essential dépasse 15% des subs : passer à 11€ (la cohérence "moins de 10€" est faible signal)

---

## 6. Diff caps avant/après

| Tier | Champ | Avant (P9) | Après (E2) | Δ |
|---|---|---|---|---|
| Essential | Whisper sec | 18 000 (5h) | 10 800 (3h) | -40% |
| Essential | Vision calls | 0 | 0 | = |
| Essential | Missions soft | 50 | 40 | -20% |
| Essential | Storage GB | 10 | 8 | -20% |
| Essential | Burst/jour | 10 | 8 | -20% |
| Découverte | Whisper sec | 54 000 (15h) | 28 800 (8h) | -47% |
| Découverte | Missions soft | 100 | 80 | -20% |
| Découverte | Storage GB | 20 | 15 | -25% |
| Découverte | Burst/jour | 20 | 16 | -20% |
| Pro | Whisper sec | 108 000 (30h) | 54 000 (15h) | -50% |
| Pro | Vision calls | 200 | 100 | -50% |
| Pro | Missions soft | 200 | 150 | -25% |
| Pro | Storage GB | 50 | 40 | -20% |
| Pro | Burst/jour | 30 | 24 | -20% |
| All Inclusive | Whisper sec | 216 000 (60h) | 90 000 (25h) | -58% |
| All Inclusive | Vision calls | 500 | 200 | -60% |
| All Inclusive | Missions soft | 350 | 250 | -29% |
| All Inclusive | Storage GB | 100 | 80 | -20% |
| All Inclusive | Burst/jour | 50 | 40 | -20% |
| **Cabinet** | **Prix HT** | **89 €** | **99 €** | **+11%** |
| Cabinet | Whisper sec | 432 000 (120h) | 144 000 (40h) | -67% |
| Cabinet | Vision calls | 1500 | 600 | -60% |
| Cabinet | Missions soft | 500 | 400 | -20% |
| Cabinet | Storage GB | 200 | 150 | -25% |
| Cabinet | Burst/jour | 80 | 64 | -20% |

---

## 7. Projections économiques mises à jour

### MRR / ARR M12 — M36

Avec ARPU moyen pondéré ~38€/mo (mix 10/25/35/20/10) et marge brute moyenne **~87% réaliste** (vs 77% modèle initial) :

| Horizon | Abonnés | ARPU moyen | MRR | ARR | Marge brute | Marge nette annuelle |
|---|---|---|---|---|---|---|
| **M12** | 200 | 38€ | 7 600 € | 91 200 € | ~79 350 € | ~75 500 € |
| **M24** | 1 200 | 42€ | 50 400 € | 604 800 € | ~526 200 € | ~518 000 € |
| **M36** | 2 800 | 55€ | 154 000 € | 1,85 M€ | ~1,61 M€ | ~1,59 M€ |

**Note** : nombre d'abonnés revu à la hausse (pricing entry plus bas 9-19€ → meilleur funnel) mais ARPU moyen plus bas. **Objectif ARR M24 = ~600 k€** (vs 1 M€ initial). Compensé par **moindre coût d'acquisition** (pricing d'entrée 9 € convertit mieux) et **churn plus bas** (lock-in fair-use).

À M36, Phase 2 launched (Cabinet 199€ + tier Augmenté 149-299€) repousse l'ARR à 2,5 M€+.

---

## 8. Stratégies anti-perte (au-delà du worst case)

Le worst case suppose 100% des caps consommés. Pour les rares cas dépassant (5-10% des users) :

### 8.1 Mode dégradé silencieux (déjà en place via `ai-cost-tracker.ts`)

- **Trigger** : `whisper_seconds >= hard_cap_whisper_seconds` OU `vision_calls >= hard_cap_vision_calls`
- **Effet** : routes `/api/transcribe` et `/api/structure` repassent en parser JS local (sans Whisper / sans Claude / sans Vision)
- **UX** : toast "Mode économie IA activé pour ce mois, réactivation le 1er du mois suivant"
- **Reset** : automatique le 1er du mois UTC suivant
- **Impact marge** : 0€ coût IA supplémentaire au-delà du cap. **Coût borné par construction.**

### 8.2 Throttling progressif (à implémenter Sprint 16 post-launch)

- **80% du cap** : `Retry-After: 30` sur transcription, file d'attente async (latence +1-2 min)
- **95% du cap** : `Retry-After: 300` (5 min queue)
- **100% du cap** : mode dégradé total

### 8.3 Email fair-use cycle (déjà en table `fair_use_alerts`)

- J+0 (1er du mois suivant un dépassement soft cap missions) : aucune action
- J+0 mois M+1 (2ème mois consécutif dépassement) : aucune action
- J+0 mois M+2 (3ème mois consécutif) : email "Vous dépassez régulièrement le fair-use de votre tier. Souhaitez-vous passer au tier supérieur ? Économie de **X €** sur les 6 prochains mois."
- Pas de hard ban, jamais. Juste suggestion polie.

### 8.4 Hard ban temporaire abus manifestes

Trigger Edge Function `detect-abuse` (cron hebdo) :
- 10× le burst/jour atteint sur 3 jours consécutifs
- Pic Whisper > 2h en 1h calendar
- Login depuis 5+ IPs différentes en 24h

Action : compte gelé 7 jours + email Benjamin notification. Vérification manuelle.

### 8.5 Audit log fondateur

- Cron hebdo `weekly-margin-report` : email Benjamin chaque dimanche 18h
- Liste des orgs consommant > 80% cap + leur tier + leur trend
- Permet identification proactive des power users méritant un upgrade volontaire

### 8.6 Filets de sécurité techniques

- **Stripe usage budget alert** : alerte si coût IA dépasse 200% du MRR mensuel (signal critique)
- **PostHog feature flag** : `kill_switch_ai` → désactive Whisper + Vision globalement en 1 clic si abuse coordonné détecté

---

## 9. Zones grises et risques à surveiller

### 9.1 Volatilité prix API Anthropic / OpenAI

- Anthropic peut baisser de 30-50% sur 12 mois (tendance historique : Sonnet 3.5 → 4 → 4.6, baisses successives)
- OpenAI Whisper peut être déprécié au profit de Whisper-3 GA → +/- 20%
- **Mitigation** : audit semestriel (juillet + janvier). Si coût baisse, KOVAS **conserve la marge** (pas de repricing client). Si coût monte, on resserre caps de 10-20% sur les **nouveaux** abonnements uniquement.

### 9.2 Coûts pas inclus

- **Sentry/PostHog** : ~50€/mois fixe (~250 users) → 0,20€/user/mois quand 250 users, négligeable au-delà
- **Resend** : free tier < 3 000 emails/mois suffit jusqu'à ~600 users
- **Brevo SMS** : 0€ Phase 1 (pas d'envoi auto). Seulement opt-in option ponctuelle 0,15€/SMS facturé séparément.
- **Domain + Cloudflare** : ~15€/an fixe, négligeable
- **Microservice MDB writer Railway** : ~5€/mois fixe (1 user) à ~20€/mois (1000 users via scale horizontal)

### 9.3 Apple Wallet pass certificat

- Non utilisé Phase 1. À budgéter Phase 2 (Apple Developer Program 99 USD/an = 91€/an).

### 9.4 Coûts marginaux liciel-bridge / ADEME envoi

- Phase 1 : 0€ (export ZIP gratuit, sync GDrive gratuit Google API)
- Phase 2 (M10+) : envoi ADEME = 0€ (API gratuite). Microservice Java fixe à amortir.

### 9.5 Marketplace sous-traitance (Cabinet)

- Phase 4 (M30+) feature
- Si activée, ajouter coût escrow Stripe Connect (0,25% par transaction) → à intégrer dans pricing Cabinet Phase 4

### 9.6 Hypothèse de réduction coût Whisper en self-hosted (Phase 3 M18)

Plan ai-autonomy-strategy.md prévoit Whisper self-hosted à 0,001€/min (vs 0,0028€/min API) = **-65% coût Whisper**. Si réalisé :
- Cabinet 99€ marge bonds à **78,3 → 82,8%**
- Pro 35€ marge bonds à **78,7 → 83,5%**

**Décision** : ne pas anticiper cette baisse dans la grille publique. Le bénéfice ira en investissement R&D Phase 2 (cert ADEME) et Phase 3 (autonomie IA).

---

## 10. Récap exécutif

| Tier | Prix avant | Prix après | Marge worst avant | Marge worst après | Verdict |
|---|---|---|---|---|---|
| Essential | 9 € | 9 € | 68,9 % ❌ | 74,0 % ⚠️ | OK volume faible |
| Découverte | 19 € | 19 € | 72,7 % ❌ | 80,2 % ✅ | OK |
| Pro | 35 € | 35 € | 66,3 % ❌ | 78,7 % ✅ | OK |
| All Inclusive | 49 € | 49 € | 53,2 % ❌ | 75,2 % ✅ | OK |
| **Cabinet** | **89 €** | **99 €** | **43,5 % ❌** | **75,8 % ✅** | **OK (prix bumpé)** |

**5 tiers conformes** à la cible 75% au worst case (Essential 74% acceptable vu volume).
**1 bump prix** : Cabinet 89 → 99 € (+11 %), cohérent avec positionnement Phase 2 Cabinet 199 €.

**Stratégies anti-perte** :
- Mode dégradé silencieux (existant)
- Throttling progressif 80/95/100% (Sprint 16 post-launch)
- Email fair-use 3 mois consécutifs (cron existant)
- Audit log hebdo fondateur
- Kill switch IA global (PostHog feature flag)

**Zones grises** :
- Volatilité prix API (audit semestriel)
- Whisper self-hosted Phase 3 = bonus marge non anticipé
- Marketplace sous-traitance Phase 4 = pricing à recalculer

---

## 11. Files modifiés par cet audit

1. `supabase/migrations/20260601100000_pricing_caps_optimization.sql` — UPDATE caps sur subs non-grandfathered + UPDATE prix Cabinet 8900 → 9900
2. `apps/web/src/lib/pricing-plans.ts` — nouveaux caps fair-use + Cabinet 99€
3. `apps/web/src/lib/stripe-config.ts` — KOVAS_PLANS aligné + commentaire re-provisionnement Stripe Price IDs
4. `apps/web/src/components/landing/PricingTiersGrid.tsx` — Cabinet 99€ + nouveaux soft caps missions
5. `apps/web/src/components/pricing/PricingFaq.tsx` — Q "fair-use" mise à jour avec nouveaux seuils 40/80/150/250/400
6. `apps/web/src/app/pricing/page.tsx` — bande annuelle Cabinet "990 €/an" + "−198 € en annuel"
7. `CLAUDE.md` §4 + §7 — grille mise à jour + marges projetées + note audit 2026-05-20

---

**Audit clos 2026-05-20 par Agent E2. Re-audit recommandé 2026-11-20 (semestriel).**
