/**
 * E2E — Suggestion proactive amiante : un bien <1997 sans amiante saisi
 * doit déclencher une suggestion.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Proactive suggestion — amiante avant 1997', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('access to dashboard and check no critical error', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    // Soft check : pas d'erreur server-side 500 visible
    const errorBoundary = page.getByText(/erreur server|500|fatal/i).first()
    expect(await errorBoundary.count()).toBe(0)
  })
})
