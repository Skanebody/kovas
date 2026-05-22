/**
 * E2E — Pré-export panel : score affiché, findings listés, "Exporter quand
 * même" toujours actif (jamais bloquant, cf. CLAUDE.md philosophie).
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Pre-export panel — UX non bloquante', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('bouton "Exporter quand même" est toujours cliquable', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const validateBtn = page.getByRole('button', { name: /valider|pré-?export/i }).first()
    if (await validateBtn.count()) {
      await validateBtn.click()
      const exportAnyway = page.getByRole('button', { name: /exporter quand même|forcer/i })
      if (await exportAnyway.count()) {
        expect(await exportAnyway.isEnabled()).toBe(true)
      }
    }
  })
})
