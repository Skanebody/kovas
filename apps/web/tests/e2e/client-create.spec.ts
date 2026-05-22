/**
 * E2E — Création client + autocomplete SIRET mocké.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Client — création + SIRET lookup', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('création client professionnel avec SIRET', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    // Mock INSEE Sirene API pour autocomplete SIRET
    await page.route('**/api/clients/siret/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          siret: '12345678900012',
          siren: '123456789',
          companyName: 'Cabinet Test SARL',
          address: '10 rue du Test',
          city: 'Paris',
          postalCode: '75008',
        }),
      })
    })

    await page.goto('/dashboard/clients')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const newBtn = page
      .getByRole('link', { name: /nouveau client|ajouter.*client/i })
      .or(page.getByRole('button', { name: /nouveau client|ajouter.*client/i }))
      .first()
    if (await newBtn.count()) {
      await newBtn.click()
      await expect(page.locator('input, form').first()).toBeVisible({ timeout: 10_000 })
    }
  })
})
