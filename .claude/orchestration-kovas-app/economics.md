# KOVAS — Économie projetée

**Date** : 2026-05-18
**Statut** : Authority document économie/finance
**Référencé par** : CLAUDE.md §7, PRD §12

---

## 1. Marge brute par profil utilisateur (Phase 1)

### Profil 1 — Démarrant (Découverte 29€/mo, 30 missions/mo)

| Poste coût variable | Montant |
|---|---|
| Whisper API (25 min × 0,008€/min) | 2€ |
| Claude API (~50 calls Haiku + 30 photos Vision Phase 2) | 3€ |
| Supabase storage (~5 Go images) | 1€ |
| Stripe fees (2,5%) | 1€ |
| Autres (Resend, monitoring) | 0,50€ |
| **Total coûts variables** | **~8€** |
| **ARPU** | 29€ + (10 × 2€) = **49€** |
| **Marge brute** | **41€ (84%)** |

### Profil 2 — Solopreneur typique (Standard 59€/mo, 75 missions/mo)

| Poste coût variable | Montant |
|---|---|
| Whisper API (60 min × 0,008€/min) | 5€ |
| Claude API (~150 calls Haiku + 75 photos Vision Phase 2) | 6€ |
| Supabase storage (~15 Go) | 2€ |
| Stripe fees (2,5%) | 2€ |
| Autres | 1€ |
| **Total coûts variables** | **~16€** |
| **ARPU** | 59€ + (15 × 1,50€) = **81,50€** |
| **Marge brute** | **65,50€ (80%)** |

### Profil 3 — Power user (Volume 99€/mo, 110 missions/mo)

| Poste | Montant |
|---|---|
| Coûts variables totaux | ~26€ |
| **ARPU** | **99€** (forfait, pas de dépassement) |
| **Marge brute** | **73€ (74%)** |

### Profil 4 — Cabinet Phase 2 (Cabinet 199€/mo, 220 missions/mo, 2 users)

| Poste | Montant |
|---|---|
| Coûts variables totaux | ~48€ |
| **ARPU** | **199€** |
| **Marge brute** | **151€ (76%)** |

### Synthèse Phase 1

**ARPU moyen pondéré Phase 1** : ~75€/mo
**Marge brute moyenne** : **~80%** (post-Modification 18 : approche IA hybride parser custom 80% + Claude Haiku 20% → 0,01€/mission vs 0,15€)

> ⚠️ Marge brute révisée de **77% → 80%** dans la Modification 18 (18/05) grâce à l'approche IA hybride et l'élimination du coût Vision IA / Recos F/G dans le MVP V1 (reportés V2).

---

## 2. Coûts variables détaillés par poste

### Anthropic Claude API (Phase 1, Vision/Recos en Phase 2)

Voir `research/anthropic-claude.md` §6.

- Recommandé tiered routing : Haiku 4.5 (voice + chat), Sonnet 4.6 (vision Phase 2 + sketch Phase 2 + reco Phase 2)
- Prompt caching 1h TTL agressif
- **Phase 1 (sans Vision/Recos)** : ~3-6€/user/mo
- **Phase 2 (avec Vision/Recos activées)** : ~6-12€/user/mo
- Avec prompt caching : -60% vs uncached

### OpenAI Whisper API

Voir `research/whisper-transcription.md` §7.

- **Phase 1** : ~0,003€/min × 60 min = ~0,18€/user/mo (Standard)
- **Avec post-processing Claude** : +0,07€/user/mo
- **Total voice pipeline** : ~0,20-0,30€/user/mo (10x sous budget initial)

### Supabase

Voir `research/supabase-architecture.md` §11.

- **Phase 1 (100 abonnés)** : Pro $25 + PITR $100 + ~$5 storage = **~$125/mo total** (~1,25€/user/mo)
- **Phase 2 (600 abonnés)** : Team $599 + Compute Medium $110 + ~$200 storage/egress = **~$900/mo total** (~1,50€/user/mo)
- **Phase 3 (1 500 abonnés)** : Team $599 + Compute Large $410 + ~$700 storage/egress = **~$1 700/mo total** (~1,13€/user/mo)

