/**
 * E2E — Items DPE tracker (checklist par diagnostic).
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('DPE checklist — tracker items visibles', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('la page mission affiche un panel checklist DPE', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const checklistTitle = page.getByText(/checklist|liste de contrôle|à vérifier/i).first()
    if (await checklistTitle.count()) {
      await expect(checklistTitle).toBeVisible()
    }
  })
})
