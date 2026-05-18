# KOVAS App

> SaaS B2B PWA pour diagnostiqueurs immobiliers français — IA-first, focus 8 diagnostics standards (92% volume métier FR).

**Statut** : Phase 0 setup (M0, mai 2026). Sprint MVP V1 démarrage avril 2026.

## Authority documents

L'organisation du projet est structurée comme suit, en ordre d'autorité décroissant :

1. **[`CLAUDE.md`](CLAUDE.md)** (racine projet) — Document de référence pour Cursor + Claude Code en pair-programming
2. **[`docs/avatar-client.md`](docs/avatar-client.md)** — TON SOBRE PROFESSIONNEL obligatoire, JAMAIS gaming/lifestyle
3. **[`docs/modification-18-mvp-v1-extended.md`](docs/modification-18-mvp-v1-extended.md)** — Authority MVP V1 : 10 features cœur, 8 diagnostics, 3 modes export
4. **[`docs/gain-tracker-system.md`](docs/gain-tracker-system.md)** — Système V1.5 post-launch (compteur, statuts, rapport mensuel)
5. **[`docs/pwa-pivot-decision.md`](docs/pwa-pivot-decision.md)** — Authority pivot PWA-only Phase 1
6. **[`docs/ai-autonomy-strategy.md`](docs/ai-autonomy-strategy.md)** — Stratégie autonomisation IA 36 mois
7. **[`docs/credentials-setup/nexus-1993-identity.md`](docs/credentials-setup/nexus-1993-identity.md)** — Identité légale SASU Nexus 1993
8. **[`.claude/orchestration-kovas-app/DISCOVERY.md`](.claude/orchestration-kovas-app/DISCOVERY.md)** — Décisions Discovery validées (150+ décisions)
9. **[`.claude/orchestration-kovas-app/PRD.md`](.claude/orchestration-kovas-app/PRD.md)** — Product Requirements Document
10. **[`.claude/orchestration-kovas-app/PHASES.md`](.claude/orchestration-kovas-app/PHASES.md)** — Plan d'implémentation 8 phases / 45 tâches
11. **[`CURSOR_SETUP.md`](CURSOR_SETUP.md)** — Guide setup Cursor step-by-step

## Quick start

```bash
# 1. Install pnpm (Node 20+ requis)
sudo corepack enable
corepack prepare pnpm@latest --activate

# 2. Install dépendances
pnpm install

# 3. Configurer .env.local (copier depuis .env.example)
cp .env.example .env.local
# Renseigner les variables (cf. docs/credentials-setup/)

# 4. Lancer le dev server
pnpm dev
```

Cf. [CURSOR_SETUP.md](CURSOR_SETUP.md) pour les étapes complètes (Supabase setup, etc.).

## Structure monorepo

```
kovas-app/
├── apps/
│   └── web/                    # Next.js 15 PWA (iPad + iPhone + Web unifié)
├── packages/
│   ├── shared/                 # Types TypeScript, formats, utilitaires
│   ├── database/               # Client Supabase typé
│   ├── ai/                     # Wrappers Claude + Whisper + provider fallback
│   └── liciel-bridge/          # Schéma JSON + MDB writer + XML CII
├── services/
│   └── mdb-writer/             # Microservice Java/Jackcess (Linux Railway)
├── supabase/
│   ├── migrations/             # Schéma SQL versionné
│   └── functions/              # Edge Functions
├── tests/e2e/                  # Playwright E2E sur PWA
└── docs/                       # Documentation & decisions
```

## Stack technique (figée)

- **Frontend** : Next.js 15 App Router + TypeScript strict + Tailwind CSS + shadcn/ui + next-themes + next-intl
- **PWA** : Serwist (Service Worker), manifest.json, Add to Home Screen
- **Backend** : Supabase (eu-west-3 Paris) — PostgreSQL + Auth + Storage + Realtime + Edge Functions + RLS
- **IA** : Anthropic Claude (Haiku 4.5 voice + Sonnet 4.6 vision V2) + OpenAI Whisper `gpt-4o-mini-transcribe`
- **Payments** : Stripe Billing (SEPA + CB + Stripe Tax)
- **Offline** : Service Worker + IndexedDB Dexie
- **Annotations photos** : Konva.js + PointerEvents API (croquis 2D Apple Pencil = V2)
- **Hosting** : Vercel (Paris) + Railway (DocuSeal + MDB writer)
- **Monitoring** : Sentry + PostHog

## Commands utiles

```bash
pnpm dev                # Démarre apps/web sur localhost:3000
pnpm build              # Build production tous workspaces
pnpm typecheck          # TypeScript strict tous workspaces (zero any)
pnpm lint               # Biome check
pnpm lint:fix           # Biome auto-fix
pnpm format             # Biome format
pnpm test               # Tests unitaires
pnpm test:e2e           # Playwright E2E
pnpm db:gen-types       # Génère types TypeScript depuis schéma Supabase
pnpm db:migrate         # Push migrations vers Supabase
```

## Convention de commit

Conventional Commits — exemples :

- `feat(missions): add CRUD missions/clients/biens`
- `fix(voice): handle phone interruption during recording`
- `chore(deps): bump @supabase/supabase-js to 2.45.0`
- `docs(pricing): update Modification 18 pricing 3 tiers`
- `test(e2e): add signup → first mission flow`

## Licence

Propriétaire SASU Nexus 1993 (SIREN 982 786 154, D-U-N-S 281515446). Tous droits réservés.
