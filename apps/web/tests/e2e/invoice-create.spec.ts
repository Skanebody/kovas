/**
 * E2E — Création facture.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Invoice — création facture', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('page factures accessible', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)
    await page.goto('/dashboard/factures')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    expect(page.url()).toContain('factures')
  })
})
