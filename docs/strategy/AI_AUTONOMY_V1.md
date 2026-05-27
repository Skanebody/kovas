# KOVAS — IA Autonome et Systèmes Self-Learning

> **Version 1.0 — 26 mai 2026** · partagée par Benjamin · synthèse validée 27 mai 2026
> Cible : transformer KOVAS en SaaS auto-piloté à 95% post-PMF.
> Document de référence interne, à challenger avant chaque implémentation.
> **Doc complet original** : transcript chat 27/05/2026 (Benjamin → Claude Code).
> **Status mapping** : [`AI_AUTONOMY_STATUS.md`](AI_AUTONOMY_STATUS.md)

---

## Préambule honnête

Aucun SaaS B2B n'est 100% autonome (Anthropic, OpenAI, Doctolib). KOVAS peut viser **95%+ d'autonomie**. Les 5% restants requièrent Benjamin :

- Décisions stratégiques majeures (pricing pivot, acqui-target)
- Validation contenu sensible (réponses ADEME, litiges)
- Relations humaines clés (partenaires, presse Tier 1)
- Override IA quand l'algorithme se trompe

---

## Architecture en 5 couches

```
┌─ COUCHE 5 — Decision     → Benjamin uniquement (stratégie)
├─ COUCHE 4 — Validation   → Benjamin 15-30 min/jour (contenu sensible)
├─ COUCHE 3 — Self-learning → Bandits + ML + optimisation continue
├─ COUCHE 2 — Generation   → Claude Haiku + Sonnet (contenu, copy)
└─ COUCHE 1 — Tracking     → PostHog + Supabase (events, metrics)
```

---

## Les 15 systèmes autonomes

| # | Système | Action |
|---|---|---|
| 1 | Multi-armed bandit landing pages | Thompson Sampling sur hero, CTA, pricing |
| 2 | Email subject auto-optimization | Bandit sur subjects + génération continue via Claude |
| 3 | Ad creative generator continu | 10 ads/sem Claude → Meta + Google + scaling auto |
| 4 | Churn predictor + retention auto | Score 0-100 → triggers retention 3 niveaux |
| 5 | Upsell engine contextuel | Détection moments optimaux + auto-envoi offer |
| 6 | Onboarding path optimizer | Bandit sur 4 paths (quick/guided/done-with-you/quiz) |
| 7 | SEO content engine | 3 articles/sem auto-publish + internal linking |
| 8 | Lead scoring temps réel | Score visiteurs site → messaging dynamique |
| 9 | Sentiment monitoring | Claude Haiku sur tous messages (support, reviews, surveys) |
| 10 | Feature usage learner | Auto-kill features dead, auto-promote sous-utilisées |
| 11 | Customer success automation | Health score + auto-actions par tier |
| 12 | Review responder | Auto-publish 5⭐, brouillon 4⭐ (24h), validation ≤3⭐ |
| 13 | Press mentions auto-feed | Brand24 webhook → classification tier 1/2/3 |
| 14 | Competitive intelligence | Scraping concurrents quotidien + Claude analyse changements |
| 15 | Sales argument optimizer | 120 args/sem × 6 stages × 4 segments → bandit |

---

## Les 6 algorithmes self-learning (Partie III)

| Algo | Description | État |
|---|---|---|
| 19 | Multi-armed bandit (Thompson Sampling) | ✅ Fait — `bandit-fraude` |
| 20 | Cohort behavior clustering (K-Means K=5) | ✅ Fait — `diagnostician-pattern-learning.ts` |
| 21 | Churn prediction model (rules-based Y1, ML Y2+) | ✅ Fait — `churn-predictor.ts` |
| 22 | Upsell timing prediction | ⏳ À monter |
| 23 | LTV forecasting (à signup) | ⏳ À monter |
| 24 | Personalization engine (UI par cluster + health) | ⏳ À monter |

---

## Les 7 leviers MRR auto-optimisés (Partie IV)

| Levier | Système | Impact |
|---|---|---|
| Acquisition | Système 1 + 3 (bandit landing + ad gen) | CAC quality |
| Activation | Système 6 (onboarding optimizer) | Trial → paid |
| Conversion | Système 15 (sales argument) | Visitor → trial |
| Expansion | Système 5 (upsell engine) | ARPU |
| Retention | Système 4 (churn predictor + auto-retention) | M3, M6, M12 |
| Resurrection | Re-engagement engine | Winback |
| Referral | Referral campaign auto | Coefficient viral |

