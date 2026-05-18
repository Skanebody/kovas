# Task 1.1 : Setup monorepo pnpm + workspaces (Sprint J1)

## Objective

Créer le monorepo pnpm avec la structure `apps/{mobile,web}`, `packages/{shared,database,ai,liciel-bridge}`, `services/mdb-writer` + branch protection `main` + CI GitHub Actions de base (lint + typecheck).

## Context

**Première task du Sprint MVP 14j**, démarre J1. Sans monorepo bien structuré, le sprint dégénère en cycles de fix entre packages. Le pnpm workspaces permet le partage de types TypeScript stricts entre mobile et web.

## Dependencies

- Task 0.1 (GitHub Nexus 1993 org + repo `kovas-app` créé)

## Blocked By

- Task 0.R (Phase 0 Regression validée → GO Phase 1 Sprint MVP)

## Research Findings

- De `research/mobile-stack.md` §1 + §7 : Expo SDK 52 production-ready, NativeWind 4 stable, expo-router 4 strongly recommended
- De `research/supabase-architecture.md` §10 : Supabase CLI workflow `supabase/migrations/` + `supabase gen types`
- De `CLAUDE.md` §11 : structure monorepo cible précise

## Implementation Plan

### Step 1 : Init monorepo pnpm

```bash
cd ~/Code/kovas-app
git init
git remote add origin git@github.com:nexus-1993-kovas/kovas-app.git

# pnpm install
corepack enable
corepack prepare pnpm@latest --activate

# Init package.json root
pnpm init
```

`package.json` root :

```json
{
  "name": "kovas-app",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "services/*"],
  "scripts": {
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test",
    "build": "pnpm -r run build"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "prettier": "^3.3.0",
    "eslint": "^9.0.0",
    "@biomejs/biome": "^1.9.0"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

`pnpm-workspace.yaml` :

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

### Step 2 : Structure dossiers

```bash
mkdir -p apps/{mobile,web}
mkdir -p packages/{shared,database,ai,liciel-bridge}
mkdir -p services/mdb-writer
mkdir -p supabase/{migrations,functions}
mkdir -p docs/{legal,discovery,team,crisis-comms,runbooks,checkpoints,credentials-setup}
mkdir -p tests/e2e
```

### Step 3 : Configuration TypeScript strict racine

`tsconfig.json` (root, base partagée) :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  }
}
```

Chaque package étend cette base avec son propre `tsconfig.json`.

### Step 4 : Package `packages/shared` (types + utilitaires)

```bash
cd packages/shared
pnpm init -y
```

`packages/shared/package.json` :

```json
{
  "name": "@kovas/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.23.0",
    "date-fns": "^4.0.0",
    "libphonenumber-js": "^1.11.0"
  }
}
```

`packages/shared/src/index.ts` :

```typescript
// Re-exports tous les modules
export * from './types/mission'
export * from './types/client'
export * from './types/property'
export * from './formats/money'
export * from './formats/date'
export * from './formats/phone'
```

`packages/shared/src/types/mission.ts` (squelette) :

```typescript
import { z } from 'zod'

export const MissionTypeEnum = z.enum([
  'dpe_vente', 'dpe_location', 'audit_energetique', 'copropriete',
])
export type MissionType = z.infer<typeof MissionTypeEnum>

export const MissionStatusEnum = z.enum([
  'draft', 'scheduled', 'in_progress', 'to_review', 'done',
  'exported', 'archived', 'cancelled',
])
export type MissionStatus = z.infer<typeof MissionStatusEnum>

export interface Mission {
  id: string
  organizationId: string
  propertyId: string
  clientId?: string
  reference: string
  type: MissionType
  status: MissionStatus
  scheduledAt?: Date
  completedAt?: Date
  // ... extended Task 1.2
}
```

`packages/shared/src/formats/money.ts` (conventions D310 stockage centimes integer) :

```typescript
import { z } from 'zod'

export const PriceCents = z.number().int().nonnegative()

export function formatPriceEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function parseEUR(input: string): number {
  // "59,00 €" → 5900
  const cleaned = input.replace(/[€\s]/g, '').replace(',', '.')
  return Math.round(parseFloat(cleaned) * 100)
}
```

### Step 5 : Packages stubs (vide mais prêt pour Tasks suivantes)

Créer `package.json` minimaux pour :

- `packages/database/package.json` (sera complété Task 1.2)
- `packages/ai/package.json` (sera complété Task 2.3)
- `packages/liciel-bridge/package.json` (sera complété Task 4.2)
- `services/mdb-writer/build.gradle` (Java/Jackcess, complété Task 4.2)

### Step 6 : Configuration Biome (lint + format unifié)

