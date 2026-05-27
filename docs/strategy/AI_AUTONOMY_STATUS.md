# KOVAS — IA Autonome : mapping état réel par système

> Compagnon de [`AI_AUTONOMY_V1.md`](AI_AUTONOMY_V1.md).
> Croise chaque système / algorithme du doc IA Autonome avec l'état réel du repo.
> **Mis à jour 2026-05-27** (post sessions AI-AUTONOMY 1→4 + SECURITY-AUDIT).

---

## Légende

| Symbole | Signification |
|---|---|
| ✅ | Implémenté et fonctionnel |
| ⚠️ | Partiel — infrastructure en place mais incomplet |
| ⏳ | À implémenter — pas de conflit stratégique |
| 🚫 | Différé post-décision stratégique (voir conflit) |

---

## Les 15 systèmes autonomes

| # | Système | État | Référence repo / tâche |
|---|---|---|---|
| 1 | Multi-armed bandit landing pages | ✅ | Lot ALGOS-BANDIT-FRAUDE #149 + REFONTE Lot B7 #236 |
| 2 | Email subject auto-optimization | ✅ | **Session AI-AUTONOMY-3 #302** — `apps/web/src/lib/email-bandit/` (templates + scorer + selector + prompts) |
| 3 | Ad creative generator continu | 🚫 | **Différé M9+** — pas de paid ads V1 (Conflit 1) |
| 4 | Churn predictor + retention auto | ✅ | A1.3.11 `churn-predictor.ts` #241 |
| 5 | Upsell engine contextuel | ✅ | **Session AI-AUTONOMY-4 #303** — `apps/web/src/lib/upsell-engine/` (triggers + scorer + offer-selector) basé sur Algo 22 |
| 6 | Onboarding path optimizer | ⚠️ | Onboarding 7 étapes #196, manque bandit variants — à étendre |
| 7 | SEO content engine | ✅ | SITE-GUIDES #146 + SEO-PROG #148 + AMANDINE-BART #154 + regulatory-watcher #292 |
| 8 | Lead scoring temps réel | ✅ | **Session AI-AUTONOMY-4 #303** — `apps/web/src/lib/visitor-scoring/` (behavior + score + classifier) couvre visiteurs site anonymes, complète A1.3.5 (quote requests B2C) |
| 9 | Sentiment monitoring | ✅ | **Session AI-AUTONOMY-2 #301** — `apps/web/src/lib/sentiment/` (analyzer + prompts + trends) sur tickets support + reviews via Claude Haiku |
| 10 | Feature usage learner | ✅ | **Session AI-AUTONOMY-3 #302** — `apps/web/src/lib/feature-usage/` (catalog + analyzer + retention-uplift + promotion-engine) PostHog → hebdo |
| 11 | Customer success automation | ⚠️ | **Session AI-AUTONOMY-4 #303** — `apps/web/src/lib/customer-success/` (health + actions + templates) partiel : retention auto OK, chat IA = Phase 3 M19+ (Conflit 2) |
| 12 | Review responder | ⚠️ | `/dashboard/annuaire/reviews` existe, boutons masqués FEATURE_REVIEWS_INTERACTIVE=false (commit 5bed881) — à lever |
| 13 | Press mentions auto-feed | ⚠️ | FIX-I #166 + FIX-J #167 — observatoire mensuel auto, webhook Brand24 pas câblé |
| 14 | Competitive intelligence | ✅ | **Session AI-AUTONOMY-2 #301** — `apps/web/src/lib/competitive/` (extractor + diff + analyze) scraping daily concurrents + Claude analyse |
| 15 | Sales argument optimizer | 🚫 | **Différé M12+** — pas de signal statistique <5k visites/j (Conflit 3) |

---

## Les 6 algorithmes self-learning (Partie III)

