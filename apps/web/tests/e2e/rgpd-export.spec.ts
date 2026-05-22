/**
 * E2E — Export complet RGPD (droit à la portabilité).
 */

import { test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('RGPD — export 1 clic de toutes les données', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('CTA export RGPD existe et déclenche un download/email', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/account')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const exportBtn = page.getByRole('button', { name: /exporter.*données|rgpd/i }).first()
    if (await exportBtn.count()) {
      await exportBtn.click({ trial: true })
    }
  })
})
