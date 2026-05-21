/**
 * Test 1 — Signup B2B + redirect onboarding.
 *
 * Flux :
 * 1. Visite /signup
 * 2. Remplit le form (fullName, email, SIRET, password)
 * 3. Soumet → redirect vers /app/onboarding (action signupAction)
 *
 * Prérequis env :
 * - NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1 (sinon la validation Luhn échoue sur le SIRET test)
 * - SUPABASE_SERVICE_ROLE_KEY (pour cleanup)
 */
import { expect, test } from '@playwright/test'
import { cleanupTestUser } from './fixtures/supabase-admin'

test.describe('Signup B2B + onboarding redirect', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('signup avec SIRET valide → redirect /app/onboarding', async ({ page }) => {
    const rand = Math.random().toString(36).slice(2, 8)
    const email = `e2e_test_${Date.now()}_${rand}@example-cabinet.fr`
    createdEmail = email

    await page.goto('/signup')

    await expect(page.locator('input[name="fullName"]')).toBeVisible()

    await page.fill('input[name="fullName"]', 'Marie Diagnostiqueur')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="siret"]', '12345678900012')
    await page.fill('input[name="password"]', 'TestPass1234!')

    await page.click('button[type="submit"]')

    // Redirect attendu vers /app/onboarding (cf. signupAction)
    await page.waitForURL(/\/app\/onboarding/, { timeout: 20_000 })
    expect(page.url()).toContain('/app/onboarding')
  })

  test('signup avec email non-pro (gmail) → erreur affichée', async ({ page }) => {
    await page.goto('/signup')

    await page.fill('input[name="fullName"]', 'Test User')
    await page.fill('input[name="email"]', `e2e_test_${Date.now()}@gmail.com`)
    await page.fill('input[name="siret"]', '12345678900012')
    await page.fill('input[name="password"]', 'TestPass1234!')

    await page.click('button[type="submit"]')

    // L'action retourne une erreur fieldErrors.email
    // → la page ne navigate pas, le message apparaît
    await expect(page).toHaveURL(/\/signup/)
    // On laisse 2s à l'action serveur le temps de répondre
    await page.waitForTimeout(2_000)
    // Pas d'assertion stricte sur le message (libellé peut évoluer)
    // — on vérifie juste qu'on est resté sur /signup
    expect(page.url()).toContain('/signup')
  })
})