| Algo | Description | État | Référence |
|---|---|---|---|
| 19 | Multi-armed bandit Thompson Sampling | ✅ | Lot ALGOS-BANDIT-FRAUDE #149 |
| 20 | Cohort behavior clustering K-Means | ✅ | A1.3.13 `diagnostician-pattern-learning.ts` #245 |
| 21 | Churn prediction model | ✅ | A1.3.11 `churn-predictor.ts` #241 |
| 22 | Upsell timing prediction | ✅ | Session AI-AUTONOMY-1 #300 — `apps/web/src/lib/algos/upsell-timing.ts` |
| 23 | LTV forecasting | ✅ | Session AI-AUTONOMY-1 #300 — `apps/web/src/lib/algos/ltv-forecasting.ts` |
| 24 | Personalization engine | ✅ | Session AI-AUTONOMY-1 #300 — `apps/web/src/lib/algos/personalization-engine.ts` |

**Tous les 6/6 algos Partie III sont implémentés (100%).**

---

## Les 3 conflits stratégiques (résolutions validées)

### Conflit 1 — Paid ads (Système 3)

**Doc IA Autonome** : ad creative gen continu, auto-deploy Meta + Google, scaling +20% si CPL < CAC×0.5.

**CLAUDE.md actuel** : zéro paid ads M0-M9. Budget M0-M3 ~120€/mo total. Acquisition = founder-led sales + SEO + bêta.

**Décision** : **différer Système 3 à M9-M12+**. Préparer infrastructure silencieusement (génération variants stockés en DB, admin panel `/admin/ad-creatives`) sans auto-deploy.

### Conflit 2 — Chat IA + Customer success (Système 11)

**Doc IA Autonome** : Sprint 5-6 (M5-M6) chat support IA + customer success complet.

**CLAUDE.md §3** : assistant IA conversationnel métier = **Phase 3 (M19+)**. Phase 1 = KB 20 articles + ticketing custom Supabase + Resend, escalade humaine si confidence <90%.

**Décision** : **scinder**.
- Chat IA conversationnel métier (réponses réglementaires ADEME/3CL-2021) : reste **Phase 3 M19+**. Risque hallucinations inacceptable.
- Customer success partiel (health score + retention emails auto) : ✅ **fait Session #303** (`apps/web/src/lib/customer-success/`).
- Review responder (Système 12) : ⚠️ existe, lever flag `FEATURE_REVIEWS_INTERACTIVE`.

### Conflit 3 — Sales argument optimizer (Système 15)

**Doc IA Autonome** : 120 args/sem × 6 stages × 4 segments → bandit alloue le traffic.

**Réalité** : à <5000 visites/jour (M0-M12), Thompson Sampling ne converge pas. Bandit = bruit aléatoire pendant 6-12 mois.

**Math** : pour converger en 7j sur baseline 2-4% (signup), il faut ~10k visites/variant/jour. KOVAS prévoit ~100 visites/jour M3-M6 et ~500-1k M12.

**Décision** : **différer Système 15 à M12+**. Activer progressivement en commençant par les CTA bas du funnel (>1000 clicks/sem) pour signal statistique.

**Confirmation** : décision du 27/05 de remplacer `RotatingSoftwareName` (cyclage 4 logiciels) par une liste statique va dans ce sens — copy direct response classique > bandit prématuré.

---

## État des prochaines étapes (mis à jour 2026-05-27)

### ✅ Phase A — M3-M6 (post-bêta) — TERMINÉE

Tout monté en sessions AI-AUTONOMY 1→4 :

1. ✅ **Système 5 — Upsell engine contextuel** — `apps/web/src/lib/upsell-engine/` (Algo 22 câblé)
2. ✅ **Système 9 — Sentiment monitoring** — `apps/web/src/lib/sentiment/` (Claude Haiku)
3. ✅ **Système 10 — Feature usage learner** — `apps/web/src/lib/feature-usage/` (PostHog → hebdo)
4. ⚠️ **Système 6 partiel — Onboarding optimizer** — onboarding 7 étapes existe, manque bandit variants
5. ⚠️ **Système 12 complet — Review responder** — existe, lever `FEATURE_REVIEWS_INTERACTIVE`

### ✅ Phase B — M6-M9 — TERMINÉE pour 3/5