### Stripe fees

- SEPA Core : 0,35€ flat / paiement → ~0,35-0,50€/user/mo
- CB : 1,4% + 0,25€ → ~1-1,50€/user/mo
- **Blended (70% SEPA / 30% CB)** : ~0,65-0,80€/user/mo

### Brevo SMS (option ponctuelle 0,15€/SMS)

Coût KOVAS : 0,05€/SMS (marge ~0,10€/SMS sur utilisateur).
Phase 1 : ~50€ marge/mo si 10% des users activent SMS.

### Resend (emails)

- Free 100/jour → Pro $20/mo M3+
- ~0,20€/user/mo à 100 abonnés

### Autres (Sentry, PostHog, Cloudflare, Vercel)

- Sentry Team $26/mo (~0,30€/user à 100)
- PostHog Team $29/mo (~0,30€/user à 100)
- Cloudflare $0
- Vercel Pro $20/mo (~0,20€/user à 100)
- **Total** : ~$75/mo (~0,80€/user à 100, ~0,10€/user à 600)

---

## 3. Coûts fixes mensuels

| Phase | Période | Total mensuel |
|---|---|---|
| M0-M3 | Avant bêta | **~120€/mo** |
| M3-M6 | Bêta 40 users | **~300-350€/mo** |
| M6-M9 | Bêta → launch | **~500€/mo** |
| M9-M12 | 100 abonnés payants | **~900-1 100€/mo** |
| M12-M24 | 100→800 abonnés | **~1 500-3 500€/mo** |
| M24-M36 | 800→2 100 abonnés | **~5 000-12 000€/mo** |

Détail M9-M12 (~$1 000/mo) :
- Supabase Pro + PITR : 125$
- Vercel Pro : 20$
- Expo EAS Production : 29$
- Sentry Team : 26$
- PostHog Team : 29$
- Resend Pro : 20$
- Railway : 15$
- Anthropic API (variable) : ~200-400$
- OpenAI Whisper : ~50-100$
- Brevo SMS (à 50 abonnés activant) : ~30$
- Hiscox assurance prorata : 75$
- Google Workspace : 6$

---

## 4. Projections financières corrigées (basées sur MVP 6 features + pricing 4 tiers)

### M12 (140 abonnés)

| Métrique | Valeur |
|---|---|
| Mix tiers | 35% Découverte / 50% Standard / 15% Volume |
| ARPU moyen pondéré | **70€/mo** |
| MRR | **9 800€** |
| ARR | **117 600€** |
| Marge brute (77%) | ~90 600€/an |
| Coûts fixes | ~4 800€/an |
| **Marge nette annuelle** | **~85 800€** |

### M24 (800 abonnés)

| Métrique | Valeur |
|---|---|
| Mix tiers | 25% Découverte / 50% Standard / 20% Volume / 5% Cabinet Phase 2 |
| ARPU moyen pondéré | **80€/mo** (Cabinet Phase 2 commence à apparaître M16-M18) |
| MRR | **64 000€** |
| ARR | **768 000€** |
| Marge brute (77%) | ~591 000€/an |
| Coûts fixes | ~8 400€/an |
| **Marge nette annuelle** | **~582 600€** |

### M36 (2 100 abonnés, Phase 2 lancée à 50% de la base)

| Métrique | Valeur |
|---|---|
| Mix tiers | 15% Découverte / 35% Standard / 25% Volume / 15% Cabinet Phase 2 / 10% Phase 3 |
| ARPU moyen pondéré | **110€/mo** |
| MRR | **231 000€** |
| ARR | **2,77 M€** |
| Marge brute (77%) | ~2,15 M€/an |
| Coûts fixes | ~14 400€/an |
| **Marge nette annuelle** | **~2,13 M€** |

---

## 5. Comparaison vs projections initiales

