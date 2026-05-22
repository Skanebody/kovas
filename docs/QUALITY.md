# QUALITY.md — Pyramide qualité KOVAS

> Document de référence pour la stratégie qualité KOVAS App.
> Tous les outils, seuils et fréquences sont fixés ici. Toute modification doit être validée par Benjamin Bel.

## Table des matières

1. [Pyramide qualité — 7 couches](#1-pyramide-qualité--7-couches)
2. [Outils par couche](#2-outils-par-couche)
3. [Fréquences d'exécution](#3-fréquences-dexécution)
4. [Seuils de qualité](#4-seuils-de-qualité)
5. [Lancement local](#5-lancement-local)
6. [Ajouter un nouveau check](#6-ajouter-un-nouveau-check)
7. [Audit manuel mensuel](#7-audit-manuel-mensuel)
8. [Dashboard admin](#8-dashboard-admin)

---

## 1. Pyramide qualité — 7 couches

KOVAS adopte une approche qualité en pyramide. Plus on descend, plus la fréquence d'exécution augmente. Plus on monte, plus le coût d'exécution augmente mais aussi la valeur stratégique.

```
                  ┌──────────────────────────┐
                  │  7. Audit manuel mensuel │  ← 4h / mois
                  ├──────────────────────────┤
                  │  6. Synthetic monitoring │  ← Daily (Better Stack)
                  ├──────────────────────────┤
                  │  5. Performance & SEO    │  ← Daily CI (Lighthouse)
                  ├──────────────────────────┤
                  │  4. E2E tests            │  ← Pre-merge (Playwright)
                  ├──────────────────────────┤
                  │  3. Tests unitaires      │  ← Pre-commit (Vitest)
                  ├──────────────────────────┤
                  │  2. Lint + format        │  ← Pre-commit (Biome)
                  ├──────────────────────────┤
                  │  1. TypeScript strict    │  ← Pre-commit + CI (tsc)
                  └──────────────────────────┘
```

| Couche | Objectif | Coût build | Valeur stratégique |
|---|---|---|---|
| 1. TypeScript strict | Zéro `any`, zéro erreur de typage | Faible | ★★★★★ |
| 2. Lint + format | Cohérence syntaxique, anti-patterns | Faible | ★★★★ |
| 3. Tests unitaires | Logique métier isolée | Faible | ★★★★ |
| 4. E2E tests | Flux critiques utilisateur | Élevé | ★★★★★ |
| 5. Performance & SEO | Lighthouse, web vitals | Moyen | ★★★★ |
| 6. Synthetic monitoring | Uptime, smoke tests prod | Continu | ★★★★★ |
| 7. Audit manuel | Revue UX, sécurité, biz | 4h/mois | ★★★ |

---

## 2. Outils par couche

| Couche | Outil principal | Configuration |
|---|---|---|
| **1. Typage** | TypeScript 5.x strict + `tsc --noEmit` | `apps/web/tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`) |
| **2. Lint** | [Biome](https://biomejs.dev) | `biome.json` racine — formate + lint en 1 commande |
| **2bis. Dead code** | [Knip](https://knip.dev) | `knip.json` racine — détecte imports/exports orphelins |
| **3. Unit tests** | Vitest + Testing Library | `apps/web/vitest.config.ts` |
| **4. E2E** | Playwright | `tests/e2e/` — Chromium + Mobile Safari |
| **5. Performance** | Lighthouse CI | `.lighthouserc.json` — daily GitHub Actions |
| **5bis. Liens morts** | Lychee | `.github/workflows/links.yml` — hebdomadaire |
| **5ter. Sécurité statique** | Semgrep + Snyk | Daily CI sur `main` |
| **6. Error tracking** | Sentry | `apps/web/sentry.client.config.ts` |
| **6bis. Product analytics** | PostHog | Feature flags + session replay |
| **6ter. Uptime** | Better Stack | Monitor toutes les 60s sur `/api/health` |
| **7. Audit manuel** | Checklist Notion | `.claude/orchestration-kovas-app/quality-monthly-audit.md` |

---

## 3. Fréquences d'exécution

| Phase | Outils déclenchés |
|---|---|
| **Pre-commit (Husky)** | Biome format + lint, TypeScript check sur fichiers modifiés, tests unitaires impactés |
| **Pre-push** | Tests unitaires complets, build Next.js dry-run |
| **Pull Request CI** | TypeScript full, Biome, Knip, Vitest, Playwright (subset critique), build Next.js complet |
| **Merge sur `main`** | Tous les checks PR + Lighthouse CI + Semgrep + Snyk + déploiement Vercel |
| **Daily (00:00 UTC)** | Lighthouse complet sur toutes les pages publiques, Sentry digest, audit Snyk |
| **Hebdomadaire (lundi)** | Lychee (liens morts), revue manuelle dashboards |
| **Mensuel (1er du mois)** | Audit qualité 4h (cf. §7) |

---

## 4. Seuils de qualité

| Indicateur | Cible | Seuil bloquant CI |
|---|---|---|
| TypeScript erreurs | 0 | > 0 (bloque PR) |
| Biome erreurs | 0 | > 0 (bloque PR) |
| Tests unitaires | 100% pass | < 100% (bloque PR) |
| Couverture statements | ≥ 70% | < 60% (warning), < 50% (bloque) |
| Couverture branches | ≥ 60% | < 50% (warning) |
| Playwright critiques | 100% pass | < 100% (bloque PR) |
| Lighthouse Performance | ≥ 85 | < 75 (warning) |
| Lighthouse SEO | ≥ 95 | < 90 (warning) |
| Lighthouse Accessibility | ≥ 95 | < 90 (warning) |
| Lighthouse Best Practices | ≥ 95 | < 90 (warning) |
| Bundle size (apps/web first load JS) | ≤ 220 KB | > 280 KB (warning) |
| Sentry erreurs 24h | < 50 | > 200 (alerte SMS) |
| Uptime mensuel | ≥ 99.9% | < 99.5% (post-mortem obligatoire) |

---

## 5. Lancement local

### Vérification rapide (avant push)

```bash
# Type check
corepack pnpm --filter @kovas/web typecheck

# Lint + format
corepack pnpm biome check --apply .

# Tests unitaires
corepack pnpm --filter @kovas/web test
```

### Vérification complète (avant PR)

```bash
# Tout en un (séquence pre-PR)
corepack pnpm typecheck \
  && corepack pnpm biome check --apply . \
  && corepack pnpm knip \
  && corepack pnpm --filter @kovas/web test:coverage \
  && corepack pnpm --filter @kovas/web build \
  && corepack pnpm test:e2e
```

### Outils individuels

| Commande | Effet |
|---|---|
| `corepack pnpm --filter @kovas/web typecheck` | TypeScript strict |
| `corepack pnpm biome check .` | Lint + format check |
| `corepack pnpm biome check --apply .` | Lint + format auto-fix |
| `corepack pnpm knip` | Détection dead code |
| `corepack pnpm --filter @kovas/web test` | Vitest watch |
| `corepack pnpm --filter @kovas/web test:coverage` | Vitest avec coverage |
| `corepack pnpm test:e2e` | Playwright headed |
| `corepack pnpm test:e2e:ci` | Playwright headless |
| `corepack pnpm --filter @kovas/web build` | Build production Next.js |
| `corepack pnpm --filter @kovas/web start` | Serve production build |
| `npx @lhci/cli@latest autorun` | Lighthouse CI local |
| `corepack pnpm lychee './**/*.md'` | Vérification liens morts |

### Variables d'environnement requises

| Variable | Couche | Optionnel ? |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | 6 | Oui (mock en dev) |
| `SENTRY_ORG` | 6 | Oui |
| `SENTRY_PROJECT` | 6 | Oui |
| `BETTERSTACK_API_TOKEN` | 6ter | Oui |
| `BETTERSTACK_MONITOR_ID` | 6ter | Oui |
| `POSTHOG_API_KEY` | 6bis | Oui |
| `KOVAS_ADMIN_EMAILS` | Guard admin | Oui (allowlist hardcodée) |

---

## 6. Ajouter un nouveau check

1. **Identifier la couche** dans la pyramide (§1).
2. **Définir le seuil bloquant** + ajouter au tableau §4.
3. **Câbler dans la CI** :
   - Modifier `.github/workflows/ci.yml`
   - Ajouter step entre le step équivalent existant et le déploiement
4. **Documenter ici** dans §5 (commande locale) et §4 (seuil).
5. **Exposer dans le dashboard admin** (`/app/dashboard/admin/quality`) si métrique trackable :
   - Ajouter type dans `apps/web/src/lib/admin/quality-data.ts`
   - Implémenter `load<Source>()` avec mock fallback
   - Ajouter section dans `apps/web/src/components/admin/QualityDashboard.tsx`
6. **Créer un dashboard PostHog** correspondant si KPI business.

---

## 7. Audit manuel mensuel

**Fréquence** : 1er ouvrable du mois. **Durée** : 4h. **Owner** : Benjamin Bel (M0-M9), puis advisor diagnostiqueur en backup à partir de M9+.

### Checklist (4h)

**Bloc 1 — Technique (1h)**

- [ ] Lighthouse score `/`, `/pricing`, `/app/dashboard` (mobile + desktop)
- [ ] Sentry top 10 issues 30j — closure ou ticket créé
- [ ] Snyk audit — patch des high severity
- [ ] Bundle analyzer Next.js — vérifier first-load JS ≤ 220 KB
- [ ] Revue logs Vercel Edge 7j

**Bloc 2 — Sécurité (1h)**

- [ ] Rotation secrets Stripe / Supabase si > 90j
- [ ] Revue accès Supabase (memberships, RLS policies)
- [ ] Test endpoints `/api/*` avec token expiré (401 attendu)
- [ ] Revue CSP headers (cf. SECURITY.md)
- [ ] Pen test léger sur `/api/voice/transcribe` + `/api/auth/callback`

**Bloc 3 — Business (1h)**

- [ ] MRR vs cible mensuelle
- [ ] Churn analysis — appel sortant 3 churners
- [ ] Top 5 questions support — création articles KB si récurrent
- [ ] Revue ticket priorité urgente — SLA respecté ?

**Bloc 4 — UX (1h)**

- [ ] Session replay PostHog — 5 sessions aléatoires
- [ ] Heatmap pages clés (`/app/dossiers`, `/app/dashboard`)
- [ ] Revue feedback NPS 30j
- [ ] Test manuel des 3 flux critiques (mission nouvelle, export Liciel, partage email)

### Template post-audit

Document Notion `Audit qualité YYYY-MM` :

```
## Synthèse
- Score global : __/10
- Items bloquants : ___
- Items prioritaires M+1 : ___

## Actions immédiates (cette semaine)
- ...

## Actions M+1
- ...

## Roadmap impact
- ...
```

---

## 8. Dashboard admin

Le dashboard `/app/dashboard/admin/quality` agrège en temps réel les indicateurs des couches 1-6 de la pyramide.

| Section | Source | Refresh |
|---|---|---|
| Indicateurs temps réel | Lighthouse manifest + Sentry API + Better Stack + coverage report | Chaque chargement |
| SEO | Google Search Console (V2) — mock V1 | Chaque chargement |
| Business | PostHog SQL API — mock V1 | Chaque chargement |
| Sécurité | Snyk API — mock V1 | Chaque chargement |
| Alertes actives | `support_tickets` Supabase + Sentry | Temps réel |

**Accès** : restreint via `requireAdmin()` (cf. `apps/web/src/lib/auth/require-admin.ts`). Allowlist initiale : `benjamin@kovas.fr`, `benjaminbel@outlook.fr`. Surchargeable par `KOVAS_ADMIN_EMAILS=a@x.fr,b@y.fr`.

**Code source** :

- Page : `apps/web/src/app/app/dashboard/admin/quality/page.tsx`
- Composant : `apps/web/src/components/admin/QualityDashboard.tsx`
- Agrégateur : `apps/web/src/lib/admin/quality-data.ts`
- Guard : `apps/web/src/lib/auth/require-admin.ts`
- Layout protecteur : `apps/web/src/app/app/dashboard/admin/layout.tsx`
