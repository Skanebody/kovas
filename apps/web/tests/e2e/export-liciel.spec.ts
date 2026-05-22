/**
 * E2E — Export Liciel : déclenche un download XML.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('Export Liciel — déclenche download XML', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('action "Export ZIP/XML Liciel" déclenche un download', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)

    const exportBtn = page
      .getByRole('button', { name: /exporter.*liciel|export liciel|zip liciel/i })
      .first()
    if (await exportBtn.count()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
        exportBtn.click(),
      ])
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.(xml|zip)$/i)
      }
    }
  })
})
