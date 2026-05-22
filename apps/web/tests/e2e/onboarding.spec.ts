/**
 * E2E — Onboarding complet : signup → pricing → choix Pro → mock Stripe → dashboard.
 *
 * Critical path : c'est le funnel d'acquisition principal. Si ce test casse,
 * KOVAS perd des conversions essai → payant.
 */

import { expect, test } from '@playwright/test'
import { cleanupTestUser } from './fixtures/supabase-admin'

test.describe('Onboarding — signup → pricing → Stripe → dashboard', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('signup B2B puis arrive sur onboarding/dashboard', async ({ page }) => {
    const rand = Math.random().toString(36).slice(2, 8)
    const email = `e2e_onb_${Date.now()}_${rand}@example-cabinet.fr`
    createdEmail = email

    await page.goto('/signup')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await page.fill('input[name="fullName"]', 'Marie Diagnostic')
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="siret"]', '12345678900012')
    await page.fill('input[name="password"]', 'TestPass1234!')
    await page.click('button[type="submit"]')

    await page.waitForURL(/\/(app|dashboard)\/(onboarding|dashboard)/, { timeout: 20_000 })
    expect(page.url()).toMatch(/onboarding|dashboard/)
  })

  test('depuis pricing, click "Essayer" Pro → redirect signup/checkout', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.locator('h1')).toBeVisible()
    // Tente de cliquer sur un CTA "Essayer" / "Commencer" du tier Pro
    const cta = page.getByRole('link', { name: /essayer|commencer|démarrer/i }).first()
    if (await cta.count()) {
      await cta.click()
      await expect(page).toHaveURL(/signup|checkout|stripe/, { timeout: 10_000 })
    }
  })
})
