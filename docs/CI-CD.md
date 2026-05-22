# CI/CD KOVAS — Pipelines GitHub Actions

> **Authority** : addendum qualité KOVAS. Toute modification des workflows doit être documentée ici.
> **Dernière mise à jour** : 2026-05-22

---

## 1. Workflows existants

### 1.1. `quality.yml` — Pipeline qualité principal

**Triggers** : `push` et `pull_request` sur `main` et `develop`.

**Concurrency** : annule automatiquement les runs précédents sur la même ref (économie de minutes CI).

8 jobs orchestrés (le DAG est représenté ci-dessous) :

| # | Job | Timeout | Dépendances | Description |
|---|---|---|---|---|
| 1 | `static` | 5 min | – | Typecheck strict + Biome lint/format + Knip (dead code) + Depcheck (deps inutilisées) |
| 2 | `security` | 10 min | – | `pnpm audit` (≥ high) + Semgrep (security-audit, OWASP top 10, TS, React, Next) + Snyk (severity high+) |
| 3 | `test` | 10 min | `static` | Tests unitaires Vitest avec couverture + upload Codecov |
| 4 | `build` | 10 min | `static` | Build Next.js (`@kovas/web`) avec `@next/bundle-analyzer` + upload artifact `.next/` |
| 5 | `e2e` | 30 min | `build` | Playwright E2E sur build prod + upload report HTML si échec |
| 6 | `lighthouse` | 15 min | `build` | Lighthouse CI (`@lhci/cli`) avec annotations PR via `LHCI_GITHUB_APP_TOKEN` |
| 7 | `a11y` | 10 min | `build` | Tests accessibilité (`pnpm test:a11y`) |
| 8 | `chromatic` | 10 min | – (PR uniquement) | Visual regression Chromatic, `exitOnceUploaded` |

**DAG simplifié** :

```
static ─┬─> test
        ├─> build ─┬─> e2e
        │         ├─> lighthouse
        │         └─> a11y
security (parallèle)
chromatic (parallèle, PR only)
```

### 1.2. `scheduled.yml` — Tâches programmées quotidiennes

**Triggers** : `schedule: '0 3 * * *'` (3h UTC, soit 5h Europe/Paris été) + `workflow_dispatch` manuel.

4 jobs indépendants :

| Job | Timeout | Description |
|---|---|---|
| `link-check` | 15 min | Lychee CLI sur `https://kovas.fr` + docs locales (cf. [`lychee.toml`](../lychee.toml)). Notifie Slack via `SLACK_WEBHOOK_URL` en cas d'échec. |
| `seo-audit` | 20 min | `pnpm tsx scripts/seo-audit.ts` (crawl Playwright) + `validate-structured-data.ts` (JSON-LD). Upload artifact `reports/`. |
| `zap-scan` | 30 min | OWASP ZAP baseline sur `https://kovas-staging.vercel.app`, règles d'exclusion dans [`.zap/rules.tsv`](../.zap/rules.tsv). |
| `outdated-deps` | 10 min | `pnpm outdated` + `scripts/check-outdated.ts` (ouvre issue GitHub auto si major versions disponibles). |

### 1.3. `ci.yml` — Pipeline legacy (à fusionner)

Le fichier `.github/workflows/ci.yml` historique reste actif (typecheck/lint/build). Il fera l'objet d'un merge dans `quality.yml` à terme — pour l'instant les deux coexistent (le `static` job de `quality.yml` reproduit ses étapes).

---

## 2. Dependabot

Configuration : [`.github/dependabot.yml`](../.github/dependabot.yml).

- **Ecosystem `npm`** (= pnpm packages) : hebdomadaire le lundi 08:00 Europe/Paris.
- **Ecosystem `github-actions`** : même fenêtre, limite 5 PRs.
- **Groupement** : `minor + patch` dans **un seul PR** ; `major` dans des PRs séparés.
- **Open PR limit** : 10 pour npm, 5 pour actions.
- **Ignored** : React 19 / React-DOM 19 / Next 15 (majeures bloquées — déjà sur ces versions, pas de migration auto).

---

## 3. Secrets requis dans GitHub

À configurer dans **Settings → Secrets and variables → Actions → Repository secrets**.

