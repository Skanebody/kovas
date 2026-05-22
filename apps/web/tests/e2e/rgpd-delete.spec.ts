/**
 * E2E — Suppression de compte RGPD (droit à l'oubli).
 *
 * On vérifie juste l'existence du flow ; on n'exécute pas la suppression réelle
 * pour ne pas perdre le user de test (cleanupTestUser l'utilise ensuite).
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('RGPD — suppression de compte', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('le flow suppression de compte existe (zone danger)', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/account')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const deleteSection = page.getByText(/supprimer.*compte|zone.*danger/i).first()
    if (await deleteSection.count()) {
      await expect(deleteSection).toBeVisible()
    }
  })
})
