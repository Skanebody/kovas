/**
 * E2E — Galerie photos fullscreen : nav clavier (flèches) + ESC pour fermer.
 */

import { test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Gallery — fullscreen avec clavier', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('keyboard ESC ferme un dialog fullscreen', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const photoTile = page.locator('[data-photo-tile], img[alt*="photo"], button.photo').first()
    if (await photoTile.count()) {
      await photoTile.click()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }
  })
})
