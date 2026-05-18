# KOVAS — Setup Cursor pour démarrer le dev

> Guide step-by-step pour configurer Cursor + lancer le sprint MVP 14j.

## 1. Installer pnpm (1 commande sudo, une fois)

```bash
sudo corepack enable
corepack prepare pnpm@latest --activate
```

Vérifie : `pnpm --version` doit retourner `9.x.x` ou supérieur.

## 2. Cloner ou ouvrir le projet dans Cursor

Le projet est déjà créé dans `/Users/benjaminbel/Desktop/KOVAS/`.

```bash
cd ~/Desktop/KOVAS
cursor .
```

Cursor charge automatiquement :
- `.cursorrules` (legacy, always-on)
- `.cursor/rules/*.mdc` (4 règles modernes : always-context, typescript-strict, design-system, avatar-tone, supabase-rls)
- `.cursorignore`
- `.vscode/settings.json` (Biome formatter, Tailwind autocomplete, etc.)
- `.vscode/extensions.json` (suggère 15 extensions utiles)

**Recommandé** : installe les extensions suggérées au premier ouverture (popup Cursor).

## 3. Installer les dépendances

```bash
pnpm install
```

Durée : 2-5 minutes. Va installer ~800 packages (Next.js 15, React 19, Supabase, Anthropic SDK, Konva, Dexie, etc.).

## 4. Créer le projet Supabase

1. Va sur https://supabase.com/dashboard
2. Crée un nouveau project :
   - Name : `kovas-prod`
   - Region : **eu-west-3 (Paris)** (impératif RGPD + latence FR)
   - Plan : **Free** (passage Pro à M2-M5)
3. Récupère les credentials :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (BACKEND ONLY)
4. Active extensions PostgreSQL dans Supabase Studio :
   - `uuid-ossp`, `pgcrypto`, `postgis`, `pg_trgm`, `vector`

## 5. Lier le projet Supabase local

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <YOUR_PROJECT_REF>
```

`<YOUR_PROJECT_REF>` = subdomain de l'URL Supabase (ex: `https://abcdefghij.supabase.co` → `abcdefghij`).

## 6. Push la migration initiale

```bash
pnpm exec supabase db push
```

Cela applique le schéma complet (20 tables + RLS multi-tenant + triggers audit + helpers SECURITY DEFINER).

**Vérifie dans Supabase Studio** :
- Tables : 20 visibles dans `public`
- Auth → Triggers : `on_auth_user_created` actif
- Database → Functions : `auth.is_member_of`, `next_reference`, `audit_table_changes`, `handle_new_user`, `block_events_mutation`, `update_updated_at`

## 7. Générer les types TypeScript

```bash
pnpm db:gen-types
```

Cela remplace `packages/database/src/types.ts` (placeholder) par les vrais types générés depuis ton schema.

## 8. Configurer `.env.local`

```bash
cp .env.example .env.local
```

Renseigne au minimum (les autres viendront au fil du sprint) :

```env
NEXT_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Pour J5-J6 (Whisper + Claude)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## 9. Configurer SMTP custom Resend dans Supabase Auth

Supabase Studio → Authentication → SMTP Settings :

- Sender email : `noreply@kovas.fr`
- Sender name : `KOVAS`
- Host : `smtp.resend.com`
- Port : `465`
- Username : `resend`
- Password : `<RESEND_API_KEY>`

Cela évite les emails Supabase default (mauvaise délivrabilité).

## 10. Lancer le dev server

```bash
pnpm dev
```

Ouvre `http://localhost:3000` — tu dois voir la landing page KOVAS sobre.

## 11. Activer Realtime sur les tables business (Supabase Studio)

Database → Replication → enable Realtime sur :
- `missions`
- `photos`
- `voice_notes`
- `equipment_findings`
- `mission_rooms`

Sans ça, la sync mobile/web temps réel ne marche pas (Task J9).

## 12. Initialiser Git

```bash
git init
git add .
git commit -m "feat: initial monorepo + Supabase schema + Next.js 15 PWA scaffold

- pnpm workspaces (apps/web + packages/shared/database/ai/liciel-bridge + services/mdb-writer)
- Supabase migration 20 tables + RLS multi-tenant + audit triggers
- Next.js 15 PWA (Serwist + manifest + layout + theme-provider + query-provider)
- Add to Home Screen modal (iOS persistence)
- IndexedDB Dexie offline DB
- Glassmorphism Premium Soft UI design tokens (light/dark)
- TypeScript strict (zero any) + Biome linting + GitHub Actions CI
- Cursor rules + VSCode settings

Refs: Modifications 17-19 (PWA-only, MVP 10 features, avatar client + Gain Tracker)"

# Crée le repo GitHub d'abord (https://github.com/new) sous org nexus-1993-kovas
git branch -M main
git remote add origin git@github.com:nexus-1993-kovas/kovas-app.git
git push -u origin main
```

---

# Comment utiliser Cursor efficacement avec KOVAS

## Pattern 1 — Commencer une feature

**Toi** : *"Implémente la feature X. Suis CLAUDE.md et avatar-client."*

