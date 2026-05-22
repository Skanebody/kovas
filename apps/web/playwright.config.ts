import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config — KOVAS App E2E + a11y (couche 6 industrialisation).
 *
 * Projects :
 *   - chromium-desktop  : Desktop Chrome 1280×720 (par défaut, suite principale)
 *   - webkit-desktop    : Safari desktop (verif rendu webkit)
 *   - firefox-desktop   : Firefox desktop
 *   - mobile-chrome     : Pixel 5 (375×851) — opt-in via testMatch *.mobile.spec.ts
 *   - mobile-safari     : iPhone 13 (390×844) — opt-in idem
 *   - tablet            : iPad Pro 11 — opt-in via testMatch *.tablet.spec.ts
 *   - a11y              : projet dédié WCAG 2.1 AA (axe-core)
 *
 * Lancement :
 *   pnpm test:e2e            (tous projects sauf opt-in)
 *   pnpm test:a11y           (suite axe-core seule)
 *   pnpm test:e2e -- --project=mobile-chrome (un project spécifique)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
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
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/.*\.mobile\.spec\.ts/, /.*\.tablet\.spec\.ts/, /\/a11y\//],
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
      testMatch: /critical-.*\.spec\.ts$/,
      testIgnore: [/.*\.mobile\.spec\.ts/, /.*\.tablet\.spec\.ts/, /\/a11y\//],
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /critical-.*\.spec\.ts$/,
      testIgnore: [/.*\.mobile\.spec\.ts/, /.*\.tablet\.spec\.ts/, /\/a11y\//],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /.*responsive-mobile\.spec\.ts$|.*\.mobile\.spec\.ts$/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      testMatch: /.*\.mobile\.spec\.ts$/,
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
      testMatch: /.*responsive-tablet\.spec\.ts$|.*\.tablet\.spec\.ts$/,
    },
    {
      name: 'a11y',
      use: { ...devices['Desktop Chrome'] },
      testDir: './tests/e2e/a11y',
    },
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
