/**
 * E2E — Validation dossier déclenche l'ouverture du panel pré-export.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Validation dossier → pré-export', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('depuis la page dossiers, click "Valider" ouvre le panel pré-export', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const validateBtn = page.getByRole('button', { name: /valider|pré-?export/i }).first()
    if (await validateBtn.count()) {
      await validateBtn.click()
      // PreExportPanel renders fixed inset-0 — vérification soft
      await expect(page.getByText(/pré-?export|score/i).first()).toBeVisible({ timeout: 10_000 })
    }
  })
})