| Horizon | PRD initial (59€/89€) | Pricing révisé (29€/59€/99€) |
|---|---|---|
| **M12 ARR** | 50-65k€ | **117k€** (+80% vs initial) |
| **M24 ARR** | 500-600k€ | **768k€** (+30%) |
| **M36 ARR** | 1,5-2 M€ | **2,77 M€** (+50%) |
| **M36 Marge nette** | ~900k€ | **2,13 M€** (+135%) |

**Driver principal de l'amélioration** : ARPU moyen pondéré plus élevé (75€ vs 59-89€) + marge brute plus haute (77% vs 60-65%) grâce au pricing à l'usage + MVP réduit.

---

## 6. CAC & LTV

### Impact Gain Tracker (V1.5, sprints 15-17 post-launch — Modification 19)

> **Document détaillé** : [`/docs/gain-tracker-system.md`](../../docs/gain-tracker-system.md)

Le système Gain Tracker (compteur permanent + rapport mensuel + statuts pros + partages LinkedIn) impacte directement les unit economics :

| KPI | Sans Gain Tracker | Avec Gain Tracker | Impact |
|---|---|---|---|
| **Churn mensuel** (régime stationnaire) | 6% | **< 4%** | **-33%** |
| **NPS** | 35 | **> 55** | **+57%** |
| **Coefficient viral K** | 1,2 | **1,5** | **+25%** |
| **LTV** (24 mois avg) | 1 800€ | **2 700€** | **+50%** |
| **LTV/CAC ratio** | 4,5 | **6,75** | **+50%** |
| **Payback period** | 5 mois | **3-4 mois** | **-40%** |

**Investissement** : 8 jours dev (sprints 15-17, ~0€ supplémentaire infra).
**ROI** : amorti dès M6 post-déploiement (effet churn).

### Projections révisées intégrant Gain Tracker (à valider M12 sur cohortes réelles)

| Horizon | M12 sans GT | M12 avec GT | M24 sans GT | M24 avec GT | M36 sans GT | M36 avec GT |
|---|---|---|---|---|---|---|
| Abonnés actifs | 140 | **170** (+21%) | 850 | **1 050** (+24%) | 2 200 | **2 800** (+27%) |
| ARPU moyen | 75€ | **75€** | 85€ | **85€** | 110€ | **110€** |
| ARR | 126 k€ | **153 k€** | 867 k€ | **1,07 M€** | 2,9 M€ | **3,70 M€** |
| Marge nette annuelle (80%) | 96 k€ | **117 k€** | 685 k€ | **846 k€** | 2,30 M€ | **2,94 M€** |

**Note** : projections "avec Gain Tracker" supposent que les cibles M12 (churn <4%, K=1,5) soient atteintes. Validation par cohortes A/B en septembre 2027 (M12 post-launch).

### CAC blended réaliste

| Canal | Coût/mo | Volume signups | CAC effectif |
|---|---|---|---|
| LinkedIn outreach automatisé | 60€/mo infra + 5h/sem temps | 40-60 essais | ~80€ (essai) |
| Contenu LinkedIn perso (4h/sem) | Temps valorisé 100€/h = 400€/mo | 10-20 essais | ~30€ (essai) |
| SEO blog (M6+, 5h/sem sur 3 mois) | Temps valorisé = 1 200€/mois × 3 mois amorti | 5-30 essais/mois M6+ | ~50€ (essai) |
| Parrainage (1 mois offert parrain + filleul) | ~30-60€/conversion | Variable | ~30-60€ (essai) |

**CAC essai blended** : ~80€
**CAC payant blended** : ~400€ (conversion 22-28%)

### LTV

- ARPU moyen Phase 1 : 75€/mo
- Churn mensuel cible : < 3% en régime stationnaire
- Durée de vie moyenne : ~24 mois (avec upgrade Phase 2)
- **LTV** : ~1 920€

### LTV/CAC ratio

