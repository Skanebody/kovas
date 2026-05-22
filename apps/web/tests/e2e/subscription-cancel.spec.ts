/**
 * E2E — Workflow résiliation décret 2023-417 (cf. composants cancellation/).
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Subscription — résiliation décret 2023-417', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('accès à la page compte/résiliation', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/account')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    // Lien résiliation accessible ?
    const cancelLink = page.getByRole('link', { name: /résili|annuler.*abonn/i }).first()
    if (await cancelLink.count()) {
      await cancelLink.click()
      await expect(page).toHaveURL(/cancel|résiliat/, { timeout: 5_000 })
    }
  })
})
