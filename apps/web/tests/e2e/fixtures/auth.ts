/**
 * Helpers d'authentification UI pour les tests Playwright.
 */
import type { Page } from '@playwright/test'

/**
 * Connecte un user via le formulaire de login (/login).
 * Attend la redirection vers /app/dashboard pour confirmer le succès.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  // Le serveur action redirect vers /app/dashboard
  await page.waitForURL(/\/app\/(dashboard|onboarding)/, { timeout: 15_000 })
}

/**
 * Effectue le signup B2B via le formulaire UI.
 * @returns l'URL finale après redirect (typiquement /app/onboarding)
 */
export async function signupViaUi(
  page: Page,
  opts: { email: string; password: string; fullName: string; siret: string },
): Promise<string> {
  await page.goto('/signup')
  await page.fill('input[name="fullName"]', opts.fullName)
  await page.fill('input[name="email"]', opts.email)
  await page.fill('input[name="siret"]', opts.siret)
  await page.fill('input[name="password"]', opts.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/app\/(onboarding|dashboard)/, { timeout: 15_000 })
  return page.url()
}
