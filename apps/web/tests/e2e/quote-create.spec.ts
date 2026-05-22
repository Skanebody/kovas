/**
 * E2E — Création d'un devis.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Quote — création devis', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('accède à la page devis', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)
    await page.goto('/dashboard/devis')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    expect(page.url()).toContain('devis')
  })
})
