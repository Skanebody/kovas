# Refonte Acqui-Target — Progrès (branche `refonte-acqui-target-2026-05`)

> Document de suivi exhaustif de la refonte stratégique de mai 2026, mise à jour à chaque lot livré. Source : commits sur la branche `refonte-acqui-target-2026-05`.
>
> **Authority** : `docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2.md` (spec condensée) + `docs/refonte-2026-05/REFONTE-ACQUI-TARGET-V2-FULL.md` (spec exhaustive).

## Vue d'ensemble

- **Branche** : `refonte-acqui-target-2026-05`
- **Base** : `main` (Phase 0 le 2026-05-25)
- **Stratégie** : repositionnement KOVAS 360 → acqui-target Enersweet (Liciel) 5-10 M€ sur 24 mois
- **Typecheck** : 0 erreur en permanence sur la branche
- **Build production `next build`** : ✅ vert (B39 + B43 — 2781 pages SSG, 0 erreur, pricing V5 appliqué)
- **Pricing V5 (mockup 2026-05-25)** : Logiciel 29/79/199/499€ + Annuaire 19/39/79€ + Bundles 39/89/99/229/529€ — sweep transversal 21 fichiers (Lot B43)
- **AI Economics doc** : `docs/refonte-2026-05/AI_ECONOMICS.md` — 15 techniques d'optimisation tokens, 9/15 ✅ déjà en prod
- **Tests Vitest** : **422 tests** pure-fn + helpers + cascading + equipment cache + incremental recompute + tools filter + transcription router + knowledge graph + InfoTooltip
- **Tests E2E Playwright** : **34 tests** (API publique + redirects 301 + admin gate + tarifs onglets + homepage + grille V5 mockup + /aide + /guides + /pros/aide)
- **AI techniques** : **15/15 ✅** 🎯 (toutes livrées en pure-fn pattern, prêtes pour orchestrateurs futurs)
- **SEO méthode Amandine Bart** : audit complet 41 pages (B66) + glossaire 25 termes diagnostic (B67+B69) + 7 pages avec tooltips (B67+B69) + sweep 8 pages clés Schema.org (B68) + section 13 algos sur home (B69) + sweep tutoiement schema.org pricing (B73)
- **Harmonisation chrome public V5 sobre** : 11 pages publiques alignées sur le style home (`/`, `/tarifs`, `/comparatif`, `/temoignages`, `/api-publique`, `/demo`, `/a-propos`, `/aide`, `/observatoire`, `/presse`, `/contact`) — PublicHeader + SiteFooter + typo Urbanist medium + Instrument Serif italic mot-clé + bordures 0.08
- **Harmonisation dashboard V5 sobre + bascule tutoiement** (B77 audit + B78-B81 sweep) : 28 pages dashboard + ~80 sub-composants. Tokens v4 (ink/rule/font-display/glass) → V5 hex direct. Drama cyan onboarding éliminé. Workflows critiques préservés (cancellation décret 2023-417, KYC, OAuth Pennylane/Qonto)
- **Stratégie tutoiement code SaaS B2B challenger 2026** : home (B74) + 11 pages publiques (B75) + pricing-plans data (B76) + 28 pages dashboard (B79/B80/B81) + composants partagés. Ton confrère professionnel sobre (Qonto/Alan/Pennylane), JAMAIS familier
- **4 sections Tugan adaptées home** (B74) : Mécanique révélée + Lettre fondateur + Anti-pitch + PS final calcul ROI
- **Exposition 11/13 algos A1.3.* manquants côté diag** (B82) : page catalogue `/dashboard/decouvrir/algos` + 4 widgets diag-facing (Vision IA équipement, Alerte certifications, SEO fiche annuaire, Stats secteur 7j)
- **GC2 Mission Flow Continu UI scaffold** (B83) : Timeline + TransitionPicker + Composer + route `/dashboard/dossiers/[id]/mission/flow` + server actions branchées sur state machine pure-fn + RPC SECURITY DEFINER

## Algorithmes A1.3.* — 13 / 13 livrés ✅

