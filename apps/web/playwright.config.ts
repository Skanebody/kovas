import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — KOVAS App E2E.
 *
 * Modes :
 * - Local : démarre `pnpm dev` automatiquement (webServer)
 * - CI / preview : utiliser E2E_BASE_URL pour cibler un serveur déjà lancé
 *
 * Lancement :
 *   pnpm test:e2e            (headless)
 *   pnpm test:e2e:ui         (UI mode)
 *   pnpm test:e2e:headed     (browser visible)
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Serialize tests for V1 — DB partagée avec dev (pas de test DB séparée)
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Activer le profil mobile uniquement pour les tests dédiés (tag @mobile)
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 7'] },
    //   testMatch: /.*\.mobile\.spec\.ts/,
    // },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'corepack pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
