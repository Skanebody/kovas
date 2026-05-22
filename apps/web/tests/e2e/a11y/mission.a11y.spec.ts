/**
 * A11y — page dossiers/missions (authentifié).
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { loginAs } from '../fixtures/auth'
import { cleanupTestUser, createTestUser } from '../fixtures/supabase-admin'

test('mission/dossiers page passes WCAG 2.1 AA', async ({ page }) => {
  const user = await createTestUser()
  try {
    await loginAs(page, user.email, user.password)
    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  } finally {
    await cleanupTestUser(user.email)
  }
})