| ID | Algo | Status | Commit | Fichier |
|---|---|---|---|---|
| A1.3.1 | DPE shopping detection | ✅ | `3cda1b5` | `lib/algos/dpe-shopping.ts` |
| A1.3.2 | Cohérence cadastre vs surface | ✅ | `3cda1b5` | `lib/algos/cadastre-coherence.ts` |
| A1.3.3 | Score conformité multi-dimensionnel | ✅ | `3cda1b5` | `lib/algos/conformity-score.ts` |
| A1.3.4 | Profil unifié propriété | ✅ | `4f73c0f` | `lib/property/unified-profile.ts` + `build-profile.ts` |
| A1.3.5 | Lead scoring + Thompson sampling | ✅ | `1f91d68` | `lib/algos/lead-scoring.ts` |
| A1.3.6 | Vision IA classification équipement | ✅ | `a39ddad` | `lib/algos/vision-equipment.ts` |
| A1.3.7 | Document classifier client uploads | ✅ | `d3a8d7d` | `lib/algos/document-classifier.ts` |
| A1.3.8 | Annuaire sync DHUP/SIRENE/COFRAC/GMB | ✅ | `7fc89dd` | `lib/algos/annuaire-sync.ts` |
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
| GC3 | Annuaire B2C enrichi | 🟢 | `1f91d68` + `b1e357c` + `20937ae` + (B37) | A1.3.5 livré, admin queue, fiche publique + section Réactivité/Vérification/Fraîcheur (B37) |
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
| `20260525240000_mission_flow_state.sql` | mission_flow_states + mission_flow_events + RPC mission_flow_transition (GC2 fondations) |
| `20260525250000_diagnostician_response_metrics.sql` | RPC `get_diagnostician_response_metrics` + partial index `(diagnostician_id, diag_responded_at)` pour fiche publique B37/B41 |

## Edge Functions à déployer

| Fonction | Cron suggéré | Action |
|---|---|---|
| `ingest-ademe-dpe-daily` | `0 4 * * *` (4h UTC) | Pull 50k DPE delta + insert data.ademe_dpe |
| `ingest-dvf-quarterly` | `0 6 1 1,4,7,10 *` (trimestriel) | Pull DVF top 500 communes |
| `refresh-data-lake-matviews` | `0 5 * * *` (5h UTC) | REFRESH MATERIALIZED VIEW CONCURRENTLY |
| `send-monthly-press-release` | `0 9 5 * *` (5e du mois 9h CET) | Génère brouillon presse Claude Sonnet à partir du rapport observatoire |
| `ingest-ban-cache-daily` | `0 3 * * *` (3h UTC) | Pré-warm BAN sur top 1500 adresses récentes |
| `ingest-georisques-weekly` | `0 4 * * 1` (lundi 4h UTC) | Pré-warm Géorisques sur top 500 communes |
| `ingest-ign-cadastre-weekly` | `0 5 * * 2` (mardi 5h UTC) | Pré-warm IGN cadastre sur ban_id sans parcelle |

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
| `lib/algos/dpe-shopping.test.ts` | 6 | (B26) |
| `lib/algos/cadastre-coherence.test.ts` | 5 | (B26) |
| `lib/algos/conformity-score.test.ts` | 16 | (B36) |
| `lib/property/unified-profile.test.ts` | 17 | (B28) |
| `lib/algos/lead-scoring.test.ts` | 11 | `45dd3a0` |
| `lib/algos/vision-equipment.test.ts` | 7 | (B28) |
| `lib/algos/document-classifier.test.ts` | 12 | (B26) |
| `lib/algos/annuaire-sync.test.ts` | 8 | `7fc89dd` |
| `lib/algos/production-anomaly.test.ts` | 8 | `45dd3a0` |
| `lib/algos/expiry-predictor.test.ts` | 9 | `45dd3a0` |
| `lib/algos/churn-predictor.test.ts` | 7 | `45dd3a0` |
| `lib/algos/seo-quality-scorer.test.ts` | 9 | (B26) |
| `lib/algos/diagnostician-pattern-learning.test.ts` | 11 | (B26) |
| `lib/api-public/rate-limit.test.ts` | 6 | `4e485b6` |
| `lib/mission-flow/state-machine.test.ts` | 19 | (B30) |
| `lib/liciel/zip-v4-schema.test.ts` | 14 | (B31) |
| `lib/diag-availability.test.ts` | 28 | (B37) |
| `lib/diag-availability-fetch.test.ts` | 8 | (B42) |
| `lib/ai/cascading.test.ts` | 18 | (B47) |
| `lib/cache/equipment-models.test.ts` | 29 | (B48) |
| `lib/ai/incremental-recompute.test.ts` | 19 | (B49) |
| `lib/ai/tools-filter.test.ts` | 22 | (B50) |
| `components/ui/info-tooltip.test.tsx` | 7 | (B67) |
| `tests/e2e/api-public-v1.spec.ts` | 10 | `c6ad3d3` |
| `tests/e2e/refonte-surfaces.spec.ts` | 24 | (B38 + B44 + B63) |

