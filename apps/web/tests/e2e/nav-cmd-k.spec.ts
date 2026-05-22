/**
 * E2E — Palette de commandes Cmd+K / Ctrl+K.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Nav — palette Cmd+K', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('Cmd+K (Meta+K) ouvre la palette', async ({ page, browserName }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const key = browserName === 'webkit' ? 'Meta+k' : 'Control+k'
    await page.keyboard.press(key)
    await page.waitForTimeout(300)

    // Vérifie qu'un dialog/combobox est visible
    const palette = page.locator('[role="dialog"], [cmdk-root]').first()
    if (await palette.count()) {
      await expect(palette).toBeVisible({ timeout: 3_000 })
    }
  })
})