`biome.json` (root) :

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": false },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "style": { "useNamingConvention": "warn" }
    }
  }
}
```

### Step 7 : `.env.example` complet (extension de Task 0.1)

Compléter `.env.example` avec toutes les variables d'env requises (mises à jour au fil des tasks).

### Step 8 : `.gitignore` racine

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
.expo/
*.tsbuildinfo

# Env files
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Sentry
.sentryclirc

# Liciel discovery log fixtures (NEVER COMMIT)
kovas-discovery-log/

# EAS Build credentials
credentials.json

# Java services
services/mdb-writer/.gradle/
services/mdb-writer/build/
```

### Step 9 : GitHub Actions CI base

`.github/workflows/ci.yml` :

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
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
```

### Step 10 : Branch protection `main`

Via GitHub UI ou `gh` CLI :

```bash
gh api -X PUT /repos/nexus-1993-kovas/kovas-app/branches/main/protection \
  -F required_status_checks[strict]=true \
  -F required_status_checks[contexts][]=typecheck \
  -F required_status_checks[contexts][]=lint \
  -F enforce_admins=true \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F required_pull_request_reviews[dismiss_stale_reviews]=true \
  -F restrictions=null
```

Note : `required_approving_review_count=0` car solo founder (pas de reviewer). Mais CI verte obligatoire.

### Step 11 : Commit initial + push

```bash
git add .
git commit -m "Task 1.1: Initialize monorepo structure with pnpm workspaces

- pnpm workspaces (apps, packages, services)
- TypeScript strict config racine
- @kovas/shared package with Zod types
- Biome linting + formatting
- GitHub Actions CI (typecheck + lint)
- Branch protection main

Refs: CLAUDE.md §11, DISCOVERY.md Paquet 11"

git branch -M main
git push -u origin main
```

## Files to Create

- `package.json` (root)
- `pnpm-workspace.yaml`
- `tsconfig.json` (root)
- `biome.json`
- `.gitignore`
- `.env.example` (extension)
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/types/{mission,client,property}.ts`
- `packages/shared/src/formats/{money,date,phone}.ts`
- `packages/database/package.json` (stub)
- `packages/ai/package.json` (stub)
- `packages/liciel-bridge/package.json` (stub)
- `services/mdb-writer/build.gradle` (stub)
- `.github/workflows/ci.yml`

## Files to Modify

- Aucun (initial commit)

## Contracts

### Provides (for downstream tasks)

- **Package `@kovas/shared`** : types TypeScript partagés mobile+web, conventions formats régionaux (D310)
- **CI green requirement** : toute task downstream doit passer typecheck + lint pour merger sur `main`
- **`.env.example`** : template à étendre pour chaque service intégré

## Acceptance Criteria

- [ ] `pnpm install` réussit sans erreur depuis fresh clone
- [ ] `pnpm typecheck` passe (zéro `any`, strict mode)
- [ ] `pnpm lint` passe (Biome strict)
- [ ] Branch `main` protégée : CI verte requise pour merge
- [ ] GitHub Actions CI : typecheck + lint sur PR
- [ ] Structure dossiers conforme CLAUDE.md §11
- [ ] Commit initial signé GPG (si Benjamin a configuré GPG sur ce repo aussi — pas obligatoire vs repo discovery-log)

## Testing Protocol

### Build/Lint/Type Checks

- [ ] `pnpm install` réussit
- [ ] `pnpm -F @kovas/shared run typecheck` passe
- [ ] `pnpm typecheck` (root) passe
- [ ] `pnpm lint` passe
- [ ] CI GitHub Actions verte sur PR test

### Smoke test

- Cloner repo dans dossier tempo, `pnpm install`, `pnpm typecheck`, `pnpm lint` → tout passe sans config supplémentaire

## Skills to Read

- Aucune skill formelle. Lire `CLAUDE.md` §10 (contraintes techniques) + §11 (structure monorepo).

## Research Files to Read

- `research/mobile-stack.md` §1 (Expo SDK)
- `research/supabase-architecture.md` §10 (workflow Supabase CLI)

## Git

- Branch : `feature/1-1-monorepo-init`
- Commit message prefix : `Task 1.1:`
- PR target : `main`
- **Important** : première PR du repo, valide la branch protection (test que CI bloque sans typecheck)

## Notes anti-pattern

- ⛔ Ne PAS utiliser npm ou yarn — pnpm workspaces locked dans CLAUDE.md
- ⛔ Ne PAS skipper TypeScript strict — zéro `any` non négociable
- ⛔ Ne PAS oublier `verbatimModuleSyntax: true` (cohérence imports type/value)
- ⛔ Ne PAS commiter `.env` (uniquement `.env.example`)
- ⛔ Ne PAS commiter le repo `kovas-discovery-log/` (jamais dans le repo principal)
- ⛔ Ne PAS skipper la branch protection main (= sécurité régressions)