**Total : 296 unit + 34 e2e = 330 tests dédiés au refonte.**

Couverture pure-fn : **13/13 algos testés ✅** (suite complète).

## Reste à livrer (priorité décroissante)

### Surfaces totalement livrées ✅
- ✅ A1.3.* — 13/13 algos livrés + **13/13 testés**
- ✅ Game Changers 1/3/4/5/6 livrés (GC3 = A1.3.5 + admin UI + fiche publique enrichie B37)
- ✅ GC2 **fondations data layer + state machine + 19 tests** (UI tchat continu différé)
- ✅ API publique V1 — 4 endpoints + OpenAPI 3.1 + rate-limit Upstash-ready
- ✅ Ingesters complets : ADEME DPE + DVF + BAN cache + Géorisques + IGN cadastre + refresh matviews
- ✅ Admin pages : press / renewals / churn / leads-detail / refonte status + 2 batch actions (backfill A1.3.5 + audit A1.3.12)
- ✅ Liciel V4 **schema JSON pivot + validation cross-refs + 14 tests** (microservice MDB Jackcess différé)
- ✅ Sweep KOVAS 360 → KOVAS (56 fichiers) + restructure /pros/* → /* (301 redirects) + Homepage 8 sections + /tarifs 3 onglets
- ✅ **Pricing V5** (Lot B43) — Logiciel 29/79/199/499€ + Annuaire 19/39/79€ (Présence/Boost/Premium) + Bundles 39/89/99/229/529€ + sweep 21 fichiers + CGV v1.4 (B53) + grandfather V4 préservé
- ✅ **13/15 AI techniques** (B47 cascading + B48 equipment cache + B49 incremental recompute + B50 tools filter — pure-fn 88 tests)
- ✅ **Production hardening docs** : `UPSTASH-SETUP.md` (B51) + `MIGRATION-PROD-CHECKLIST.md` 577 lignes (B52)
- ✅ **Fixes prod-blocking** (B54 + B55) : migration `20260526100000_matview_first_refresh.sql` (amorce les 2 matviews `analytics.*` avant le 1er REFRESH CONCURRENTLY) + migration `20260526110000_route_lead_postgis.sql` (PostGIS ST_DWithin + index GIST expression partiel, perf x3-x10 sur la RPC routing leads)
- ✅ **Sweep authority docs** : CLAUDE.md header + §22 pointent vers les 4 nouveaux docs (AI_ECONOMICS, UPSTASH-SETUP, MIGRATION-PROD-CHECKLIST, CGV v1.4)
- ✅ **Test bandit decay fix** : tolérance test `converges towards prior Beta(1,1)` calibrée à 150 itérations (vs 100 mathématiquement insuffisant pour `toBeCloseTo(_, 1)` à γ=0.95)
- ✅ **Dashboard /admin/sante-tech section AI Economics** (Lot B57) : Server Component avec TOTAL agrégé navy + 4 LeverCards (cascading B47 / equipment cache B48 / recompute B49 / tools filter B50) + sidebar admin entrée "Santé tech" + 2 tests E2E admin gate
- ✅ **Whisper local WASM router** (Lot B58) : `lib/audio/transcription-router.ts` pure-fn — seuils 180s/600s/0.4 noise + 29 tests Vitest. Intégration WASM réelle = lot futur dédié.
- ✅ **Pattern learning graph sémantique** (Lot B59) : `lib/learning/user-knowledge-graph.ts` — `UserKnowledgeGraph` JSONB-friendly + 4 pure-fn (buildKnowledgeGraph / predictFromGraph / computeDelta / routeAnalysisStrategy) + 38 tests Vitest. Migration SQL `data.user_mission_patterns` + orchestrateur = lots futurs.
- ✅ **15/15 AI techniques 🎯** (B47 cascading + B48 equipment cache + B49 incremental recompute + B50 tools filter + B58 Whisper router + B59 pattern learning graph)
- ✅ **Whisper cascading runtime branché** (Lot B60) : `/api/transcribe` route handler consomme le router B58 → mapping `api_whisper_mini` ↔ `whisper-1`, économie immédiate -15% coût transcription sur les audios courts (signature JSON préservée + 9 tests Vitest)
- ✅ **Pattern learning runtime branché** (Lot B61) : migration `data.user_mission_patterns` + Edge Function `rebuild-user-patterns` cron hebdo + helper `lib/learning/mission-analysis-router.ts` (12 tests) — économie projetée -60-70% sur user mature M6+
- ✅ **Fix critique boucle redirect** (Lot B62) : middleware `PROS_REDIRECTS` clés inversées → ERR_TOO_MANY_REDIRECTS sur `/tarifs`, `/temoignages`, `/comparatif`, `/api-publique`, `/demo`. Mapping corrigé : `/pros/tarifs → /tarifs` (legacy → nouveau) + ajout `/pros/api → /api-publique` (collision Next.js)
- ✅ **Pages publiques manquantes** (Lot B63) : `/aide` (centre d'aide 4 sections + SLA tier + contact) + `/guides` alias server-side `redirect('/guide')` + `/pros/aide → /aide` middleware + 3 tests E2E
- ✅ **Guides SEO méthode Amandine Bart** (Lot B64) : 3 guides prioritaires enrichis (DPE/Amiante/Audit énergétique) avec **23 sources externes** 100% légitimes (Légifrance, ADEME, INRS, Anah, Service-public.fr, EUR-Lex, DGEC, France Rénov', OPQIBI), composants `<GuideSources>` + `<RelatedGuides>`, JSON-LD `Article` enrichi (image, timeRequired ISO 8601, citation[]), `internal-linking.ts` map curé + `getRelatedGuides()`
- ✅ **MAJ automatique guides via IA** (Lot B65) : migration `internal.guide_refresh_queue` + `internal.guide_versions` + 2 RPCs (rotation + current_version) + Edge Function `refresh-guides-content` (web_search filtré 14 domaines officiels whitelist + extraction Haiku + draft Sonnet cached + notification admin) + page admin `/admin/guides-refresh` (diff side-by-side approve/reject/regen) + cron `0 4 * * 1` (rotation 9 guides en ~3 semaines)
- ✅ **Audit SEO exhaustif méthode Amandine Bart** (Lot B66) : `docs/refonte-2026-05/SEO-AUDIT-2026-05-26.md` — **41 pages auditées** (31 publiques + 10 légales + 1 917 prog. `/diagnostic/[type]/[ville]` + arbo `/trouver-un-diagnostiqueur/[dept]/[city]/[slug]`), score moyen **66/100**. Top 5 : `/trouver-un-diagnostiqueur/[dept]/[city]` (94/100, 30 JSON-LD) > `/[…]/[slug]` (92) > 9 `/guide/[type]` (90) > `/comparatif` (88) > `/diagnostic/[type]/[ville]` (87). Bottom 5 : `/guides` (22, à supprimer + 301) > `/pricing/calculator` (42, doublon) > `/contact` (48) > `/pricing/compare` (50) > `/blog` (52). Trouvailles critiques : doublons URLs `/pricing` ↔ `/tarifs` (dilution PageRank ~75%), 16 pages sans `buildMetadata` complet, 18 pages sans Schema.org pertinent, 14 pages 0 lien interne, sources `.gouv.fr` quasi-absentes (signal E-E-A-T)
- ✅ **InfoTooltip + glossaire diagnostic** (Lot B67) : composants `<InfoTooltip>` (client, icône Info Lucide 14px navy/55 %, popover blanc max-w 320px, hover desktop + tap mobile + ESC + focus visible + aria-label) + `<GlossaryTerm>` (server wrapper résout entrée auto) + `lib/glossary/diagnostic-terms.ts` (**20 termes** : DPE, COFRAC, Carrez, Boutin, ERP, mention audit énergétique, 3CL-2021, RGE, AGC, DTA, CREP, GES, MaPrimeRénov', ESRIS, PPRT, passoire thermique, audit énergétique réglementaire, Factur-X, Liciel, OBBC, ORIS). Déploiement **6 pages** : `/aide` (9 tooltips) + `/tarifs` (6) + `/comparatif` (hero DPE+3CL-2021) + `/observatoire` (méthodo 6) + `/guide` (auto-tooltip cards) + `/calculateur-dpe-gratuit/result-card.tsx`. **7 tests Vitest** verts + drive-by `esbuild.jsx: 'automatic'` dans vitest.config.ts
- ✅ **Sweep SEO 8 pages clés méthode Amandine Bart** (Lot B68) : `/`, `/tarifs`, `/aide`, `/comparatif`, `/temoignages`, `/api-publique`, `/demo`, `/a-propos`. Titles 50-60 char optimisés intent transactionnel, migrations vers `buildMetadata` helper canonique, JSON-LD pertinents ajoutés : `/` (Organization + WebSite SearchAction + FAQPage 8 Q) ・ `/tarifs` (BreadcrumbList + ItemList complet via `buildPricingItemListSchema`) ・ `/aide` (WebPage + FAQPage 5 Q) ・ `/temoignages` (CollectionPage + ItemList 15 Quotation, volontairement pas `Review` pour ne pas tromper Google sur des témoignages V1) ・ `/api-publique` (WebAPI + DataCatalog 4 datasets CC-BY 4.0) ・ `/demo` (WebPage + ReserveAction) ・ `/a-propos` (BreadcrumbList ajouté au graph Person+Organization+AboutPage). Maillage interne ≥3 liens contextuels chaque page. Brand V5 / `contact@kovas.fr` préservés
- ✅ **Homepage section 13 algorithmes propriétaires + tooltips jargon** (Lot B69) : nouvelle section "Sous le capot" entre HowItWorks et PricingTeaser. Grille de 13 cards (code mono `A1.3.X` + icône Lucide + titre + "Ce que ça fait" + "Pour vous"), ordre du plus visible (Vision IA équipement, Score conformité) au plus stratégique (SEO fiche kovas.fr, Sync annuaire 4 sources). Footer KPI sobre (422 tests Vitest verts · 9/13 algos sans IA externe · données EU Paris). **11 tooltips `<GlossaryTerm>` injectés** sur termes jargon home : Hero (Liciel/ORIS/OBBC/DPE), 3 Promesses (ADEME/GES), HowItWorks (3CL/Liciel/3CL-2021/ADEME), Section algos (ADEME/IGN/BAN/DHUP/COFRAC inline). Glossaire enrichi de 5 termes (**25 termes total** : +ADEME, DHUP, IGN, BAN, INSEE)
- ✅ **Refonte chrome `/tarifs` au style home V5 sobre** (Lot B70) : remplacement header custom "K · O · V · A · S" lettering par `<PublicHeader />` + remplacement footer custom `FooterPromises` par `<SiteFooter />`. Cards tiers reskinnées : grid `gap-4` rounded-2xl border 0.08 (au lieu de bordures pleines brutalist), prix `clamp(48px, 5vw, 72px)` responsive (au lieu de 64px fixe), features `<CheckCircle2>` chartreuse-deep, CTAs `<Button variant="accent">`. **Sweep tutoiement → vouvoiement strict** (0 occurrence après refonte). Preservation stricte : 4+3+5 tiers data canonique V5, Suspense TarifsTabs, JSON-LD BreadcrumbList+ItemList, metadata B68, glossaire B67, maillage interne final
- ✅ **Harmonisation chrome 4 pages B68 au style home V5** (Lot B71) : `/comparatif` (8 sections React + workflow 7 étapes + loss aversion + leviers neuropsy préservés) ・ `/temoignages` (Hero + Explorer + CTA final, chips filtre custom FilterChip navy/blanc, blockquote serif italic 18-20px, metric chartreuse-deep) ・ `/api-publique` (4 sections + code blocks navy `rounded-xl`, method HTTP en pill custom) ・ `/demo` (4 sections + form sobre). Patterns appliqués partout : `bg-sage`, `text-[#0F1419]`, sections `py-20 sm:py-28 border-t border-[#0F1419]/[0.08]`, eyebrow mono uppercase tracking-wider, H1 clamp(40px,7vw,104px) avec mot-clé serif italic, cards rounded-2xl border 0.08 bg-paper. **0 tutoiement** sur les 5 fichiers. JSON-LD intacts, GlossaryTerm B67 préservés
- ✅ **Harmonisation chrome 6 pages annexes au style home V5** (Lot B72) : `/a-propos`, `/presse`, `/carrieres`, `/contact` étaient déjà conformes (PublicHeader + SiteFooter + tokens canoniques) — aucune modif requise. **2 pages refondues** : `/aide` (chrome complet 336 lignes — remplacement tokens legacy `ink`/`ink-soft`/`sage-alt`/`rule`/`font-display`/`max-w-screen-xl`) ・ `/observatoire` (refonte tokens uniquement, sous-composants data live HeroStats/PriceSection/EnergyDistribution/RenovationTrend/TopCities/PressMentions/LeadMagnet **non touchés** pour préserver Supabase queries + ISR `revalidate=3600`). Préservation : 9 GlossaryTerm `/aide` + 5 `/observatoire/methodologie`, JSON-LD WebPage+BreadcrumbList+FAQPage+Dataset, metadata B68
- ✅ **Fix tutoiement schema.org pricing** (Lot B73) : le sweep B70 corrigeait les strings UI de `/tarifs` mais pas les `tagline`/`features` sources dans `lib/pricing-plans.ts` qui alimentent `buildPricingItemListSchema()`. Les `description` de Service JSON-LD restaient en tutoiement (visibles dans rich results Google et SEO). Correction de **15 strings** : 4 taglines Logiciel + 3 taglines Annuaire + 1 tagline Bundle + 7 features Annuaire + 1 feature Logiciel. Montants pricing inchangés. Vérifié `grep tutoiement HTML rendu /tarifs` → 0 occurrence
- ✅ **Home 4 sections Tugan adaptées + bascule tutoiement** (Lot B74) : refonte stratégique 9→12 sections. **Mécanique révélée** (eyebrow "Comment c'est possible" + H2 "Pas par magie. Par 3 mécaniques précises" + grid 3 cards avec gains 12/8/15 min + footer serif italic "Total 35 minutes"). **Lettre du fondateur** (Benjamin Bel, 12 paragraphes, signature "Diagnostiqueur certifié DPE"). **Anti-pitch** ("KOVAS n'est pas pour toi si…" 5 disqualifiants + 3 fits chartreuse). **PS final** (calcul ROI 50 missions = 29h = 12 semaines = 3 mois). Bascule complète **tutoiement** code SaaS B2B challenger 2026 (Qonto/Alan/Pennylane). 11 GlossaryTerm préservés + 4 nouveaux. JSON-LD intacts
- ✅ **Sweep tutoiement transversal pages publiques** (Lot B75) : 20 fichiers (11 pages publiques + 9 composants partagés/actions). Conversions vous→tu, votre→ton, conjugaisons impératives, témoignages verbatim préservés, JSON-LD réglementaires préservés vouvoiement
- ✅ **Sweep tutoiement data UI critiques** (Lot B76 + B73 reverted) : 15 strings revertées vouvoiement→tutoiement dans `lib/pricing-plans.ts` (8 taglines + 7 features), exceptions email/legal préservées (winback, trial reminders)
- ✅ **Audit exhaustif dashboard `/dashboard/*`** (Lot B77) : `docs/refonte-2026-05/AUDIT-DASHBOARD-2026-05-26.md` (636 lignes). 67 pages auditées, 0 fichier orphelin (cleanup déjà fait), 37/67 pages avec tokens v4 legacy, 11/13 algos invisibles côté diag, GC2 mission flow UI inexistante, score moyen harmonisation 42/100. Plan 3 vagues chiffré : 13-18 agent-heures scaffold complet
- ✅ **Refonte chrome layout dashboard V5 sobre** (Lot B78) : `dashboard/layout.tsx` header `glass-opaque` (backdrop-blur v4) → `bg-paper rounded-2xl border [#0F1419]/[0.08]` sobre. Logo mobile `bg-navy shadow-accent` → `bg-[#0F1419]` flat. `dashboard/admin/layout.tsx` sweep tokens. Middleware `REMOVED_ROUTES` conservé (rôle défensif, `/signaler-un-diagnostiqueur` confirmé absent du disque)
- ✅ **Harmonisation V5 sobre + tutoiement 8 pages dashboard racines+cockpit** (Lot B79) : `/dashboard/dashboard`, `/dashboard/relances`, `/dashboard/clients/[id]`, `/dashboard/cockpit-fraude`, `/dashboard/calendar`, `/dashboard/analytics`, `/dashboard/archive`, `/dashboard/veille` + 23 sub-composants consommés. Headers sticky custom → `<AppPageHeader>` canonique. `<KpiHero>` refondu en variant `bg-paper` opaque. Total **31 fichiers**. Bonus : 10 erreurs lint pré-existantes corrigées au passage
- ✅ **Harmonisation V5 sobre + tutoiement 12 pages dashboard account+onboarding** (Lot B80) : `/dashboard/account/*` (8 pages), `/dashboard/onboarding/*` (5 pages), `/dashboard/compte/tarifs`. **BLOCKING résolu** : suppression drama cyan `bg-fluid-light` sur `/onboarding/page.tsx` et `/onboarding/first-dossier` → `<AppPageHeader>` sobre. 22 fichiers (12 pages + 10 sub-composants). Workflows préservés : résiliation décret 2023-417, KYC verification, OAuth Pennylane/Qonto, LAFT, referral engine
- ✅ **Harmonisation V5 sobre + tutoiement 8 pages dashboard dossiers+missions+decouvrir** (Lot B81) : `/dashboard/dossiers/[id]/{page,defense,litigation,prevalidation,mission,mission/tchat,mission/validation}` + `/dashboard/decouvrir`. Hub `<HubHeader>` modernisé tokens V5 (préservation structurelle 11 sections atomiques). Modes plein écran mission/tchat/validation préservés (intentionnellement minimaux). 57 fichiers (8 pages + 49 sub-composants : hub sections, sidebar blocks, mission tchat interface, validation client, decouvrir client, defense, litigation, ademe)
- ✅ **Exposition 11 algos A1.3.* manquants + 4 widgets diag-facing** (Lot B82) : nouvelle page **`/dashboard/decouvrir/algos`** (catalogue 13 algos avec badge EXPOSÉ/BIENTÔT + lien surface exposition + data centralisée `data/algos/dashboard-catalog.ts`) + sidebar entrée "Algorithmes" (icône Brain). **4 widgets** : `<VisionEquipmentSection>` sur mission/validation (consomme `vision_analysis` JSON), `<RenewalsWidget>` sur dashboard (consomme `predictExpiry` A1.3.10 COFRAC+RC Pro), `<SeoScoreWidget>` sur account/parrainage (score 0-100 hero serif italic + 3-5 recommandations), `<ProfessionStatsWidget>` sur dashboard (GC4 diag-facing via `getEtatProfessionSummary`). 10 fichiers, 988 insertions
- ✅ **Scaffold UI GC2 Mission Flow Continu** (Lot B83) : 5 livrables qui exposent enfin GC2 (BLIND SPOT identifié B77) : `<MissionFlowTimeline>` (client, timeline sobre + highlight chartreuse), `<MissionFlowTransitionPicker>` (client, boutons outline + toasts sonner + useTransition), `<MissionFlowComposer>` (client assembleur layout 2 cols + barre progression + state machine pure-fn), route **`/dashboard/dossiers/[id]/mission/flow`** (server, EmptyState init si jamais initialisé), server actions `transitionMissionFlowAction` + `initializeMissionFlowAction` (validation state machine + RPC `mission_flow_transition` SECURITY DEFINER + gestion erreurs Stripe-style). 699 insertions

### Vraies tâches restantes
1. **GC2 UI complète** — composants tchat continu + composer + transitions animées (session UX dédiée 3-5j)
2. **Microservice MDB Jackcess** — Java/Kotlin sur Railway pour bridge JSON ↔ MDB Liciel
3. **Tests E2E Playwright admin pages neuves** — press / renewals / churn / leads-detail / refonte / sante-tech / guides-refresh (nécessite seed DB + auth admin en CI ; smoke gate déjà couvert B38/B57)
4. **Provisionnement Upstash Redis réel** — créer compte + base eu-west-1 + coller secrets dans Vercel prod (cf. `docs/refonte-2026-05/UPSTASH-SETUP.md`)
5. **Application des 10 migrations Supabase prod** — suivre `docs/refonte-2026-05/MIGRATION-PROD-CHECKLIST.md` (backup PITR + dry-run + push + smoke tests). 10 migrations = 6 refonte initiales + B54 fix matview + B55 perf PostGIS + B61 user_mission_patterns + B65 guides_refresh_queue.
6. **Intégration WASM réelle Whisper local** — ajouter dep `whisper.cpp-wasm` + hook `useLocalWhisper()` + brancher `decideTranscriptionEngine` dans `/api/transcribe` route handler (le router pure-fn B58 est prêt)
7. **Génération 8 OG images** (1200×630, palette V5) — `home.png`, `tarifs.png`, `aide.png`, `comparatif.png`, `temoignages.png`, `api-publique.png`, `demo.png`, `a-propos.png` dans `/public/og-images/`. Fallback `/og-image.png` actif tant qu'absentes (pas de crash)
8. **Fixes SEO bottom 5 (B66)** — supprimer `/guides` route doublon + 301 vers `/guide` (déjà en place, vérifier que la route physique disparaît du sitemap) · refonte `/contact` avec `ContactPage` + `LocalBusiness` schema · canonical/OG/Twitter sur `/pricing/compare` et `/pricing/calculator` · pages détail articles `/blog/[slug]` ou décision suppression `/blog` complète
9. **Sweep `buildMetadata` sur 16 pages restantes (B66)** — pages utilisant encore `Metadata` brut sans canonical/OG/Twitter complets (lot dédié B69 à prévoir)
10. **Maillage interne sur 14 pages 0 lien (B66)** — ajouter ≥3 liens contextuels par page (lot dédié B70)

## Stratégie de merge

La branche `refonte-acqui-target-2026-05` est conçue pour être **merge incrémental** sur `main` via squash-merge par phase :
- Phase 0 (✅ done) — bucket C cleanup + data lake foundations
- Phase 1 (en cours) — algos vague 1 + 2 + 3 + GC1/4/5/6 + API publique
- Phase 2 — GC2 + GC3 fiche enrichie + Liciel ZIP V4
- Phase 3 — Production hardening (Upstash, observability, E2E coverage 80%+)

Avant le merge, exécuter :

```bash
pnpm --filter @kovas/web typecheck  # 0 erreur attendu
pnpm --filter @kovas/web test:unit  # 193 tests pass attendu
pnpm --filter @kovas/web test:e2e   # 24+ tests E2E refonte (lance app au préalable)
pnpm --filter @kovas/web build      # 'next build' production — 2781 pages SSG, 0 erreur
```

## Garde-fous Next.js 15 — leçons apprises (B39)

- **`useSearchParams()` dans un client component utilisé par une page statique** doit
  être wrappé par un `<Suspense>` côté server component parent, sinon `next build`
  casse le prerender avec « should be wrapped in a suspense boundary ». Pattern :
  ```tsx
  <Suspense fallback={<DefaultTab />}>
    <ClientTabsComponent />
  </Suspense>
  ```
- **Toujours lancer `next build` avant un merge** — typecheck seul ne détecte pas
  ces erreurs de prerender / sérialisation RSC.
