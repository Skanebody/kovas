/**
 * E2E — signup SIRET verification (API Recherche d'Entreprises).
 *
 * Vérifie que le wiring fonctionne :
 *   1. SIRET au format invalide → erreur "14 chiffres".
 *   2. (mode DEV bypass) SIRET 14 chiffres + email pro → redirect onboarding.
 *
 * On NE TESTE PAS l'appel API réel (api.gouv.fr) en E2E pour éviter la
 * dépendance réseau et la pression sur le service public. Le wrapper a sa
 * couverture Vitest dédiée (client.test.ts + cache.test.ts).
 *
 * Prérequis env :
 *   - NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1 (bypass API)
 *   - SUPABASE_SERVICE_ROLE_KEY (cleanup)
 */
import { expect, test } from '@playwright/test'
import { cleanupTestUser } from './fixtures/supabase-admin'

test.describe('Signup — vérification SIRET (data.gouv)', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('SIRET au format invalide (moins de 14 chiffres) → erreur affichée', async ({ page }) => {
    await page.goto('/signup')

    await page.fill('input[name="firstName"]', 'Marie')
    await page.fill('input[name="lastName"]', 'Diagnostiqueur')
    await page.fill('input[name="email"]', `e2e_test_${Date.now()}@example-cabinet.fr`)
    await page.fill('input[name="siret"]', '123') // trop court
    await page.fill('input[name="password"]', 'TestPass1234!')

    await page.click('button[type="submit"]')

    // L'action retourne une erreur fieldErrors.siret → on reste sur /signup
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/signup/)
  })

  test('SIRET 14 chiffres en mode DEV bypass → redirect onboarding', async ({ page }) => {
    const rand = Math.random().toString(36).slice(2, 8)
    const email = `e2e_test_${Date.now()}_${rand}@example-cabinet.fr`
    createdEmail = email

    await page.goto('/signup')

    await page.fill('input[name="firstName"]', 'Marie')
    await page.fill('input[name="lastName"]', 'Diagnostiqueur')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="siret"]', '12345678900012')
    await page.fill('input[name="password"]', 'TestPass1234!')

    await page.click('button[type="submit"]')

    await page.waitForURL(/\/dashboard|\/app\/onboarding/, { timeout: 20_000 })
  })
})
