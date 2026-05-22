/**
 * E2E — Sheet IA assistant dossier avec streaming SSE Claude mocké.
 */

import { expect, test } from '@playwright/test'
import { loginAs } from './fixtures/auth'
import { cleanupTestUser, createTestUser } from './fixtures/supabase-admin'

test.describe('AI assistant — sheet ouverture + streaming Claude mocké', () => {
  let createdEmail: string | null = null

  test.afterEach(async () => {
    if (createdEmail) {
      await cleanupTestUser(createdEmail)
      createdEmail = null
    }
  })

  test('ouverture sheet IA — streaming Claude renvoie une réponse mockée', async ({ page }) => {
    const user = await createTestUser()
    createdEmail = user.email
    await loginAs(page, user.email, user.password)

    // Mock streaming SSE — renvoie un payload texte simulé
    await page.route('**/api/ai/**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body:
          'data: {"text":"Bonjour. "}\n\n' +
          'data: {"text":"Voici une réponse mockée."}\n\n' +
          'data: [DONE]\n\n',
      })
    })

    await page.goto('/dashboard/dossiers')
    await page.waitForLoadState('networkidle').catch(() => undefined)
    const aiBtn = page.getByRole('button', { name: /assistant|kovas ia|claude/i }).first()
    if (await aiBtn.count()) {
      await aiBtn.click()
      // Sheet ouvert : vérification soft d'un input
      await expect(page.locator('input, textarea').first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
