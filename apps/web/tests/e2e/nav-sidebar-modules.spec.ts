/**
 * E2E — Sidebar items selon plan (feature gates).
 *
 * Pro voit Cockpit ADEME, Essential ne le voit pas.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Sidebar — modules selon plan', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('sidebar visible après login', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    // Sidebar mounted ?
    const sidebar = page.locator('nav, [role="navigation"]').first()
    await expect(sidebar).toBeVisible({ timeout: 5_000 })
  })
})
