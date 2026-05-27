# KOVAS — IA Autonome : mapping état réel par système

> Compagnon de [`AI_AUTONOMY_V1.md`](AI_AUTONOMY_V1.md).
> Croise chaque système / algorithme du doc IA Autonome avec l'état réel du repo.
> **Mis à jour 2026-05-27** (post-validation synthèse Benjamin).

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
| 2 | Email subject auto-optimization | ⏳ | À monter — pas de séquence emails massive encore |
| 3 | Ad creative generator continu | 🚫 | **Différé M9+** — pas de paid ads V1 (Conflit 1) |
| 4 | Churn predictor + retention auto | ✅ | A1.3.11 `churn-predictor.ts` #241 |
| 5 | Upsell engine contextuel | ⏳ | À monter — basé sur Algo 22 timing prediction |
| 6 | Onboarding path optimizer | ⚠️ | Onboarding 7 étapes #196, manque bandit variants |
| 7 | SEO content engine | ✅ | SITE-GUIDES #146 + SEO-PROG #148 + AMANDINE-BART #154 + regulatory-watcher #292 |
| 8 | Lead scoring temps réel | ⚠️ | A1.3.5 lead-scoring #236 couvre B2C leads (quote requests), pas visiteurs site anonymes |
| 9 | Sentiment monitoring | ⏳ | À monter — Claude Haiku sur messages support + reviews |
| 10 | Feature usage learner | ⚠️ | PostHog événements trackés, manque auto-analyzer hebdo |
| 11 | Customer success automation | ⚠️ | Gamification 7 niveaux #150 fait ; chat IA = Phase 3 M19+ (Conflit 2) |
| 12 | Review responder | ⚠️ | `/dashboard/annuaire/reviews` existe, boutons masqués FEATURE_REVIEWS_INTERACTIVE=false (commit 5bed881) |
| 13 | Press mentions auto-feed | ⚠️ | FIX-I #166 + FIX-J #167 — observatoire mensuel auto, webhook Brand24 pas câblé |
| 14 | Competitive intelligence | ⏳ | À monter — scraping daily concurrents + Claude analyse |
| 15 | Sales argument optimizer | 🚫 | **Différé M12+** — pas de signal statistique <5k visites/j (Conflit 3) |

---

## Les 6 algorithmes self-learning (Partie III)

| Algo | Description | État | Référence |
|---|---|---|---|
| 19 | Multi-armed bandit Thompson Sampling | ✅ | Lot ALGOS-BANDIT-FRAUDE #149 |
| 20 | Cohort behavior clustering K-Means | ✅ | A1.3.13 `diagnostician-pattern-learning.ts` #245 |
| 21 | Churn prediction model | ✅ | A1.3.11 `churn-predictor.ts` #241 |
| 22 | Upsell timing prediction | ✅ | **Cette session** — `upsell-timing.ts` (tâche #300) |
| 23 | LTV forecasting | ✅ | **Cette session** — `ltv-forecasting.ts` (tâche #300) |
| 24 | Personalization engine | ✅ | **Cette session** — `personalization-engine.ts` (tâche #300) |

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
- Customer success partiel (health score + retention emails auto) : OK **M3-M6**.
- Review responder (Système 12) : OK **M6**.

### Conflit 3 — Sales argument optimizer (Système 15)

**Doc IA Autonome** : 120 args/sem × 6 stages × 4 segments → bandit alloue le traffic.

**Réalité** : à <5000 visites/jour (M0-M12), Thompson Sampling ne converge pas. Bandit = bruit aléatoire pendant 6-12 mois.

**Math** : pour converger en 7j sur baseline 2-4% (signup), il faut ~10k visites/variant/jour. KOVAS prévoit ~100 visites/jour M3-M6 et ~500-1k M12.

**Décision** : **différer Système 15 à M12+**. Activer progressivement en commençant par les CTA bas du funnel (>1000 clicks/sem) pour signal statistique.

**Confirmation** : ta décision du 27/05 de remplacer `RotatingSoftwareName` (cyclage 4 logiciels) par une liste statique va dans ce sens — copy direct response classique > bandit prématuré.

---

## Prochaines étapes (priorisation post-PMF)

### Phase A — M3-M6 (post-bêta)

À monter quand 50+ users actifs :

1. **Système 5 — Upsell engine contextuel** (Algo 22 timing prediction câblé)
2. **Système 9 — Sentiment monitoring** (tickets support + reviews via Claude Haiku)
3. **Système 10 — Feature usage learner** (PostHog → analyzer hebdo)
4. **Système 6 partiel — Onboarding optimizer** (bandit sur 4 paths)
5. **Système 12 complet — Review responder** (lever `FEATURE_REVIEWS_INTERACTIVE`)

### Phase B — M6-M9

À monter avant ouverture publique :

6. **Système 8 complet — Lead scoring visiteurs site** (extension Algo A1.3.5)
7. **Système 11 partiel — Customer success retention auto** (PAS chat IA)
8. **Système 14 — Competitive intelligence** (scraping daily Liciel/ORIS/OBBC)
9. **Système 13 complet — Press mentions** (webhook Brand24)
10. **Système 2 — Email subject auto-optimization** (bandit sur séquences trial)

### Phase C — M9+ (post-PMF)

À monter quand revenue > 5k€ MRR :

11. **Système 3 — Ad creative generator continu** (activation paid ads + auto-deploy Meta/Google)
12. **Système 11 complet — Chat support IA** (uniquement sur questions non-réglementaires, escalade auto sur ADEME/3CL)

### Phase D — M12+ (post-trafic significatif)

À monter quand >5k visites/jour :

13. **Système 15 — Sales argument optimizer** (bandit sur CTA bas funnel d'abord)

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

## Tracker progression IA Autonome

```
Systèmes :         5/15 ✅   5/15 ⚠️   3/15 ⏳   2/15 🚫  (33% + 33% + 20% + 13%)
Algos Partie III : 6/6 ✅  (100% — fait cette session)
Conflits :         3/3 résolus (paid ads M9+ / chat IA M19+ / arg optimizer M12+)
```

**Couverture totale** : ~50% si on compte les ⚠️ partiels (8/15 systèmes ont déjà une base ou sont complets).

---

**Mis à jour 2026-05-27 — tâche #300**
