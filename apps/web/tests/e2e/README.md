# KOVAS Playwright E2E Tests

Suite de tests end-to-end couvrant les flux critiques V1 avant déploiement.

## Prérequis

1. **Serveur dev** (auto via `webServer` ou explicite) :
   ```bash
   cd apps/web && corepack pnpm dev
   ```
2. **Variables d'environnement** (`.env.local`) :
   - `NEXT_PUBLIC_SUPABASE_URL` — URL projet Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — clé service-role (admin) pour créer/supprimer les users de test
   - `NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1` — bypass validation SIRET Luhn pendant les tests
   - `OTP_DEV_MODE=true` — (optionnel, si OTP B2C implémenté un jour) expose le code dans la réponse pour assertion auto

3. **Browsers** :
   ```bash
   corepack pnpm exec playwright install chromium
   ```

## Commandes

| Commande | Description |
|---|---|
| `corepack pnpm test:e2e` | Run headless (defaut, CI) |
| `corepack pnpm test:e2e:ui` | UI mode interactif Playwright |
| `corepack pnpm test:e2e:headed` | Browser visible |
| `corepack pnpm exec playwright show-report` | Ouvrir le rapport HTML après run |

Cibler un autre environnement :
```bash
E2E_BASE_URL=https://preview-xyz.vercel.app corepack pnpm test:e2e
```

## Isolation et nettoyage

- Chaque test crée son user via `adminClient` (helper `createTestUser`) avec un email préfixé `e2e_test_…@example.com`.
- Cleanup automatique dans `afterEach` → suppression du user (cascade sur `profiles`, `organizations`, etc. via FK).
- Le SIRET utilisé pour les tests : `12345678900012` (placeholder de test) — nécessite `NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1`.

## Scénarios couverts (5 critiques V1)

| # | Fichier | Statut | Description |
|---|---|---|---|
| 1 | `signup-onboarding.spec.ts` | ✅ Actif | Signup B2B + redirect `/app/onboarding` |
| 2 | `b2c-quote-otp.spec.ts` | ⏭️ Skipped | Annuaire B2C / OTP — non implémenté en V1 |
| 3 | `claim-workflow.spec.ts` | ⏭️ Skipped | Claim diagnostician — non implémenté en V1 |
| 4 | `pricing-checkout.spec.ts` | ✅ Actif | Navigation /pricing + CTA vers /signup |
| 5 | `sidebar-track-access.spec.ts` | ✅ Actif | Sidebar après login (6 items NAV_MAIN) |

Les tests 2 et 3 portent sur des features mentionnées dans le brief mais absentes du codebase actuel (annuaire diagnostiqueurs B2C, OTP SMS, claim workflow). Ils restent en place comme TODO documentés (`test.skip()` avec note).

## Convention

- Préfixe email : `e2e_test_<timestamp>_<rand>@example.com`
- SIRET test : `12345678900012` (via dev bypass)
- Mot de passe : `TestPass1234!`
- Toujours `await cleanupTestUser(email)` dans `afterEach`
