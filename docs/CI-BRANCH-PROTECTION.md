# GitHub Branch Protection — `main`

> **Couche 1 industrialisation qualité KOVAS** — configuration à appliquer manuellement sur GitHub
> Repository : `kovas-app` · Branche cible : `main`

## Pourquoi

Empêcher tout code défaillant d'arriver sur `main`. Tout PR doit passer un quartet de status checks **avant** merge, et personne (même admin) ne pousse directement sur `main`.

## Configuration à appliquer

### 1. `Settings → Branches → Branch protection rules → Add rule`

**Branch name pattern** : `main`

### 2. Cases à cocher

- [x] **Require a pull request before merging**
  - [x] Require approvals : **1 minimum**
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (si `CODEOWNERS` configuré)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - **Status checks required** (à activer dans CI workflow d'abord pour qu'ils apparaissent) :
    - `typecheck` (sortie de `pnpm --filter @kovas/web typecheck`, EXIT 0)
    - `biome` (sortie de `pnpm biome check .`, EXIT 0 ou warnings-only configurable)
    - `knip` (sortie de `pnpm knip`, EXIT 0 — bloquant uniquement files + exports + types + duplicates)
    - `tests` (sortie de `pnpm -r run test`, EXIT 0)

- [x] **Require conversation resolution before merging**

- [x] **Require signed commits** (recommandé, optionnel)

- [x] **Require linear history** (no merge commits, rebase only)

- [x] **Do not allow bypassing the above settings**
  - **Inclure administrators** (force Benjamin lui-même à passer par PR)

- [ ] Allow force pushes : **désactivé**
- [ ] Allow deletions : **désactivé**

### 3. GitHub Actions workflow correspondant

Le fichier `.github/workflows/ci.yml` doit déclarer les 4 jobs ci-dessus pour qu'ils apparaissent dans la liste des status checks disponibles. Squelette à créer en Couche 2 (CI/CD).

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @kovas/web typecheck

  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check .

  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm knip

  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r run test --if-present
```

## Vérification après application

```bash
gh api repos/:owner/kovas-app/branches/main/protection | jq '.required_status_checks.contexts'
# Doit retourner : ["typecheck", "biome", "knip", "tests"]
```

## Procédure d'urgence (hotfix prod)

En cas de bug critique en prod nécessitant un push direct (jamais en mode normal) :

1. Branche `hotfix/<sujet>` depuis `main`
2. Fix + push branche
3. PR ouverte avec label `hotfix` (skip review possible via override `CODEOWNERS` si critique)
4. Merge en `squash` only
5. Post-mortem obligatoire dans `/docs/incidents/`

**Aucun cas justifiable de bypass complet** des status checks `typecheck` + `biome` — un bug TS ou lint ne devrait jamais arriver en prod.
