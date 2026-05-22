/**
 * E2E — Workflow demande de photo client par SMS.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Client photo request — SMS workflow', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test("page upload publique répond (404 si token inconnu — c'est OK)", async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    // Pas de token réel — on s'attend juste à ce que la route soit gérée sans crash 500
    const response = await page.goto('/upload?token=invalid-token-test', { waitUntil: 'load' })
    expect(response?.status()).toBeLessThan(500)
  })
})
