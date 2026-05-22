# KOVAS — Stratégie de test (couches 2 + 6 industrialisation qualité)

Ce document décrit la pyramide de tests de l'application KOVAS et fournit les
commandes essentielles pour les exécuter en local et en CI.

---

## 1. Pyramide

```
        ▲    E2E + axe-core a11y         ~30 tests Playwright + 6 specs axe
       ▲▲▲   Visual regression           Storybook + Chromatic (4 viewports)
      ▲▲▲▲▲  Tests d'intégration         Vitest + jsdom + mocks Supabase
     ▲▲▲▲▲▲▲ Tests unitaires             Vitest (lib/, hooks, parsers)
    ▲▲▲▲▲▲▲▲ TypeScript strict + Biome   (couche 1, déjà en place)
```

Cibles de couverture (Vitest, seuils CI) :

| Métrique     | Seuil minimal | Cible |
|--------------|---------------|-------|
| `lines`      | 70 %          | 80 %  |
| `functions`  | 70 %          | 80 %  |
| `branches`   | 65 %          | 75 %  |
| `statements` | 70 %          | 80 %  |

Le coverage `v8` est généré via `pnpm test:unit:coverage` et publié au format
`text` + `html` + `lcov` + `json-summary` dans `apps/web/coverage/`. Le rapport
HTML est consommé par les checks de PR ; le `lcov.info` peut être uploadé sur
Codecov / Coveralls si activé en CI.

---

## 2. Tests unitaires & intégration (Vitest, couche 2)

### Configuration

- `apps/web/vitest.config.ts` — env jsdom, alias `@`, coverage v8
- `apps/web/vitest.setup.ts` — mocks `next/navigation`, `next/headers`,
  Supabase, `matchMedia`, `ResizeObserver`, polyfills `TextEncoder`/`crypto`

### Commandes

```bash
pnpm --filter @kovas/web test:unit           # run unique
pnpm --filter @kovas/web test:unit:watch     # mode watch (dev)
pnpm --filter @kovas/web test:unit:coverage  # avec rapport coverage v8
```

### Conventions

- Les tests vivent à côté du code testé : `foo.ts` ↔ `foo.test.ts`.
- Pour les composants client React, utilisez `@testing-library/react` +
  `@testing-library/user-event`, déjà chargés dans le setup global.
- Mocks Supabase : par défaut les chaînes Postgrest renvoient `[]` / `null`.
  Surchargez localement via `vi.mocked(createBrowserClient).mockReturnValueOnce(...)`.
- Avatar Benjamin Bel : vouvoiement dans les commentaires, ton sobre dans les
  messages d'erreur.

---

## 3. Tests RLS Supabase (couche 2, sous-suite dédiée)

Les politiques RLS sont la dernière ligne de défense en cas de bug applicatif.
On vérifie pour chaque table sensible :

1. `userA` voit bien ses propres lignes.
2. `userB` ne voit AUCUNE ligne de l'org de `userA`.
3. Un client anonyme ne voit rien.
4. (selon table) `userB` ne peut pas écrire dans l'org de `userA`.

### Tables couvertes

`missions`, `dossiers`, `clients`, `properties`, `subscriptions`, `user_addons`,
`quotes`, `invoices`, `client_photo_requests`, `pre_export_analyses`,
`audit_data_access`.

### Commandes

```bash
pnpm --filter @kovas/web test:rls
```

### Pré-requis env

Les tests RLS se branchent sur un vrai projet Supabase (local ou cloud) et
nécessitent :

```
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1
```

Si les variables manquent (CI sans secrets, dev sans projet branché), les suites
sont automatiquement `describe.skip()` — pas d'échec dur.

---

## 4. Tests E2E Playwright (couche 6)

30 specs critiques couvrant le funnel utilisateur de bout en bout. Pour chaque
mutation backend (Stripe, Brevo, BAN, Sirene), les routes externes sont mockées
via `page.route()` pour rendre les tests déterministes et offline-friendly.

### Tests créés

