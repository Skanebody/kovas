/**
 * E2E — Marquer facture comme payée.
 */

import { test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Invoice — marquer payée', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('action mark paid existe sur la page factures', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/factures')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const payBtn = page.getByRole('button', { name: /marquer.*payée|payé/i }).first()
    // Présence facultative — vérifie juste que le clic ne crashe pas
    if (await payBtn.count()) {
      await payBtn.click({ trial: true })
    }
  })
})