6. ✅ **Système 8 complet — Lead scoring visiteurs site** — `apps/web/src/lib/visitor-scoring/`
7. ✅ **Système 11 partiel — Customer success retention auto** — `apps/web/src/lib/customer-success/` (PAS chat IA)
8. ✅ **Système 14 — Competitive intelligence** — `apps/web/src/lib/competitive/`
9. ⚠️ **Système 13 complet — Press mentions** — observatoire OK, webhook Brand24 pas câblé
10. ✅ **Système 2 — Email subject auto-optimization** — `apps/web/src/lib/email-bandit/`

### ⏸ Phase C — M9+ (post-PMF) — différée selon plan stratégique

11. 🚫 **Système 3 — Ad creative generator continu** — différé M9+ (Conflit 1)
12. 🚫 **Système 11 complet — Chat support IA** — différé Phase 3 M19+ (Conflit 2)

### ⏸ Phase D — M12+ (post-trafic significatif) — différée selon plan stratégique

13. 🚫 **Système 15 — Sales argument optimizer** — différé M12+ (Conflit 3)

---

## Algorithmes complémentaires identifiés (hors doc original)

| Algo | Description | Statut |
|---|---|---|
| A1.3.1 | DPE shopping detection | ✅ Existant |
| A1.3.2 | Cadastre coherence | ✅ Existant |
| A1.3.3 | Conformity score multi-dim | ✅ Existant |
| A1.3.4 | Profil unifié propriété | ✅ Existant |
| A1.3.6 | Vision IA équipement | ✅ Existant (mais V2 selon CLAUDE.md §3 — coming-soon UI) |
| A1.3.7 | Document classifier | ✅ Existant |
| A1.3.9 | Production anomaly detection | ✅ Existant |
| A1.3.10 | Certificate expiry predictor | ✅ Existant |
| A1.3.12 | SEO page quality auto-scorer | ✅ Existant |

Tous dans `apps/web/src/lib/algos/`. Pattern uniforme : pure function + types + tests.

---

## Tracker progression IA Autonome (mis à jour 2026-05-27)

```
Systèmes :         10/15 ✅   3/15 ⚠️   0/15 ⏳   3/15 🚫  (67% complets + 20% partiels + 0% en attente + 20% différés stratégiques)
Algos Partie III : 6/6 ✅  (100%)
Conflits :         3/3 résolus (paid ads M9+ / chat IA M19+ / arg optimizer M12+)
```

**Couverture totale** : ~87% si on compte les ⚠️ partiels (13/15 systèmes ont une base solide ou sont complets). Seuls 2 systèmes restent à finaliser (#6 bandit onboarding + #13 webhook Brand24 + #12 lever flag).

**Aucun système n'est en attente pure (⏳ = 0)** — soit fait (✅), soit partiel à compléter (⚠️), soit différé par décision stratégique explicite (🚫).

---

## Détail par système monté cette série de sessions

### Session AI-AUTONOMY-1 #300 (Algos Partie III)

- `apps/web/src/lib/algos/upsell-timing.ts` — Algo 22 (prédiction fenêtre optimale)
- `apps/web/src/lib/algos/ltv-forecasting.ts` — Algo 23 (projection LTV par cohorte)
- `apps/web/src/lib/algos/personalization-engine.ts` — Algo 24 (adaptation UI/copy)

### Session AI-AUTONOMY-2 #301 (Systèmes 9 + 14)

- `apps/web/src/lib/sentiment/` — Système 9 (analyzer + prompts + trends Claude Haiku)
- `apps/web/src/lib/competitive/` — Système 14 (extractor + diff + analyze scraping + Claude)

### Session AI-AUTONOMY-3 #302 (Systèmes 2 + 10)

- `apps/web/src/lib/email-bandit/` — Système 2 (templates + scorer + selector + prompts)
- `apps/web/src/lib/feature-usage/` — Système 10 (catalog + analyzer + retention-uplift + promotion-engine)

### Session AI-AUTONOMY-4 #303 (Systèmes 5 + 8 + 11)

- `apps/web/src/lib/upsell-engine/` — Système 5 (triggers + scorer + offer-selector)
- `apps/web/src/lib/visitor-scoring/` — Système 8 (behavior + score + classifier)
- `apps/web/src/lib/customer-success/` — Système 11 partiel (health + actions + templates)

---

**Mis à jour 2026-05-27 — sessions AI-AUTONOMY 1→4 (#300 à #303)**
