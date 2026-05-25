# Refonte Acqui-Target — Progrès (branche `refonte-acqui-target-2026-05`)

> Document de suivi exhaustif de la refonte stratégique de mai 2026, mise à jour à chaque lot livré. Source : commits sur la branche `refonte-acqui-target-2026-05`.
>
> **Authority** : `docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md` (spec condensée) + `docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2-FULL.md` (spec exhaustive).

## Vue d'ensemble

- **Branche** : `refonte-acqui-target-2026-05`
- **Base** : `main` (Phase 0 le 2026-05-25)
- **Stratégie** : repositionnement KOVAS 360 → acqui-target Enersweet (Liciel) 5-10 M€ sur 24 mois
- **Typecheck** : 0 erreur en permanence sur la branche
- **Tests Vitest** : 41 tests pure-fn + rate-limit
- **Tests E2E Playwright** : 10 tests API publique + observatoire

## Algorithmes A1.3.* — 12 / 13 livrés

| ID | Algo | Status | Commit | Fichier |
|---|---|---|---|---|
| A1.3.1 | DPE shopping detection | ✅ | `3cda1b5` | `lib/algos/dpe-shopping.ts` |
| A1.3.2 | Cohérence cadastre vs surface | ✅ | `3cda1b5` | `lib/algos/cadastre-coherence.ts` |
| A1.3.3 | Score conformité multi-dimensionnel | ✅ | `3cda1b5` | `lib/algos/conformity-score.ts` |
| A1.3.4 | Profil unifié propriété | ✅ | `4f73c0f` | `lib/property/unified-profile.ts` + `build-profile.ts` |
| A1.3.5 | Lead scoring + Thompson sampling | ✅ | `1f91d68` | `lib/algos/lead-scoring.ts` |
| A1.3.6 | Vision IA classification équipement | ✅ | `a39ddad` | `lib/algos/vision-equipment.ts` |
| A1.3.7 | Document classifier client uploads | ✅ | `d3a8d7d` | `lib/algos/document-classifier.ts` |
| A1.3.8 | Annuaire sync DHUP/SIRENE/COFRAC | ⏳ | — | (Edge Function `verify-diagnosticians-daily` existante) |
| A1.3.9 | Production anomaly detection DPE | ✅ | `233aef9` | `lib/algos/production-anomaly.ts` |
| A1.3.10 | Certificate expiry predictor | ✅ | `97ea7c3` | `lib/algos/expiry-predictor.ts` |
| A1.3.11 | Churn risk predictor | ✅ | `9ea3021` | `lib/algos/churn-predictor.ts` |
| A1.3.12 | SEO page quality auto-scorer | ✅ | `19124aa` | `lib/algos/seo-quality-scorer.ts` |
| A1.3.13 | Conformity pattern learning per diag | ✅ | `4dd13e1` | `lib/algos/diagnostician-pattern-learning.ts` |

## Game Changers UI — 4 / 6 livrés directement + 1 partiel

| GC | Nom | Status | Commit | Surface |
|---|---|---|---|---|
| GC1 | Pre-export AI conformity panel | ✅ | `b8f45b2` | `PrevalidationPanel` + `/api/missions/[id]/prevalidation-score` |
| GC2 | Mission flow continu | ⏳ | — | À démarrer |
| GC3 | Annuaire B2C enrichi | 🟡 | `1f91d68` + `b1e357c` + `20937ae` | A1.3.5 livré, admin queue branchée, fiche enrichie à compléter |
| GC4 | État de la profession publique | ✅ | `c99acf4` | `/observatoire/etat-profession` + vues SQL + endpoint API public |
| GC5 | Communiqués presse automatisés | ✅ | `e8b627f` | Edge Function Claude Sonnet + `/admin/press` + `/presse` enrichi |
| GC6 | Cockpit fraude DPE diagnostiqueur-facing | ✅ | `58f4dec` | `/dashboard/cockpit-fraude` + endpoint dpe-shopping-check |

## API publique V1 LIVE — 3 endpoints + OpenAPI + rate-limit

| Endpoint | Description | Commit |
|---|---|---|
| `GET /api/public/v1/property/{banId}` | Profil unifié propriété (BAN + IGN + DVF + ADEME + Géorisques) | `4f73c0f` |
| `GET /api/public/v1/observatoire/profession` | État de la profession diagnostic FR | `4e485b6` |
| `GET /api/public/v1/commune/{inseeCode}` | Stats DPE + DVF agrégées par commune | `39857a3` |
| `GET /api/public/v1/openapi.json` | Spec OpenAPI 3.1 complète | `4e485b6` + `39857a3` |
| `lib/api-public/rate-limit.ts` | Cascade Upstash → in-memory, 60/600 req/min | `4e485b6` |
| `/pros/api` (page publique) | Surface les 3 endpoints LIVE + CTA OpenAPI | `37633cd` + `39857a3` |

## Data lake — schemas + ingesters

| Composant | Status | Commit |
|---|---|---|
| Migration `data` + `analytics` + `internal` schemas | ✅ | `0514736` |
| 9 tables `data.*` (properties_unified, dvf_mutations, ademe_dpe, etc.) | ✅ | `0514736` |
| 2 matviews `analytics.*` (passoires_thermiques, transactions_history) | ✅ | `0514736` + `a39ddad` |
| RPC PostGIS `diagnosticians_within_radius` | ✅ | `0514736` |
| Edge Function `ingest-ademe-dpe-daily` | ✅ | `3cda1b5` |
| Edge Function `ingest-dvf-quarterly` | ✅ | `a39ddad` |
| Edge Function `refresh-data-lake-matviews` | ✅ | `a39ddad` |
| Ingester BAN cache | ⏳ | (auto-cache via `properties_unified` 7 j) |
| Ingester IGN cadastre cache | ⏳ | (auto-cache via `properties_unified` 7 j) |
| Ingester Géorisques cache | ⏳ | (auto-cache via `properties_unified` 7 j) |

