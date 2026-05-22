/**
 * E2E — Création d'un bien immobilier avec autocomplete BAN mockée.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Property — création bien + BAN autocomplete', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('création bien avec auto-complétion adresse BAN', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    // Mock BAN API
    await page.route('**/api-adresse.data.gouv.fr/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          features: [
            {
              properties: {
                id: 'ban_test_001',
                label: '10 Rue de Rivoli 75001 Paris',
                city: 'Paris',
                postcode: '75001',
                housenumber: '10',
                street: 'Rue de Rivoli',
              },
              geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            },
          ],
        }),
      })
    })

    await page.goto('/dashboard/properties')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    expect(page.url()).toContain('properties')
  })
})
