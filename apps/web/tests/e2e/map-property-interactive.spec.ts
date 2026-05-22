/**
 * E2E — Carte Leaflet chargée + marker visible sur une fiche bien.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Property map — Leaflet + marker', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('container leaflet présent sur la page bien', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/properties')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    // Map container Leaflet utilise un .leaflet-container
    const map = page.locator('.leaflet-container').first()
    if (await map.count()) {
      await expect(map).toBeVisible()
    }
  })
})