---

## Architecture zero-cost

| Service | Coût | Usage |
|---|---|---|
| Claude API (Haiku + Sonnet) | ~93€/mo @ 230 users | IA génération + reasoning |
| Supabase Pro | 25€/mo | DB + Edge Functions + Realtime |
| Vercel | 0€ Y1 | Hosting + Edge Cron |
| PostHog Cloud | 0€ (1M events free) | Analytics + Feature Flags |
| Brevo | 0€ (300/jour free) | Email + SMS |

**Total infra IA : ~118€/mo Y1.**

---

## Roadmap 24 semaines (Claude Code)

- **Sprint 1-2 (Foundations)** : tracking PostHog + bandits + lead scoring + sentiment monitoring
- **Sprint 3-4 (Generation)** : email subjects + ad creatives + SEO + arguments + reviews
- **Sprint 5-6 (Intelligence)** : churn + upsell + onboarding + feature usage + customer success + competitive intel + press

---

## Les 5% non-automatisables

| Catégorie | Exemples |
|---|---|
| Décisions stratégiques | Pivot pricing, acqui-target, levée, embauche |
| Relations humaines clés | Presse Tier 1, investisseurs, partenaires stratégiques, 50 premiers diags |
| Validation contenu sensible | Litiges ADEME, reviews ≤3⭐, communications presse, pricing dynamique |
| Override IA | Edge cases, hallucinations Claude, bugs |
| Vision long-terme | Roadmap 2+ ans, marchés européens Y3+, évolution business model |

**Temps Benjamin estimé : ~25h/mois** (30 min/jour validation + 2h/sem relations + 1 journée/mois stratégie).

---

## Fail-safes obligatoires

- **Kill switch global** : table `admin_settings.ai_systems_enabled` (boolean)
- **Confidence thresholds** : action IA escaladée si score <70%
- **Approval queue** : toute action >100€ impact (refund, discount) requiert Benjamin
- **Audit log complet** : toutes actions IA loggées, rollback possible

---

## Décisions stratégiques validées le 2026-05-27

Voir [`AI_AUTONOMY_STATUS.md`](AI_AUTONOMY_STATUS.md) pour le détail.

### Conflit 1 — Paid ads (Système 3) : DIFFÉRÉ M9+
Stratégie CLAUDE.md M0-M9 = zéro paid ads (LinkedIn outreach + SEO + bêta). Le système 3 (ad creative generator continu) est différé post-PMF. Infrastructure préparée silencieusement en M3-M6 (génération variants stockés en DB) pour activation immédiate à M9.

### Conflit 2 — Chat IA + Customer success (Système 11) : SCINDÉ
- **Chat IA conversationnel métier** : reste Phase 3 (M19+) — risque hallucinations réglementaires ADEME/3CL-2021 inacceptable Phase 1
- **Customer success automation partiel** (health score + auto-triggers retention emails) : OK dès M3-M6
- **Review responder** (Système 12) : OK M6, déjà partiellement câblé

### Conflit 3 — Sales argument optimizer (Système 15) : DIFFÉRÉ M12+
À <5000 visites/jour, le bandit ne converge pas (math : ~10k visites/variant/jour requises pour 7j convergence sur baseline 2-4%). Activation progressive M12-M18+ en commençant par les CTA bas du funnel.

---

## Implémentations cette session (2026-05-27)

- ✅ Sauvegarde doc + status mapping (`AI_AUTONOMY_V1.md` + `AI_AUTONOMY_STATUS.md`)
- ✅ Algo 22 — Upsell timing prediction (`lib/algos/upsell-timing.ts`)
- ✅ Algo 23 — LTV forecasting (`lib/algos/ltv-forecasting.ts`)
- ✅ Algo 24 — Personalization engine (`lib/algos/personalization-engine.ts`)

Voir tâche #300 pour le détail.

---

## Référence technique

- Pattern algos : `apps/web/src/lib/algos/*.ts` (pure functions, déterministe, zéro IO, tests Vitest)
- Bandit Thompson Sampling : `apps/web/src/lib/bandit/*` (à étendre depuis annuaire)
- Edge Functions cron : `supabase/functions/*` (Deno + pg_cron daily)
- Tracking : PostHog client-side + server-side via `lib/analytics/*`

---

**Fin du doc — version condensée v1.0 — 27 mai 2026**