**Cursor (Claude Sonnet 4.6 ou Opus 4.7)** :
1. Lit automatiquement `.cursorrules` + `.cursor/rules/*.mdc` (toujours)
2. Lit CLAUDE.md, docs/avatar-client.md, et autres authority docs si pertinent
3. Propose un plan
4. Implémente progressivement

## Pattern 2 — Comparer 2 implémentations

**Toi** : *"Montre-moi 2 approches pour gérer la queue offline mutations : (1) Dexie outbox + manual sync, (2) PowerSync managed sync."*

Cursor te montre les 2 approches avec pros/cons, tu choisis.

## Pattern 3 — Refactoring guidé

**Toi** : *"Ce composant est trop gros (200 lignes). Découpe-le en sous-composants logiques, en respectant nos règles design-system."*

Cursor refactore en respectant Tailwind tokens KOVAS, palette, anti-patterns, etc.

## Pattern 4 — Génération de tests

**Toi** : *"Génère des tests Vitest pour `parseWithCustomJs()` en `packages/ai/src/voice-structurer.ts`. Cas standards + edge cases."*

Cursor génère tests exhaustifs avec assertions précises.

## Pattern 5 — Migration SQL

**Toi** : *"Ajoute une migration pour la table `voice_note_corrections` (auto-apprentissage personnalisation utilisateur). Cf. ai-autonomy-strategy.md §9."*

Cursor lit la doc, génère la migration SQL avec RLS policies cohérentes, suit les patterns de la migration initiale.

## Pattern 6 — Debug

**Toi** : *"Cette erreur RLS Supabase : `new row violates row-level security policy for table missions`. Diagnose."*

Cursor lit la migration + supabase-rls.mdc + propose les hypothèses (organization_id mismatch, membership inactive, etc.) et la fix.

## Pattern 7 — Strict mode

**Toi** : *"Tu as utilisé `any` ligne 42 du fichier X. Refonds en strict zero-any."*

Cursor remplace par `unknown` + narrow type via Zod schema, ou par le type spécifique.

---

# Anti-patterns Cursor (à éviter)

- ❌ Demander à Cursor d'implémenter une feature reportée V2 (Vision IA, croquis Pencil, etc.) — il dira non vu `.cursorrules`
- ❌ Demander un texte UI gaming/festif — il sera bloqué par `.cursor/rules/avatar-tone.mdc`
- ❌ Donner accès à `service_role` key dans un composant client — `.cursor/rules/supabase-rls.mdc` l'interdira
- ❌ Utiliser `any` TypeScript — `.cursor/rules/typescript-strict.mdc` l'interdira
- ❌ Ajouter Apple Developer ou RN+Expo — différé V2 dans `.cursorrules`

# Commandes utiles dans Cursor

| Raccourci | Action |
|---|---|
| **Cmd+K** | Edit inline (modifier sélection avec prompt) |
| **Cmd+L** | Chat panel (conversation pair-programming) |
| **Cmd+I** | Composer mode (multi-file edits) |
| **Cmd+Shift+P** | Command palette |
| **Cmd+P** | Quick file open |
| **Cmd+Shift+F** | Search global |
| **Cmd+;** | Toggle Cursor agent mode (recommended pour features complexes) |

---

# Sprint MVP 14j — Workflow recommandé avec Cursor

## Avant chaque jour

1. Ouvre [`planning-14-jours.md`](.claude/orchestration-kovas-app/planning-14-jours.md) → identifie la tâche du jour
2. Ouvre la task file détaillée si dispo (ex : `tasks/phase-1/task-1-1.md`)
3. Dans Cursor Composer (Cmd+I) :
   > *"Aujourd'hui c'est J<N>. Implémente la tâche selon planning-14-jours.md + task-X-Y.md. Respecte CLAUDE.md + avatar-client.md."*

## Pendant le dev

- Utilise Cmd+K sur des sélections pour des modifs rapides
- Utilise Cmd+L pour des questions architecturales
- Vérifie `pnpm typecheck` + `pnpm lint` régulièrement
- Commit fréquent (toutes les ~30 min d'avancée) avec Conventional Commits

## Fin de chaque jour

1. **Tests** :
   - `pnpm typecheck` → vert
   - `pnpm lint` → vert
   - `pnpm dev` → app fonctionne sans crash
   - Pour J7 et J14 : démo terrain réelle sur iPad
2. **Commit + push** :
   ```bash
   git add .
   git commit -m "feat(J<N>): <description>"
   git push
   ```
3. **Update PROGRESS.md** (si créé) : marque la tâche `completed`

---

# En cas de blocage

Si Cursor n'arrive pas à résoudre :

1. **Identifier le contexte manquant** : Cursor a-t-il lu le bon document authority ?
2. **Si oui** : pose-toi la question si la décision dépasse le scope MVP V1 (souvent oui)
3. **Si décision majeure nécessaire** : reviens vers Claude Code (moi) pour update des docs authority avant de coder

## Cas où revenir vers Claude Code (moi)

- Décision pricing / business
- Refonte produit (Modification N+1)
- Conflit entre authority documents
- Question stratégique long-terme (Phase 2/3/4)
- Doute sur le respect avatar client

## Cas où rester dans Cursor

- Implémentation code
- Bugs / debugging
- Refactoring
- Tests
- Migrations SQL standards
- UI / composants
- Optimisation perf