| Métrique | Valeur |
|---|---|
| LTV / CAC | **4,8** (cible SaaS B2B > 3 ✓) |
| Payback period | **5 mois** |

---

## 7. Cash-flow projeté

### Hypothèse cohorte unique (sans growth post-M12)

| Mois | Abonnés cumulés | MRR | Coûts variables | Coûts fixes | Cash-flow net mensuel |
|---|---|---|---|---|---|
| M9 | 30 | 1 800€ | -360€ | -500€ | +940€ |
| M12 | 140 | 9 800€ | -2 300€ | -800€ | +6 700€ |
| M18 | 350 | 26 250€ | -6 000€ | -1 500€ | +18 750€ |
| M24 | 800 | 64 000€ | -14 700€ | -700€ | +48 600€ |

**Break-even cash-flow** : M9 (~30 abonnés payants).

### Sensibilité scénario pessimiste (-30% growth)

- M12 : 100 abonnés, MRR 7 000€, cash-flow net +4 800€/mo
- M24 : 560 abonnés, MRR 44 800€, cash-flow net +33 000€/mo
- **Toujours rentable cash-flow dès M9-M10** dans ce scénario

### Sensibilité scénario optimiste (+30% growth)

- M12 : 180 abonnés, MRR 12 600€, cash-flow net +9 000€/mo
- M24 : 1 040 abonnés, MRR 83 200€, cash-flow net +63 000€/mo

---

## 8. Sensibilité coûts variables

### Si Anthropic augmente prix +50%

| Profil | Marge brute actuelle | Marge brute +50% Anthropic |
|---|---|---|
| Découverte 29€ | 84% (41€) | 78% (38€) |
| Standard 59€ | 80% (65,50€) | 75% (61€) |
| Volume 99€ | 74% (73€) | 67% (66€) |

Impact ARR M36 : -200-300k€ (~7-10% baisse).

**Mitigations** :
- Switch modèles vers Haiku 4.5 (moins cher) sur tâches non-critiques
- Activation fallback OpenAI gpt-4o-mini ou Mistral Pixtral
- Prompt caching plus agressif (1h TTL systématique)
- Si nécessaire : hausse Phase 1 +10% (29→32€, 59→65€, 99→109€) pour maintenir marge

### Si churn passe à 5%/mo (vs 3% cible)

LTV réduit à 1 500€ → LTV/CAC ratio à 3,75 (toujours OK).

---

## 9. Budget setup pré-launch (M0-M9)

| Catégorie | Coût total |
|---|---|
| Comptes services payants M0-M9 | ~3 500€ |
| Hiscox RC Pro Cyber + extension PI | ~900€ (1ère année) |
| INPI dépôt marque KOVAS | ~300€ |
| Apple Developer | ~95€ |
| Google Play Developer | ~25€ (one-shot lifetime) |
| Achat licence Liciel 1 mois (fixtures) | ~150€ |
| Diagnostiqueurs partenaires fixtures (3 × 150€) | ~450€ |
| LinkedIn Premium Business M1-M9 | ~450€ |
| Hetzner Windows VM (conditionnel) | ~100€ (M5-M9 si nécessaire) |
| Avocat IP/Tech Vague 2 (M9+) | 0€ M0-M9 (différé M9-M18) |
| **Total budget setup M0-M9** | **~5 970€** |

**Hors cible PRD initial < 500€** (budget setup étendu vu la nature B2B + assurance + INPI obligatoires).

---

## 10. Objectifs financiers ajustés — RÉVISÉS Modification 18 (18/05)

| Horizon | Abonnés | ARPU | MRR | ARR | Marge brute (80%) | Marge nette annuelle |
|---|---|---|---|---|---|---|
| **M12** | 140 | 75€ | 10 500€ | **126 k€** | 100,8 k€ | **96 k€** |
| **M24** | 850 | 85€ | 72 250€ | **867 k€** | 693,6 k€ | **685 k€** |
| **M36** | 2 200 | 110€ | 242 000€ | **2,9 M€** | 2,32 M€ | **2,30 M€** |