## Admin pages neuves

| Route | Description | Commit |
|---|---|---|
| `/admin/press` | Console presse (KPI + actions generate/approve/dispatch/archive) | `e8b627f` |
| `/admin/renewals` | Cockpit renouvellements COFRAC + RC Pro (A1.3.10) | `97ea7c3` |
| `/admin/churn` | Cockpit risque churn 7 signaux pondérés (A1.3.11) | `9ea3021` |
| `/admin/leads/[id]` | Détail lead avec breakdown intent A1.3.5 | `20937ae` |
| `/admin/leads/queue` | Colonne Intent + filtre bucket | `b1e357c` |
| Sidebar | Groupe Rétention (3 entrées) | `2fc4436` |

## Pages publiques

| Route | Description | Commit |
|---|---|---|
| `/presse` | Compteur mentions + communiqués dynamiques + jalons historiques + médias secteur | `e8b627f` |
| `/observatoire/etat-profession` | KPI 3 chiffres + distribution + top départements + méthodologie | `c99acf4` |
| `/pros/api` | Section LIVE V1 (3 endpoints) + section V2 roadmap | `37633cd` + `39857a3` |
| `/dashboard/cockpit-fraude` | Liste DPE missions + détection shopping per row | `58f4dec` |

## Migrations Supabase à appliquer

L'ordre chronologique est respecté — appliquer dans l'ordre alphabétique des fichiers.

| Migration | Description |
|---|---|
| `20260525170000_data_lake_schemas.sql` | Schemas data/analytics/internal + 9 tables + 2 matviews + RPC PostGIS |
| `20260525210000_press_kit_releases.sql` | press_contacts + press_releases + press_release_sends + v_press_mentions_stats |
| `20260525220000_lead_scoring_a135.sql` | Cache intent_* sur quote_requests + RPC bandit_thompson_rank + route_lead_rank_candidates |
| `20260525230000_v_etat_profession.sql` | Vues v_etat_profession_summary + v_etat_profession_by_dept |

## Edge Functions à déployer

| Fonction | Cron suggéré | Action |
|---|---|---|
| `ingest-ademe-dpe-daily` | `0 4 * * *` (4h UTC) | Pull 50k DPE delta + insert data.ademe_dpe |
| `ingest-dvf-quarterly` | `0 6 1 1,4,7,10 *` (trimestriel) | Pull DVF top 500 communes |
| `refresh-data-lake-matviews` | `0 5 * * *` (5h UTC) | REFRESH MATERIALIZED VIEW CONCURRENTLY |
| `send-monthly-press-release` | `0 9 5 * *` (5e du mois 9h CET) | Génère brouillon presse Claude Sonnet à partir du rapport observatoire |

## Variables d'environnement requises

```env
# Existantes
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
RESEND_FROM="KOVAS <contact@kovas.fr>"

# Nouvelles (refonte)
ANTHROPIC_SONNET_MODEL=claude-sonnet-4-6     # send-monthly-press-release
ANTHROPIC_HAIKU_MODEL=claude-haiku-4-5       # déjà utilisée par observatoire-monthly-report
USD_TO_EUR_RATE=0.92                          # facturation interne IA
PRESS_ADMIN_NOTIFY_EMAIL=contact@kovas.fr     # notification draft presse

# Optionnel (production hardening)
UPSTASH_REDIS_REST_URL=                      # active rate-limit distribué
UPSTASH_REDIS_REST_TOKEN=                    # idem
```

## Tests

| Suite | Tests | Commit |
|---|---|---|
| `lib/algos/expiry-predictor.test.ts` | 9 | `45dd3a0` |
| `lib/algos/lead-scoring.test.ts` | 11 | `45dd3a0` |
| `lib/algos/churn-predictor.test.ts` | 7 | `45dd3a0` |
| `lib/algos/production-anomaly.test.ts` | 8 | `45dd3a0` |
| `lib/api-public/rate-limit.test.ts` | 6 | `4e485b6` |
| `tests/e2e/api-public-v1.spec.ts` | 10 | `c6ad3d3` |

**Total : 41 unit + 10 e2e = 51 tests dédiés au refonte.**

## Reste à livrer (priorité décroissante)

1. **GC2 mission flow continu** — refonte UX du tchat mission en flow continu plutôt que step-by-step
2. **Import Liciel ZIP V4** — round-trip parsing/écriture complète
3. **Ingesters BAN/IGN/Géorisques** — pré-warm offensif top communes
4. **A1.3.8 helper** — orchestration sync annuaire (Edge Functions existantes à formaliser en lib)
5. **Endpoints API publique restants** — 4-5 endpoints (diagnostician by-postcode, etc.)
6. **Rate-limit Upstash production** — configurer prod
7. **Page admin "Refonte status"** — vue introspection live des KPIs algos

## Stratégie de merge

La branche `refonte-acqui-target-2026-05` est conçue pour être **merge incrémental** sur `main` via squash-merge par phase :
- Phase 0 (✅ done) — bucket C cleanup + data lake foundations
- Phase 1 (en cours) — algos vague 1 + 2 + 3 + GC1/4/5/6 + API publique
- Phase 2 — GC2 + GC3 fiche enrichie + Liciel ZIP V4
- Phase 3 — Production hardening (Upstash, observability, E2E coverage 80%+)

Avant le merge, exécuter :

```bash
pnpm --filter @kovas/web typecheck  # 0 erreur attendu
pnpm --filter @kovas/web test:unit  # 51 tests pass attendu
pnpm --filter @kovas/web test:e2e   # E2E pertinents au scope mergé
```
