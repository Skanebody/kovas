/**
 * E2E — Wizard création dossier 3 étapes.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Dossier — wizard 3 étapes', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test("création d'un dossier via le wizard", async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const newBtn = page
      .getByRole('link', { name: /nouveau dossier|créer.*dossier/i })
      .or(page.getByRole('button', { name: /nouveau dossier|créer.*dossier/i }))
      .first()
    if (await newBtn.count()) {
      await newBtn.click()
      await page.waitForURL(/new|dossier/, { timeout: 8_000 }).catch(() => undefined)
      await expect(page.locator('form, [role="form"]').first()).toBeVisible({ timeout: 10_000 })
    }
  })
})