### Projections antérieures (pour référence)

| Horizon | ARR antérieur | Marge nette antérieure |
|---|---|---|
| M12 | 117 k€ | 86 k€ |
| M24 | 768 k€ | 583 k€ |
| M36 | 2,77 M€ | 2,13 M€ |

**Gain Modification 18** : +9k€ M12 / +102k€ M24 / +170k€ M36 grâce marge 80% vs 77% (approche IA hybride).

**Objectif révisé** : **1 M€ ARR à M24** (vs PRD initial 500-600k€, ambition révisée à la hausse).

**Cible M36** : **2,5-3 M€ ARR** avec Phase 2 lancée et 50% de la base migrée.

---

## 11. Marge brute évolutive — stratégie d'autonomisation IA 36 mois

> **Document détaillé** : [`/docs/ai-autonomy-strategy.md`](../../docs/ai-autonomy-strategy.md)

La marge brute n'est PAS fixe à 77% — elle **augmente progressivement** sur 36 mois grâce à la stratégie d'autonomisation IA (réduction dépendance Claude/Whisper).

### 11.1 Trajectoire marge brute par phase

| Horizon | Marge brute moyenne | Driver principal |
|---|---|---|
| **M12** | **77%** | APIs externes 100% (Claude Sonnet 4.6 + Whisper) |
| **M18** | **80%** | Optimisations Anthropic (prompt caching 1h TTL, hybride Sonnet/Haiku, Batch API, test Deepgram) |
| **M24** | **82%** | Whisper self-hosted GPU cloud + Vision IA custom YOLO on-device |
| **M36** | **85%+** | Modèle français propriétaire (Llama 3.3 70B fine-tuné sur 100k+ missions) |

### 11.2 Impact économique cumulé

| Période | Coût IA moyen / abonné / mo | Marge brute moyenne |
|---|---|---|
| M0-M12 (Phase 1) | ~4€/abonné | 77% |
| M12-M18 (Phase 2) | ~2,8€/abonné (-30%) | 80% |
| M18-M24 (Phase 3) | ~1,8€/abonné (-55%) | 82% |
| M24-M36 (Phase 4) | ~0,8€/abonné (-80%) | 85%+ |

### 11.3 Recalibrage projection M36 avec marge évolutive

| Métrique | Valeur révisée |
|---|---|
| ARR M36 | 2,77 M€ |
| Marge brute M36 (85%) | **~2,35 M€/an** (vs 2,13 M€ à 77%) |
| Coûts fixes M36 | ~14 400€/an |
| **Marge nette annuelle M36** | **~2,33 M€** (vs 2,13 M€ initial) |

**Gain marge nette M36 grâce à l'autonomisation IA** : **+200k€/an** (vs scénario sans autonomisation).

### 11.4 Investissement total stratégie autonomisation (36 mois)

| Phase | Investissement |
|---|---|
| Phase 2 (M12-M18) | ~0€ (config + dev interne) |
| Phase 3 (M18-M24) | 20-30 k€ (GPU + dataset + dev pipeline) |
| Phase 4 (M24-M36) | 40-80 k€ (ingénieur ML + compute + cleaning) |
| **Total 36 mois** | **60-110 k€** |

**ROI** : amorti en 6-9 mois post-déploiement Phase 3, durablement positif à partir de M22.

### 11.5 Pièges identifiés

- ⚠️ **Souveraineté technologique prématurée** : n'internaliser que quand 1000+ abonnés payants ET 500 000+ requêtes accumulées
- ⚠️ **Sous-estimation coût maintenance** : self-hosting Whisper = 5-10h/sem en coût opportunité (~2-4k€/mo)
- ⚠️ **Qualité non garantie** : Llama 3.3 70B = 20-30% en deçà de Claude Sonnet 4.6 sans fine-tune métier

Détails complets : [`/docs/ai-autonomy-strategy.md`](../../docs/ai-autonomy-strategy.md) §7.