| Secret | Utilisé par | Comment l'obtenir |
|---|---|---|
| `SUPABASE_URL_TEST` | `test` | Projet Supabase de staging (Settings → API → URL) |
| `SUPABASE_ANON_KEY_TEST` | `test` | Projet Supabase de staging (Settings → API → anon public key) |
| `SUPABASE_SERVICE_ROLE_KEY_TEST` | `test` | Projet Supabase de staging (Settings → API → service_role — secret) |
| `SNYK_TOKEN` | `security` | https://app.snyk.io → Account settings → API token |
| `CODECOV_TOKEN` | `test` | https://app.codecov.io/gh/<org>/<repo>/settings (repo upload token) |
| `LHCI_GITHUB_APP_TOKEN` | `lighthouse` | https://github.com/apps/lighthouse-ci → install sur le repo → token affiché |
| `CHROMATIC_PROJECT_TOKEN` | `chromatic` | https://www.chromatic.com → projet → Manage → Project Token |
| `SLACK_WEBHOOK_URL` | `link-check` | Slack workspace → Apps → Incoming Webhooks → URL canal `#kovas-alerts` |
| `VERCEL_TOKEN` | (optionnel — si déploiement géré par GHA) | https://vercel.com/account/tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | `build`, `e2e` | Idem `SUPABASE_URL_TEST` (build placeholder si absent) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `build`, `e2e` | Idem `SUPABASE_ANON_KEY_TEST` (build placeholder si absent) |

`GITHUB_TOKEN` est fourni automatiquement par GitHub Actions — pas besoin de le configurer.

**Total** : **10 secrets à configurer manuellement** (+ 2 NEXT_PUBLIC_* optionnels avec placeholder).

---

## 4. Branch protection rules — `main`

À appliquer manuellement dans **Settings → Branches → Branch protection rules → Add rule** pour la branche `main` :

### Required status checks (must pass before merging)

- [x] `static` (Static analysis)
- [x] `security` (Security audit)
- [x] `test` (Unit tests + coverage)
- [x] `build` (Build web app)
- [x] `e2e` (E2E tests)
- [x] `lighthouse` (Lighthouse CI)
- [x] `a11y` (Accessibility tests)

`chromatic` n'est PAS bloquant (lancé PR uniquement, ne tourne pas sur push direct sur main).

### Autres règles

- [x] **Require branches to be up to date before merging**
- [x] **Require pull request reviews before merging** : 1+ reviewer requis
- [x] **Require linear history** (pas de merge commits — squash & merge ou rebase uniquement)
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings** (s'applique aussi aux admins)
- [ ] Allow force pushes : **désactivé**
- [ ] Allow deletions : **désactivé**

---

## 5. Procédure incident — CI bloquée

### Cas 1 : Faux positif security / lint

1. Documenter dans l'issue GitHub liée.
2. Si Semgrep / Snyk : ajouter règle d'exclusion dans `.semgrep.yml` ou `.snyk` avec **justification écrite et expiration** (30 jours max).
3. Si Biome / Knip : ajouter `// biome-ignore` ou config Knip locale.
4. Re-run le workflow et merge normalement.

### Cas 2 : Flake test E2E / Playwright

1. Re-run le job échoué (bouton "Re-run failed jobs" dans l'UI GitHub).
2. Si 3 re-runs successifs échouent → ne pas merger, investiguer.
3. Si test est connu flaky : ouvrir issue `flaky-test` et merger uniquement si critique production.

### Cas 3 : Force merge admin (dernier recours)

**Conditions strictes** :

- Production en panne / incident critique (P0/P1)
- Fix immédiat documenté + testé localement
- Aucune autre option (le fix doit lui-même corriger la CI)
- **Justification écrite obligatoire** dans le commit + commentaire PR
- Issue post-mortem à ouvrir dans les 24h

**Procédure** :

1. Admin GitHub coche temporairement "Do not allow bypassing the above settings" → décoche.
2. Merge via "Merge without waiting for requirements".
3. Re-coche immédiatement après merge.
4. Ouvrir issue post-mortem avec template `incident-postmortem.md`.

---

## 6. Évolutions prévues

- **M3** : merger `ci.yml` legacy dans `quality.yml`.
- **M5** : ajouter job `deploy-preview` (Vercel preview deploys via `VERCEL_TOKEN`).
- **M6** : ajouter job `mutation-testing` (Stryker) en `schedule.yml` hebdomadaire.
- **M9** : ajouter job `load-test` (k6 / Artillery) pré-bêta privée.
- **M10** : ajouter job `dast-full` (ZAP full scan vs baseline) avant cert ADEME.