| Spec                                  | Couvre                                                        |
|---------------------------------------|---------------------------------------------------------------|
| `onboarding.spec.ts`                  | Signup B2B → pricing → choix tier → Stripe Setup Intent       |
| `login.spec.ts`                       | Login OK + échec + reset password                              |
| `mission-capture-offline.spec.ts`     | Saisie offline → queue Dexie → resync online                  |
| `mission-validation.spec.ts`          | Validation dossier ouvre pré-export                            |
| `pre-export-panel.spec.ts`            | Score affiché, bouton "Exporter quand même" actif              |
| `export-liciel.spec.ts`               | Téléchargement XML Liciel déclenché                            |
| `dossier-create.spec.ts`              | Wizard création dossier 3 étapes                               |
| `client-create.spec.ts`               | Création client + lookup SIRET mocké                            |
| `property-create.spec.ts`             | Création bien + BAN autocomplete mockée                         |
| `sms-compose.spec.ts`                 | Compose SMS, validation E.164, envoi Brevo mocké                |
| `email-compose.spec.ts`               | Compose email, envoi via API interne                            |
| `ai-assistant-dossier.spec.ts`        | Sheet IA, streaming SSE Claude mocké                            |
| `quote-create.spec.ts`                | Création devis                                                  |
| `invoice-create.spec.ts`              | Page factures                                                   |
| `invoice-mark-paid.spec.ts`           | Action "marquer payée"                                          |
| `subscription-trial-expired.spec.ts`  | Trial expiré → redirect /account?expired=1                      |
| `subscription-cancel.spec.ts`         | Workflow résiliation décret 2023-417                            |
| `rgpd-export.spec.ts`                 | Export RGPD 1 clic                                              |
| `rgpd-delete.spec.ts`                 | Zone danger suppression de compte                                |
| `responsive-mobile.spec.ts`           | Viewport Pixel 5 (project mobile-chrome)                        |
| `responsive-tablet.spec.ts`           | Viewport iPad Pro 11 (project tablet)                            |
| `nav-cmd-k.spec.ts`                   | Palette Cmd+K / Ctrl+K                                          |
| `nav-sidebar-modules.spec.ts`         | Items sidebar selon plan                                        |
| `gallery-fullscreen.spec.ts`          | Galerie photos fullscreen (clavier + ESC)                       |
| `map-property-interactive.spec.ts`    | Carte Leaflet + marker                                          |
| `dpe-checklist-tracker.spec.ts`       | Checklist tracker DPE                                            |
| `proactive-suggestion-amiante.spec.ts`| Bien <1997 → suggestion amiante                                  |
| `checkout-screen.spec.ts`             | Écran de sortie mission                                          |
| `request-client-photo.spec.ts`        | Workflow SMS récupération photo                                 |
| `health-endpoint.spec.ts`             | GET /api/health retourne 200 / 503                              |

### Projects

| Project              | Devices                | Tests inclus                                  |
|----------------------|------------------------|-----------------------------------------------|
| `chromium-desktop`   | Desktop Chrome 1280×720| toute la suite (par défaut)                   |
| `webkit-desktop`     | Desktop Safari         | suite `critical-*.spec.ts` seulement          |
| `firefox-desktop`    | Desktop Firefox        | suite `critical-*.spec.ts` seulement          |
| `mobile-chrome`      | Pixel 5                | specs `*.mobile.spec.ts` + responsive-mobile  |
| `mobile-safari`      | iPhone 13              | specs `*.mobile.spec.ts`                      |
| `tablet`             | iPad Pro 11            | responsive-tablet + `*.tablet.spec.ts`        |
| `a11y`               | Desktop Chrome         | suite `tests/e2e/a11y/`                       |

### Commandes

```bash
pnpm --filter @kovas/web test:e2e                            # tous projects desktop
pnpm --filter @kovas/web test:e2e -- --project=mobile-chrome  # mobile uniquement
pnpm --filter @kovas/web test:e2e:ui                         # UI interactive
pnpm --filter @kovas/web test:a11y                           # suite a11y uniquement
```

### Fixtures

- `tests/e2e/fixtures/auth.ts` — `loginAs()`, `signupViaUi()`
- `tests/e2e/fixtures/supabase-admin.ts` — `createTestUser()`, `cleanupTestUser()`,
  `cleanupAllTestUsers()` (filet de sécurité)

Chaque test crée son user via `createTestUser()` et le supprime via
`cleanupTestUser()` en `afterEach` — pas d'accumulation d'orphelins.

---

## 5. Accessibilité — axe-core (couche 6)

6 pages cibles vérifient l'absence de violations WCAG 2.1 AA :

- `home.a11y.spec.ts` — landing page publique
- `pricing.a11y.spec.ts` — page Pricing KOVAS 360
- `signup.a11y.spec.ts` — formulaire B2B
- `dashboard.a11y.spec.ts` — vue authentifiée principale
- `mission.a11y.spec.ts` — page dossiers
- `validation.a11y.spec.ts` — page factures/validation

La règle `color-contrast` est temporairement désactivée le temps que les tokens
sage / chartreuse soient audités pour AA (issue qualité ouverte). Toutes les
autres règles `wcag2a` / `wcag2aa` / `wcag21aa` doivent passer en zéro violation.

---

## 6. Storybook + Chromatic (couche 6 — régression visuelle)

10 stories couvrant les composants critiques V5 :

| Story                              | Variantes                                            |
|------------------------------------|------------------------------------------------------|
| `PreExportPanel`                   | Score 95 / 60 / 35 + ManyFindings                    |
| `CheckoutScreen`                   | AllComplete / MissingCritical / MissingPhotos        |
| `ChecklistPanel`                   | Empty / Partial / Complete                           |
| `KpiHero`                          | Default / TrendUp / TrendDown / Featured / Naked     |
| `StatusPill`                       | 5 variantes (blue / amber / green / coral / muted)   |
| `DiagnosticChip`                   | 8 types (DPE / AMIANTE / PLOMB / GAZ / ELEC / ...)   |
| `Button`                           | 7 variantes × 4 tailles + with-icons                 |
| `TrialBanner`                      | Standard / SoonExpiring / Volume                     |
| `Toast`                            | Playground (Sonner + 4 variants)                     |
| `CommandK`                         | Default (Cmd+K activé)                                |

Viewports Chromatic : **360 / 768 / 1280 / 1920**.

### Commandes

```bash
pnpm --filter @kovas/web storybook         # serveur dev :6006
pnpm --filter @kovas/web storybook:build   # build statique
pnpm --filter @kovas/web chromatic         # upload + diffs
```

### CI Chromatic

Le job CI doit injecter `CHROMATIC_PROJECT_TOKEN` en secret GitHub Actions. Le
`--exit-zero-on-changes` empêche les diffs visuels (non-régressions volontaires)
de casser le pipeline ; la revue se fait via l'UI Chromatic.

---

## 7. Commande agrégée

```bash
pnpm --filter @kovas/web test:all
# = unit + e2e + a11y
```

---

## 8. CI — workflow type

```yaml
- run: corepack pnpm install --frozen-lockfile
- run: corepack pnpm typecheck
- run: corepack pnpm --filter @kovas/web test:unit:coverage
- run: corepack pnpm --filter @kovas/web test:rls  # nécessite secrets Supabase
- run: corepack pnpm --filter @kovas/web exec playwright install --with-deps chromium
- run: corepack pnpm --filter @kovas/web test:e2e
- run: corepack pnpm --filter @kovas/web test:a11y
- run: corepack pnpm --filter @kovas/web storybook:build
- run: corepack pnpm --filter @kovas/web chromatic
```

---

## 9. Stratégie de croissance

- **Phase 1 (M1-M6)** : maintenir couverture > 70 % sur les modules critiques
  (`lib/billing/`, `lib/pre-export/`, `lib/smart-defaults/`, `lib/voice-parser/`).
- **Phase 2 (M6-M12)** : étendre les tests RLS à toutes les nouvelles tables
  ajoutées via migrations, ajouter mutation testing (`stryker-mutator` si pertinent).
- **Phase 3 (M12+)** : tests de charge sur `/api/voice/transcribe` (k6) +
  contract tests sur les passerelles export Liciel.
